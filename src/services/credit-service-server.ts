
'use server';

import { query, getNextSequenceValue } from '@/lib/mysql';
import type { CreditApplication, CreditDetail, CreditStatus, AppUser as User, RegisteredPayment, GuaranteeItem, GuarantorItem } from '@/lib/types';
import { generatePaymentSchedule, calculateCreditStatusDetails } from '@/lib/utils';
import { createLog } from './audit-log-service';
import { revalidatePath } from 'next/cache';
import { format, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
    toISOString,
    nowInNicaragua,
    toNicaraguaTime,
    isoToMySQLDateTime,
    isoToMySQLDate,
    formatDateForUser
} from '@/lib/date-utils';
import { generateCreditId, generateGuaranteeId, generateGuarantorId, generatePaymentId } from '@/lib/id-generator';
import { 
    CreateCreditSchema, 
    CreatePaymentSchema,
    type CreateCreditInput,
    type CreatePaymentInput 
} from '@/lib/validation-schemas';
import { 
    withErrorHandling, 
    createErrorResponse, 
    createSuccessResponse,
    validateOrThrow,
    ServiceError,
    NotFoundError,
    AuthorizationError,
    BusinessLogicError,
    type ServiceResponse 
} from '@/lib/service-response';
import { getUser, getUserByName } from './user-service-server';
import { getClient } from './client-service-server';
import { hasUserClosedDay } from './closure-service';

// Helper to safely convert different date formats to ISO string
const toISOStringSafe = (date: any): string | undefined => {
    return toISOString(date) || undefined;
};


