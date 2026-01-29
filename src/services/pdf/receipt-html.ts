

'use server';

import { query } from '@/lib/mysql';
import type { CreditDetail, ReceiptInput, Client, RegisteredPayment } from '@/lib/types';
import { calculateCreditStatusDetails } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';
import { getClient } from '@/services/client-service-server';
import { getCredit as getCreditServer } from '@/services/credit-service-server';
import { toISOString } from '@/lib/date-utils';


interface HtmlReceiptOutput {
    html?: string;
    error?: string;
}

const toISOStringSafe = (date: any): string | undefined => {
    if (!date) return undefined;
    try {
        if (date instanceof Date) {
            if (isValid(date)) return date.toISOString();
        }
        if (typeof date === 'string') {
            const parsed = parseISO(date);
            if (isValid(parsed)) return parsed.toISOString();
        }
         if (typeof date === 'number') {
            return toISOString(date) || undefined;
        }
    } catch (e) {
        console.error("toISOStringSafe falló para la fecha:", date, e);
    }
    return undefined;
};


const formatLocalTime = (utcDateString?: string): string => {
    if(!utcDateString) return 'Fecha inválida';
    try {
        const utcDate = parseISO(utcDateString);
        if (!isValid(utcDate)) return 'Fecha inválida';
        // Usar Intl.DateTimeFormat para un manejo robusto de la zona horaria en el servidor
        const formatter = new Intl.DateTimeFormat('es-NI', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
            timeZone: 'America/Managua',
        });
        return formatter.format(utcDate);
    } catch (e){
        console.error("Error formatting date: ", e);
        return 'Fecha inválida';
    }
};

interface GenerateReceiptHtmlInput extends ReceiptInput {}

export async function generateReceiptHtml({ creditId, paymentId, isReprint }: GenerateReceiptHtmlInput): Promise<HtmlReceiptOutput> {
    try {
        // 1. Obtener toda la información de una vez de forma eficiente
        const credit = await getCreditServer(creditId);
        if (!credit) return { error: 'Crédito no encontrado.' };

        const client = credit.clientDetails;
        if (!client) return { error: 'Cliente no encontrado.' };
        
        const paymentToPrint = (credit.registeredPayments || []).find(p => p.id === paymentId);
        
        if (!paymentToPrint) {
             console.error(`Error de lógica: No se encontró el pago con ID ${paymentId} en el crédito ${creditId} para generar el recibo.`);
             return { error: 'Pago no encontrado en el crédito. No se puede generar el recibo.' };
        }

        // --- 2. Cálculo de Datos ---
        // Filtrar pagos realizados ANTES del pago actual para obtener el estado pre-pago.
        const paymentsBeforeCurrent = (credit.registeredPayments || [])
            .filter(p => p.status !== 'ANULADO')
            .filter(p => {
                const pDate = toISOString(p.paymentDate);
                const printDate = toISOString(paymentToPrint.paymentDate);
                return pDate && printDate && pDate < printDate;
            });

        const creditStateBeforePayment = { ...credit, registeredPayments: paymentsBeforeCurrent };
        
        const statusBefore = calculateCreditStatusDetails(creditStateBeforePayment, paymentToPrint.paymentDate);
        const statusAfter = calculateCreditStatusDetails(credit, paymentToPrint.paymentDate);

        const cuotaDelDia = statusBefore.dueTodayAmount || 0;
        const montoAtrasado = statusBefore.overdueAmount;
        const diasMora = statusBefore.lateDays;
        const totalAPagar = cuotaDelDia + montoAtrasado;
        const saldoAnterior = statusBefore.remainingBalance;
        const nuevoSaldo = statusAfter.remainingBalance;

        const sucursalName = (credit.branchName || 'LEON').split(' ')[0].toUpperCase();

        // --- Funciones de Ayuda ---
        const sanitize = (text: string = ''): string => {
            if (!text) return '';
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        };
        const formatCurrency = (amount: number = 0) => amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // --- Construcción del HTML ---
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Recibo de Pago</title>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 16px;
                        line-height: 1.9;
                        color: #000;
                        background: #fff;
                        width: 80mm;
                        margin: 0;
                        padding: 0;
                    }
                    .receipt-container {
                        padding: 2mm;
                    }
                    .center { text-align: center; }
                    .line { border-top: 1px dashed #000; margin: 5px 0; }
                    .row { display: flex; justify-content: space-between; }
                    .bold { font-weight: bold; }
                    .uppercase { text-transform: uppercase; }
                    .sr-only { display: none; }
                    @media print {
                        @page {
                            size: 80mm auto; /* Ajustar altura automáticamente */
                            margin: 0;
                        }
                        body {
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    ${isReprint ? '<div class="center bold">*** REIMPRESION ***</div>' : ''}
                    <div class="center bold">CrediNica</div>
                    <div class="center">COPIA: CLIENTE</div>
                    <div class="line"></div>
                    <div>Recibo: ${sanitize(paymentToPrint.transactionNumber)}</div>
                    <div>Credito: ${sanitize(credit.creditNumber)}</div>
                    <div>Fecha/Hora: ${formatLocalTime(toISOStringSafe(paymentToPrint.paymentDate))}</div>
                    <div class="line"></div>
                    <div>Cliente:</div>
                    <div class="bold uppercase">${sanitize(credit.clientName)}</div>
                    <div>Código: ${sanitize(client?.clientNumber) || 'N/A'}</div>
                    <div class="line"></div>

                    <div class="row"><span>Cuota del dia:</span> <span>C$ ${formatCurrency(cuotaDelDia)}</span></div>
                    <div class="row"><span>Monto atrasado:</span> <span>C$ ${formatCurrency(montoAtrasado)}</span></div>
                    <div class="row"><span>Dias mora:</span> <span>${diasMora}</span></div>
                    <div class="row bold"><span>Total a pagar:</span> <span>C$ ${formatCurrency(totalAPagar)}</span></div>

                    <div class="line"></div>
                    <div class="row bold"><span>TOTAL COBRADO:</span> <span>C$ ${formatCurrency(paymentToPrint.amount)}</span></div>
                    <div class="line"></div>
                    <div class="row"><span>Saldo anterior:</span> <span>C$ ${formatCurrency(saldoAnterior)}</span></div>
                    <div class="row bold"><span>Nuevo saldo:</span> <span>C$ ${formatCurrency(nuevoSaldo)}</span></div>
                    <div class="line"></div>
                    <div class="center" style="margin-top: 10px;">Gracias por su pago.</div>
                    <div class="center bold">CONSERVE ESTE RECIBO</div>
                    <div class="center" style="margin-top: 20px;">${sanitize(sucursalName)}</div>
                    <div class="center" style="margin-top: 10px;">${sanitize(paymentToPrint.managedBy.toUpperCase())}</div>
                    <div class="center bold">GESTOR DE COBRO</div>
                </div>
            </body>
            </html>
        `;
        
        return { html };
    } catch (e: any) {
        console.error("HTML Generation Error:", e);
        return { error: `Error al generar el HTML del recibo: ${e.message}` };
    }
}
