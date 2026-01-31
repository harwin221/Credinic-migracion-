
'use server';

import { generateId } from '@/lib/id-generator';
import { query } from '@/lib/mysql';
import type { Holiday, AppUser as User } from '@/lib/types';
import { format } from 'date-fns';
import { createLog } from './audit-log-service';
import { revalidatePath } from 'next/cache';

export const getHolidays = async (): Promise<Holiday[]> => {
    const rows: any = await query('SELECT * FROM holidays ORDER BY date ASC');
    // Extraer solo la fecha (YYYY-MM-DD) sin conversión de zona horaria
    return rows.map((row: any) => ({
        ...row,
        date: row.date ? format(new Date(row.date), 'yyyy-MM-dd') : row.date
    }));
};

export const addHoliday = async (holidayData: Omit<Holiday, 'id'>, actor: User): Promise<{ success: boolean, id?: string, error?: string }> => {
    try {
        const newId = generateId('hol');
        // Para días feriados, usar la fecha exacta sin conversión de zona horaria
        const dateOnly = holidayData.date.split('T')[0]; // Extraer solo YYYY-MM-DD
        const formattedDate = `${dateOnly} 12:00:00`; // Agregar mediodía sin conversión
        
        await query('INSERT INTO holidays (id, name, date) VALUES (?, ?, ?)', [newId, holidayData.name, formattedDate]);
        await createLog(actor, 'settings:holiday_add', `Agregó el feriado ${holidayData.name} para la fecha ${dateOnly}.`, { targetId: newId });
        
        // Sincronizar todos los planes de pago con el nuevo feriado
        await synchronizeAllPaymentPlans(actor);
        
        revalidatePath('/settings/holidays');
        return { success: true, id: newId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

/**
 * Sincroniza todos los planes de pago de créditos activos con los días feriados actuales
 */
export const synchronizeAllPaymentPlans = async (actor: User): Promise<{ success: boolean, updated: number, error?: string }> => {
    try {
        // Obtener todos los días feriados actuales
        const holidaysResult: any = await query('SELECT date FROM holidays');
        const holidays = holidaysResult.map((h: any) => format(new Date(h.date), 'yyyy-MM-dd'));

        // Obtener todos los créditos activos que necesitan sincronización
        const activeCredits: any = await query(`
            SELECT id, amount, principalAmount, interestRate, termMonths, paymentFrequency, firstPaymentDate
            FROM credits 
            WHERE status IN ('Active', 'Approved')
        `);

        let updatedCount = 0;

        for (const credit of activeCredits) {
            try {
                // Importar generatePaymentSchedule dinámicamente para evitar dependencias circulares
                const { generatePaymentSchedule } = await import('@/lib/utils');
                
                // Regenerar el plan de pagos con los días feriados actuales
                const scheduleData = generatePaymentSchedule({
                    loanAmount: credit.principalAmount,
                    monthlyInterestRate: credit.interestRate,
                    termMonths: credit.termMonths,
                    paymentFrequency: credit.paymentFrequency,
                    startDate: credit.firstPaymentDate,
                    holidays
                });

                if (scheduleData && scheduleData.schedule) {
                    // Eliminar el plan de pagos anterior
                    await query('DELETE FROM payment_plan WHERE creditId = ?', [credit.id]);

                    // Insertar el nuevo plan de pagos
                    for (const payment of scheduleData.schedule) {
                        await query(`
                            INSERT INTO payment_plan (id, creditId, paymentNumber, paymentDate, amount, principal, interest, balance)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            payment.id.replace('payment_', `${credit.id}_payment_`),
                            credit.id,
                            payment.paymentNumber,
                            payment.paymentDate.replace('T12:00:00.000Z', ' 12:00:00'),
                            payment.amount,
                            payment.principal,
                            payment.interest,
                            payment.balance
                        ]);
                    }
                    updatedCount++;
                }
            } catch (creditError) {
                console.error(`Error sincronizando crédito ${credit.id}:`, creditError);
                // Continuar con el siguiente crédito
            }
        }

        await createLog(actor, 'settings:holiday_sync', `Sincronizó ${updatedCount} planes de pago con los días feriados actuales.`, { 
            details: { updatedCredits: updatedCount, totalCredits: activeCredits.length }
        });

        return { success: true, updated: updatedCount };
    } catch (error: any) {
        console.error('Error sincronizando planes de pago:', error);
        return { success: false, updated: 0, error: error.message };
    }
};

export const deleteHoliday = async (id: string, actor: User): Promise<{ success: boolean, error?: string }> => {
    try {
        await query('DELETE FROM holidays WHERE id = ?', [id]);
        await createLog(actor, 'settings:holiday_delete', `Eliminó el feriado con ID ${id}.`, { targetId: id });
        
        // Sincronizar todos los planes de pago después de eliminar el feriado
        await synchronizeAllPaymentPlans(actor);
        
        revalidatePath('/settings/holidays');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