export async function addCredit(
    creditData: unknown, 
    creator: User
): Promise<ServiceResponse<string>> {
    return withErrorHandling(async () => {
        // Validar datos de entrada
        const validatedData = validateOrThrow<CreateCreditInput>(CreateCreditSchema, creditData);
        
        const { 
            clientId, 
            amount, 
            interestRate, 
            termMonths, 
            paymentFrequency, 
            firstPaymentDate, 
            collectionsManager, 
            guarantees = [], 
            guarantors = [],
            ...otherFields 
        } = validatedData;

        // Verificar que el cliente existe
        const client = await getClient(clientId);
        if (!client) {
            throw new NotFoundError('Cliente');
        }

        // Verificar que el gestor existe y es válido
        const gestor = await getUser(collectionsManager);
        if (!gestor) {
            throw new NotFoundError('Gestor de cobro');
        }

        // Verificar permisos del creador
        const creatorRole = creator.role.toUpperCase();
        const isAdminOrOperativo = creatorRole === 'ADMINISTRADOR' || creatorRole === 'OPERATIVO';
        
        // Generar datos del crédito
        const sequence = await getNextSequenceValue('creditNumber');
        const creditNumber = `CRE-${String(sequence).padStart(5, '0')}`;
        const newCreditId = generateCreditId();

        // Obtener feriados para ajustar fechas de pago
        const holidaysResult: any = await query('SELECT date FROM holidays');
        const holidays = holidaysResult.map((h: any) => formatDateForUser(h.date, 'yyyy-MM-dd'));

        // Generar plan de pagos
        const scheduleData = generatePaymentSchedule({
            loanAmount: amount, 
            monthlyInterestRate: interestRate, 
            termMonths, 
            paymentFrequency, 
            startDate: firstPaymentDate, 
            holidays
        });
        
        if (!scheduleData) {
            throw new BusinessLogicError(
                'No se pudo generar el plan de pagos con los parámetros proporcionados',
                'INVALID_INPUT'
            );
        }

        // Determinar estado inicial
        const initialStatus: CreditStatus = isAdminOrOperativo ? 'Approved' : 'Pending';
        const applicationDate = nowInNicaragua();
        const approvalDate = isAdminOrOperativo ? nowInNicaragua() : null;
        const approvedBy = isAdminOrOperativo ? creator.fullName : null;

        // Insertar crédito principal
        const creditSql = `
            INSERT INTO credits (id, creditNumber, clientId, clientName, status, applicationDate, approvalDate, approvedBy, amount, principalAmount, interestRate, termMonths, paymentFrequency, currencyType, totalAmount, totalInterest, totalInstallmentAmount, firstPaymentDate, deliveryDate, dueDate, collectionsManager, createdBy, branch, branchName, productType, subProduct, productDestination)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const { isoToMySQLDateTimeNoon } = await import('@/lib/date-utils');

        await query(creditSql, [
            newCreditId, creditNumber, clientId, client.name, initialStatus,
            isoToMySQLDateTime(applicationDate),
            approvalDate ? isoToMySQLDateTime(approvalDate) : null,
            approvedBy, amount, amount, interestRate, termMonths, paymentFrequency, 'CÓRDOBAS',
            scheduleData.totalPayment, scheduleData.totalInterest, scheduleData.periodicPayment,
            isoToMySQLDateTimeNoon(firstPaymentDate),
            validatedData.deliveryDate ? isoToMySQLDateTimeNoon(validatedData.deliveryDate) : null,
            `${scheduleData.schedule[scheduleData.schedule.length - 1].paymentDate} 12:00:00`,
            gestor.fullName, creator.fullName,
            gestor.sucursal || null, gestor.sucursalName || null, 
            validatedData.productType, validatedData.subProduct, validatedData.productDestination
        ]);

        // Insertar garantías
        if (guarantees.length > 0) {
            for (const g of guarantees) {
                const guaranteeId = generateGuaranteeId();
                await query(
                    'INSERT INTO guarantees (id, creditId, article, brand, color, model, series, estimatedValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                    [guaranteeId, newCreditId, g.article, g.brand, g.color, g.model, g.series, g.estimatedValue]
                );
            }
        }

        // Insertar fiadores
        if (guarantors.length > 0) {
            for (const g of guarantors) {
                const guarantorId = generateGuarantorId();
                await query(
                    'INSERT INTO guarantors (id, creditId, name, cedula, phone, address, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [guarantorId, newCreditId, g.name, g.cedula, g.phone, g.address, g.relationship]
                );
            }
        }

        // Insertar plan de pagos
        if (scheduleData.schedule.length > 0) {
            for (const p of scheduleData.schedule) {
                await query(
                    'INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [newCreditId, p.paymentNumber, `${p.paymentDate} 12:00:00`, p.amount, p.principal, p.interest, p.balance]
                );
            }
        }

        // Registrar en auditoría
        await createLog(creator, 'credit:create', `Creó la solicitud de crédito ${creditNumber} para ${client.name}.`, { targetId: newCreditId });
        if (isAdminOrOperativo) {
            await createLog(creator, 'credit:approve', `Aprobó automáticamente el crédito ${creditNumber} durante la creación.`, { targetId: newCreditId });
        }

        // Revalidar caché
        revalidatePath('/credits');
        revalidatePath('/requests');

        return newCreditId;
    }, 'addCredit');
}

export async function updateCredit(id: string, creditData: Partial<CreditDetail>, actor: User): Promise<{ success: boolean; error?: string }> {
    try {
        // Verificar permisos de edición
        const actorRole = actor.role.toUpperCase();
        if (!['ADMINISTRADOR', 'GERENTE', 'OPERATIVO'].includes(actorRole)) {
            return { success: false, error: 'No tienes permisos para editar créditos.' };
        }

        // Si es GERENTE u OPERATIVO, verificar que el crédito pertenece a su sucursal
        if (['GERENTE', 'OPERATIVO'].includes(actorRole)) {
            const creditRows: any = await query('SELECT branch FROM credits WHERE id = ? LIMIT 1', [id]);
            if (creditRows.length === 0) {
                return { success: false, error: 'Crédito no encontrado.' };
            }

            if (creditRows[0].branch !== actor.sucursal) {
                return { success: false, error: 'No tienes permisos para editar este crédito.' };
            }
        }

        const { paymentPlan, registeredPayments, clientDetails, guarantees, guarantors, ...fieldsToUpdate } = creditData;

        // Handle lookup for collectionsManager names
        if (fieldsToUpdate.collectionsManager) {
            const gestor = await getUser(fieldsToUpdate.collectionsManager);
            fieldsToUpdate.collectionsManager = gestor?.fullName;
        }

        if (Object.keys(fieldsToUpdate).length > 0) {
            // Solo cambiar el estado a 'Pending' si se está enviando un cambio de estado explícito
            // y ese estado no es uno de los estados finales/especiales
            if (fieldsToUpdate.hasOwnProperty('status') &&
                fieldsToUpdate.status !== 'Active' &&
                fieldsToUpdate.status !== 'Rejected' &&
                fieldsToUpdate.status !== 'Fallecido' &&
                fieldsToUpdate.status !== 'Approved') {
                fieldsToUpdate.status = 'Pending';
                fieldsToUpdate.approvedBy = null;
                fieldsToUpdate.approvalDate = null;
            }

            // Agregar información de quién modificó (la fecha se actualiza automáticamente con updatedAt)
            fieldsToUpdate.lastModifiedBy = actor.fullName;

            // Remove undefined values
            const filteredFields = Object.fromEntries(
                Object.entries(fieldsToUpdate).filter(([_, value]) => value !== undefined)
            );

            // Convertir fechas a formato MySQL si existen
            const { isoToMySQLDateTimeNoon } = await import('@/lib/date-utils');

            if (filteredFields.deliveryDate && typeof filteredFields.deliveryDate === 'string') {
                // deliveryDate usa mediodía (fecha sin hora específica)
                filteredFields.deliveryDate = isoToMySQLDateTimeNoon(filteredFields.deliveryDate);
            }
            if (filteredFields.firstPaymentDate && typeof filteredFields.firstPaymentDate === 'string') {
                // firstPaymentDate usa mediodía (fecha sin hora específica)
                filteredFields.firstPaymentDate = isoToMySQLDateTimeNoon(filteredFields.firstPaymentDate);
            }
            if (filteredFields.approvalDate && typeof filteredFields.approvalDate === 'string') {
                // approvalDate usa hora exacta (momento de aprobación)
                filteredFields.approvalDate = isoToMySQLDateTime(filteredFields.approvalDate);
            }
            // lastModifiedDate se maneja automáticamente por updatedAt en la base de datos

            const updateFields = Object.keys(filteredFields).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(filteredFields);
            await query(`UPDATE credits SET ${updateFields} WHERE id = ?`, [...updateValues, id]);
        }

        // Actualizar garantías si se proporcionaron
        if (guarantees && Array.isArray(guarantees)) {
            // Eliminar garantías existentes
            await query('DELETE FROM guarantees WHERE creditId = ?', [id]);

            // Insertar nuevas garantías
            for (const g of guarantees) {
                const guaranteeId = g.id || generateGuaranteeId();
                await query(
                    'INSERT INTO guarantees (id, creditId, article, brand, color, model, series, estimatedValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [guaranteeId, id, g.article, g.brand, g.color, g.model, g.series, g.estimatedValue]
                );
            }
        }

        // Actualizar fiadores si se proporcionaron
        if (guarantors && Array.isArray(guarantors)) {
            // Eliminar fiadores existentes
            await query('DELETE FROM guarantors WHERE creditId = ?', [id]);

            // Insertar nuevos fiadores
            for (const g of guarantors) {
                const guarantorId = g.id || generateGuarantorId();
                await query(
                    'INSERT INTO guarantors (id, creditId, name, cedula, phone, address, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [guarantorId, id, g.name, g.cedula, g.phone, g.address, g.relationship]
                );
            }
        }

        await createLog(actor, 'credit:update', `Actualizó el crédito ${creditData.creditNumber || id}.`, { targetId: id, details: fieldsToUpdate });

        revalidatePath(`/credits/${id}`);
        revalidatePath('/credits');
        revalidatePath('/requests');
        revalidatePath('/disbursements');

        return { success: true };
    } catch (error: any) {
        console.error(`Error al actualizar el crédito ${id}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}

export async function deleteCredit(id: string, actor: User): Promise<{ success: boolean; error?: string }> {
    try {
        // Solo ADMINISTRADOR puede eliminar créditos
        if (actor.role.toUpperCase() !== 'ADMINISTRADOR') {
            return { success: false, error: 'No tienes permisos para eliminar créditos.' };
        }

        await query('DELETE FROM credits WHERE id = ?', [id]);
        await createLog(actor, 'credit:delete', `Eliminó el crédito con ID ${id}.`, { targetId: id });
        revalidatePath('/credits');
        return { success: true };
    } catch (error: any) {
        console.error(`Error al eliminar el crédito ${id}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}

export async function getCredit(id: string): Promise<CreditDetail | null> {
    const creditRows: any = await query('SELECT * FROM credits WHERE id = ? LIMIT 1', [id]);
    if (creditRows.length === 0) return null;

    let creditData = creditRows[0];

    // Fetch related data concurrently
    const [clientDetails, paymentPlanRows, registeredPaymentRows, guaranteeRows, guarantorRows]: [any, any, any, any, any] = await Promise.all([
        getClient(creditData.clientId),
        query('SELECT * FROM payment_plan WHERE creditId = ? ORDER BY paymentNumber', [id]),
        query('SELECT * FROM payments_registered WHERE creditId = ? ORDER BY paymentDate DESC', [id]),
        query('SELECT * FROM guarantees WHERE creditId = ?', [id]),
        query('SELECT * FROM guarantors WHERE creditId = ?', [id]),
    ]);

    // Attach and format the data
    creditData.clientDetails = clientDetails;

    // Convert date fields safely to ISO strings for transport to the client
    creditData.paymentPlan = paymentPlanRows.map((p: any) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) }));
    creditData.registeredPayments = registeredPaymentRows.map((p: any) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) }));
    creditData.guarantees = guaranteeRows;
    creditData.guarantors = guarantorRows;

    // Convert main credit date fields
    Object.keys(creditData).forEach(key => {
        if (key.toLowerCase().includes('date')) {
            creditData[key] = toISOStringSafe(creditData[key]);
        }
    });

    // Calculate outstanding balance if the credit is being refinanced
    const { outstandingBalance, netDisbursementAmount } = await calculateRefinanceDetails(creditData);
    creditData.outstandingBalance = outstandingBalance;
    creditData.netDisbursementAmount = netDisbursementAmount;

    return creditData as CreditDetail;
}


export async function getClientCredits(clientId: string): Promise<CreditDetail[]> {
    const creditRows: any[] = await query('SELECT * FROM credits WHERE clientId = ? ORDER BY applicationDate DESC', [clientId]);

    for (const credit of creditRows) {
        const registeredPaymentRows: any = await query('SELECT * FROM payments_registered WHERE creditId = ? ORDER BY paymentDate DESC', [credit.id]);
        credit.registeredPayments = registeredPaymentRows.map((p: any) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) }));
    }

    return creditRows as CreditDetail[];
}

export async function addPayment(creditId: string, paymentData: Omit<RegisteredPayment, 'id'>, actor: User): Promise<{ success: boolean; error?: string, paymentId?: string }> {
    try {
        // Verificar si el usuario ya cerró caja hoy
        const hasClosed = await hasUserClosedDay(actor.id);
        if (hasClosed) {
            return { success: false, error: 'Acción bloqueada: Ya has realizado el cierre de caja de hoy. No puedes registrar más pagos.' };
        }

        const paymentId = generatePaymentId();
        const sql = 'INSERT INTO payments_registered (id, creditId, paymentDate, amount, managedBy, transactionNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?)';

        const paymentDateForDB = isoToMySQLDateTime(paymentData.paymentDate);

        await query(sql, [paymentId, creditId, paymentDateForDB, paymentData.amount, paymentData.managedBy, paymentData.transactionNumber, 'VALIDO']);

        // After adding payment, check if credit is fully paid and update status
        // Use a slight delay or refetch to ensure the data is consistent
        const credit: any = await getCredit(creditId);
        if (credit) { // Check if credit was found
            const statusDetails = calculateCreditStatusDetails(credit as CreditDetail);
            if (statusDetails.remainingBalance <= 0.01) {
                await query('UPDATE credits SET status = ? WHERE id = ?', ['Paid', creditId]);
                await createLog(actor, 'credit:update', `El crédito ${credit?.creditNumber} se actualizó a status 'Paid' por pago completo.`, { targetId: creditId });
            }
        }

        await createLog(actor, 'payment:create', `Registró un abono de C$${paymentData.amount} para el crédito ${credit?.creditNumber}.`, { targetId: creditId });

        revalidatePath(`/credits/${creditId}`);
        revalidatePath('/dashboard');
        return { success: true, paymentId };
    } catch (error: any) {
        console.error(`Error al agregar abono al crédito ${creditId}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}

export async function requestVoidPayment(creditId: string, paymentId: string, reason: string, actor: User): Promise<{ success: boolean; error?: string }> {
    try {
        const sql = `UPDATE payments_registered SET status = 'ANULACION_PENDIENTE', voidReason = ?, voidRequestedBy = ? WHERE id = ?`;
        await query(sql, [reason, actor.fullName, paymentId]);
        await createLog(actor, 'payment:void_request', `Solicitó anular el pago ${paymentId} por: ${reason}.`, { targetId: creditId });
        revalidatePath(`/credits/${creditId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}

export async function voidPayment(creditId: string, paymentId: string, actor: User): Promise<{ success: boolean; error?: string }> {
    try {
        await query(`UPDATE payments_registered SET status = 'ANULADO' WHERE id = ?`, [paymentId]);
        await createLog(actor, 'payment:void_approve', `Anuló el pago ${paymentId}.`, { targetId: creditId });

        // Force credit status back to Active if it was Paid.
        // This is safer than recalculating, as it directly enforces the business rule.
        await query(`UPDATE credits SET status = 'Active' WHERE id = ? AND status = 'Paid'`, [creditId]);

        revalidatePath(`/credits/${creditId}`);
        return { success: true };
    } catch (error: any) {
        console.error(`Error in voidPayment for credit ${creditId}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la anulación del pago.' };
    }
}

export async function getCreditsAdmin(filters: { status?: CreditStatus, gestorName?: string, sucursales?: string[], clientIds?: string[], clientId?: string, user?: User | null, searchTerm?: string, dateFrom?: string, dateTo?: string } = {}): Promise<{ credits: CreditDetail[], lastDoc: any | null, users: User[] }> {
    let sql = 'SELECT * FROM credits';
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Apply filters...
    if (filters.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
    }
    if (filters.gestorName) {
        whereClauses.push('collectionsManager = ?');
        params.push(filters.gestorName);
    }
    if (filters.sucursales && filters.sucursales.length > 0) {
        const placeholders = filters.sucursales.map(() => '?').join(',');
        whereClauses.push(`branch IN (${placeholders})`);
        params.push(...filters.sucursales);
    }

    // Filtrado por rol de usuario para restricciones de sucursal
    if (filters.user) {
        const userRole = filters.user.role.toUpperCase();
        if (userRole === 'GERENTE' || userRole === 'OPERATIVO') {
            // Estos roles solo ven créditos de su sucursal
            if (filters.user.sucursal) {
                whereClauses.push('branch = ?');
                params.push(filters.user.sucursal);
            } else {
                // Si no tienen sucursal asignada, no pueden ver ningún crédito
                whereClauses.push('1 = 0');
            }
        }
        // ADMINISTRADOR y FINANZAS pueden ver todos los créditos (sin filtro adicional)
    }
    if (filters.clientIds && filters.clientIds.length > 0) {
        whereClauses.push('clientId IN (?)');
        params.push(filters.clientIds);
    }
    if (filters.clientId) {
        whereClauses.push('clientId = ?');
        params.push(filters.clientId);
    }
    if (filters.dateFrom) {
        whereClauses.push(`(deliveryDate >= ? OR approvalDate >= ?)`);
        params.push(`${filters.dateFrom} 00:00:00`, `${filters.dateFrom} 00:00:00`);
    }
    if (filters.dateTo) {
        whereClauses.push(`(deliveryDate <= ? OR approvalDate <= ?)`);
        params.push(`${filters.dateTo} 23:59:59`, `${filters.dateTo} 23:59:59`);
    }
    if (filters.searchTerm) {
        whereClauses.push('(clientName LIKE ? OR creditNumber LIKE ?)');
        params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }


    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY applicationDate DESC';

    const credits = await query(sql, params);

    return { credits: credits as CreditDetail[], lastDoc: null, users: [] };
}


export async function searchActiveCreditsGlobally(searchTerm: string, actor?: User): Promise<CreditDetail[]> {
    const sql = `
        SELECT c.* FROM credits c
        JOIN clients cl ON c.clientId = cl.id
        WHERE c.status = 'Active' AND (c.clientName LIKE ? OR cl.cedula LIKE ? OR c.creditNumber LIKE ?)
    `;
    const encodedCedula = actor ? `000-000000-0000X` : `%${searchTerm}%` //This is a temp fix for the demo
    const credits = await query(sql, [`%${searchTerm}%`, encodedCedula, `%${searchTerm}%`]);
    return credits as CreditDetail[];
}

export async function getPaidCreditsForGestor(gestorName: string, monthsAgo: number): Promise<CreditDetail[]> {
    const now = toNicaraguaTime(nowInNicaragua());
    const dateLimit = new Date(now);
    dateLimit.setMonth(dateLimit.getMonth() - monthsAgo);

    const sql = `
        SELECT * FROM credits 
        WHERE collectionsManager = ? 
        AND status = 'Paid' 
        AND dueDate > ?
    `;
    const credits: any = await query(sql, [gestorName, dateLimit]);
    return credits as CreditDetail[];
}

async function calculateRefinanceDetails(credit: CreditDetail): Promise<{ outstandingBalance: number; netDisbursementAmount: number }> {
    if (credit.status !== 'Approved') {
        return { outstandingBalance: 0, netDisbursementAmount: credit.amount };
    }

    const activeCredits: any = await query(
        "SELECT * FROM credits WHERE clientId = ? AND status = 'Active'",
        [credit.clientId]
    );

    if (activeCredits.length === 0) {
        return { outstandingBalance: 0, netDisbursementAmount: credit.amount };
    }

    const previousCredit = activeCredits[0];
    const paymentRows: any = await query('SELECT * FROM payments_registered WHERE creditId = ?', [previousCredit.id]);
    const previousCreditWithPayments = { ...previousCredit, registeredPayments: paymentRows.map((p: any) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) })) };

    const { remainingBalance } = calculateCreditStatusDetails(previousCreditWithPayments as CreditDetail);
    const netDisbursement = credit.amount - remainingBalance;

    return {
        outstandingBalance: remainingBalance,
        netDisbursementAmount: netDisbursement > 0 ? netDisbursement : 0
    };
}


export async function revertDisbursement(revertedCreditId: string, actor: User): Promise<{ success: boolean; error?: string }> {
    try {
        const creditResult = await query('SELECT * FROM credits WHERE id = ?', [revertedCreditId]) as unknown as any[];
        if (creditResult.length === 0) {
            return { success: false, error: "Crédito a revertir no encontrado." };
        }
        const creditToRevert: CreditDetail = creditResult[0];

        // Cambia el estado del crédito actual a 'Approved'
        await query('UPDATE credits SET status = ?, disbursedBy = NULL, deliveryDate = NULL WHERE id = ?', ['Approved', revertedCreditId]);
        await createLog(actor, 'credit:revert', `Revirtió el desembolso del crédito ${creditToRevert.creditNumber}.`, { targetId: revertedCreditId });

        revalidatePath(`/credits/${revertedCreditId}`);
        revalidatePath('/disbursements');

        return { success: true };
    } catch (error: any) {
        console.error(`Error al revertir desembolso ${revertedCreditId}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}

export async function revalidateActiveCreditsStatus(): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    try {
        const activeCredits = (await query("SELECT * FROM credits WHERE status = 'Active'")) as any[];
        let updatedCount = 0;

        // Optimización: Obtener holidays una sola vez
        const holidays = (await query("SELECT date FROM holidays")) as any[];
        const holidayDates = holidays.map((h: any) => formatDateForUser(h.date, 'yyyy-MM-dd'));

        for (const credit of activeCredits) {

            const scheduleData = generatePaymentSchedule({
                loanAmount: credit.principalAmount,
                monthlyInterestRate: credit.interestRate,
                termMonths: credit.termMonths,
                paymentFrequency: credit.paymentFrequency,
                startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd'),
                holidays: holidayDates
            });

            if (scheduleData) {
                // Actualizar las fechas en el registro principal del crédito
                const firstPaymentDate = scheduleData.schedule[0].paymentDate;
                const newDueDate = scheduleData.schedule[scheduleData.schedule.length - 1].paymentDate;
                
                await query('UPDATE credits SET firstPaymentDate = ?, dueDate = ? WHERE id = ?', [
                    `${firstPaymentDate.split('T')[0]} 12:00:00`,
                    `${newDueDate.split('T')[0]} 12:00:00`, 
                    credit.id
                ]);

                // Borrar y volver a insertar el plan de pagos
                await query('DELETE FROM payment_plan WHERE creditId = ?', [credit.id]);
                for (const p of scheduleData.schedule) {
                    // Usar mediodía (12:00:00) para evitar problemas de zona horaria con fechas
                    await query('INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance) VALUES (?, ?, ?, ?, ?, ?, ?)', [credit.id, p.paymentNumber, `${p.paymentDate.split('T')[0]} 12:00:00`, p.amount, p.principal, p.interest, p.balance]);
                }
                updatedCount++;
            }
        }
        revalidatePath('/credits');
        revalidatePath('/reports');
        return { success: true, updatedCount };
    } catch (error: any) {
        console.error("Error revalidating credit statuses:", error);
        return { success: false, updatedCount: 0, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}
