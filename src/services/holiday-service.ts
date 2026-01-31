
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
 * Verifica si un crédito tiene plan de pagos y lo regenera si es necesario
 */
export const ensurePaymentPlanExists = async (creditId: string, actor: User): Promise<{ success: boolean, created: boolean, error?: string }> => {
    try {
        // Verificar si ya existe un plan de pagos
        const existingPlan: any = await query('SELECT COUNT(*) as count FROM payment_plan WHERE creditId = ?', [creditId]);
        
        if (existingPlan[0].count > 0) {
            return { success: true, created: false };
        }

        // Si no existe, obtener los datos del crédito y generar el plan
        const creditResult: any = await query('SELECT * FROM credits WHERE id = ? LIMIT 1', [creditId]);
        if (creditResult.length === 0) {
            return { success: false, created: false, error: 'Crédito no encontrado.' };
        }

        const credit = creditResult[0];

        // Obtener días feriados
        const holidays = (await query("SELECT date FROM holidays")) as any[];
        const holidayDates = holidays.map((h: any) => format(new Date(h.date), 'yyyy-MM-dd'));

        // Generar plan de pagos
        const { generatePaymentSchedule } = await import('@/lib/utils');
        const { formatDateForUser } = await import('@/lib/date-utils');
        
        const scheduleData = generatePaymentSchedule({
            loanAmount: credit.principalAmount,
            monthlyInterestRate: credit.interestRate,
            termMonths: credit.termMonths,
            paymentFrequency: credit.paymentFrequency,
            startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd'),
            holidays: holidayDates
        });

        if (scheduleData && scheduleData.schedule) {
            // Actualizar las fechas en el registro principal del crédito
            const firstPaymentDate = scheduleData.schedule[0].paymentDate;
            const newDueDate = scheduleData.schedule[scheduleData.schedule.length - 1].paymentDate;
            
            await query('UPDATE credits SET firstPaymentDate = ?, dueDate = ? WHERE id = ?', [
                `${firstPaymentDate.split('T')[0]} 12:00:00`,
                `${newDueDate.split('T')[0]} 12:00:00`, 
                credit.id
            ]);

            // Insertar el plan de pagos
            for (const payment of scheduleData.schedule) {
                await query(`
                    INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    credit.id,
                    payment.paymentNumber,
                    `${payment.paymentDate.split('T')[0]} 12:00:00`,
                    payment.amount,
                    payment.principal,
                    payment.interest,
                    payment.balance
                ]);
            }

            await createLog(actor, 'payment_plan:create', `Generó plan de pagos faltante para crédito ${credit.creditNumber}.`, { 
                targetId: creditId,
                details: { paymentsCreated: scheduleData.schedule.length }
            });

            return { success: true, created: true };
        } else {
            return { success: false, created: false, error: 'No se pudo generar el plan de pagos.' };
        }

    } catch (error: any) {
        console.error('Error ensuring payment plan exists:', error);
        return { success: false, created: false, error: error.message };
    }
};
export const synchronizeAllPaymentPlans = async (actor: User): Promise<{ success: boolean, updated: number, error?: string }> => {
    try {
        // Usar la misma lógica que revalidateActiveCreditsStatus
        const activeCredits = (await query("SELECT * FROM credits WHERE status = 'Active'")) as any[];
        let updatedCount = 0;

        // Obtener todos los días feriados actuales
        const holidays = (await query("SELECT date FROM holidays")) as any[];
        const holidayDates = holidays.map((h: any) => format(new Date(h.date), 'yyyy-MM-dd'));

        for (const credit of activeCredits) {
            try {
                // Importar generatePaymentSchedule dinámicamente para evitar dependencias circulares
                const { generatePaymentSchedule } = await import('@/lib/utils');
                const { formatDateForUser } = await import('@/lib/date-utils');
                
                // Regenerar el plan de pagos con los días feriados actuales
                const scheduleData = generatePaymentSchedule({
                    loanAmount: credit.principalAmount,
                    monthlyInterestRate: credit.interestRate,
                    termMonths: credit.termMonths,
                    paymentFrequency: credit.paymentFrequency,
                    startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd'),
                    holidays: holidayDates
                });

                if (scheduleData && scheduleData.schedule) {
                    // Actualizar las fechas en el registro principal del crédito
                    const firstPaymentDate = scheduleData.schedule[0].paymentDate;
                    const newDueDate = scheduleData.schedule[scheduleData.schedule.length - 1].paymentDate;
                    
                    await query('UPDATE credits SET firstPaymentDate = ?, dueDate = ? WHERE id = ?', [
                        `${firstPaymentDate.split('T')[0]} 12:00:00`,
                        `${newDueDate.split('T')[0]} 12:00:00`, 
                        credit.id
                    ]);

                    // Eliminar el plan de pagos anterior
                    await query('DELETE FROM payment_plan WHERE creditId = ?', [credit.id]);

                    // Insertar el nuevo plan de pagos
                    for (const payment of scheduleData.schedule) {
                        await query(`
                            INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            credit.id,
                            payment.paymentNumber,
                            `${payment.paymentDate.split('T')[0]} 12:00:00`,
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
            targetId: 'system',
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
