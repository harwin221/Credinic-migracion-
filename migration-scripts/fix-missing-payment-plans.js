#!/usr/bin/env node

/**
 * Script para regenerar específicamente los planes de pago faltantes
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const SIMULATION_MODE = process.argv.includes('--simulate');

async function createNewConnection() {
    return await mysql.createConnection({
        host: process.env.NEW_DB_HOST || 'localhost',
        user: process.env.NEW_DB_USER || 'root',
        password: process.env.NEW_DB_PASSWORD || '',
        database: process.env.NEW_DB_DATABASE || 'harrue9_credinica',
        timezone: '+00:00'
    });
}

function formatDateForUser(date, format = 'dd/MM/yyyy') {
    if (!date) return '';
    
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        if (format === 'yyyy-MM-dd') {
            return d.toISOString().split('T')[0];
        }
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (error) {
        return '';
    }
}

// Función simplificada para generar plan de pagos
function generateBasicPaymentSchedule(data) {
    const loanAmount = Number(data.loanAmount);
    const monthlyInterestRate = Number(data.monthlyInterestRate);
    const termMonths = Number(data.termMonths);
    let { paymentFrequency, startDate: dateInput } = data;

    // Validaciones
    if (!dateInput || isNaN(loanAmount) || loanAmount <= 0 || isNaN(monthlyInterestRate) || monthlyInterestRate < 0 || isNaN(termMonths) || termMonths <= 0) {
        return null;
    }

    // Parsing de fecha
    let initialDate;
    try {
        if (dateInput.includes('T')) {
            initialDate = new Date(dateInput);
        } else {
            initialDate = new Date(`${dateInput}T12:00:00`); // Usar mediodía
        }
        if (isNaN(initialDate.getTime())) return null;
    } catch (error) {
        return null;
    }

    // Cálculo de numberOfPayments
    let numberOfPayments;
    let daysBetweenPayments;
    
    switch (paymentFrequency) {
        case 'Diario': 
            numberOfPayments = Math.round(termMonths * 20); 
            daysBetweenPayments = 1;
            break;
        case 'Semanal': 
            numberOfPayments = Math.round(termMonths * 4); 
            daysBetweenPayments = 7;
            break;
        case 'Catorcenal': 
            numberOfPayments = Math.round(termMonths * 2); 
            daysBetweenPayments = 14;
            break;
        case 'Quincenal': 
            numberOfPayments = Math.round(termMonths * 2); 
            daysBetweenPayments = 15;
            break;
        default: return null;
    }

    if (numberOfPayments <= 0) return null;

    // Cálculos financieros básicos
    const totalInterest = loanAmount * (monthlyInterestRate / 100) * termMonths;
    const totalPayment = loanAmount + totalInterest;
    const periodicPayment = totalPayment / numberOfPayments;
    const periodicInterest = totalInterest / numberOfPayments;
    const periodicPrincipal = loanAmount / numberOfPayments;

    // Generar schedule
    const schedule = [];
    let remainingBalance = totalPayment;
    let currentDate = new Date(initialDate);

    for (let i = 1; i <= numberOfPayments; i++) {
        remainingBalance -= periodicPayment;
        
        schedule.push({
            paymentNumber: i,
            paymentDate: currentDate.toISOString().split('T')[0],
            amount: Math.round(periodicPayment * 100) / 100, // Redondear a 2 decimales
            principal: Math.round(periodicPrincipal * 100) / 100,
            interest: Math.round(periodicInterest * 100) / 100,
            balance: Math.max(0, Math.round(remainingBalance * 100) / 100),
        });

        // Avanzar fecha para siguiente pago
        if (paymentFrequency === 'Quincenal') {
            // Lógica especial para quincenal (15 y 30/31 de cada mes)
            if (currentDate.getDate() <= 15) {
                currentDate.setDate(30);
                if (currentDate.getDate() !== 30) { // Si el mes no tiene 30, usar el último día
                    currentDate.setDate(0); // Último día del mes anterior
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(15);
            }
        } else {
            currentDate.setDate(currentDate.getDate() + daysBetweenPayments);
        }
    }

    return { schedule };
}

async function fixMissingPaymentPlans() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== REPARACIÓN DE PLANES DE PAGO FALTANTES ===');
        console.log(`Modo: ${SIMULATION_MODE ? 'SIMULACIÓN' : 'EJECUCIÓN REAL'}`);
        
        // Obtener créditos sin plan de pagos
        console.log('🔍 Buscando créditos activos sin plan de pagos...');
        const [creditsWithoutPlan] = await newDb.execute(`
            SELECT c.*
            FROM credits c
            LEFT JOIN payment_plan pp ON c.id = pp.creditId
            WHERE c.status = 'Active'
            GROUP BY c.id
            HAVING COUNT(pp.id) = 0
            ORDER BY c.creditNumber
        `);

        console.log(`Créditos sin plan encontrados: ${creditsWithoutPlan.length}`);

        if (creditsWithoutPlan.length === 0) {
            console.log('✅ Todos los créditos activos ya tienen plan de pagos');
            return;
        }

        let successCount = 0;
        let failedCount = 0;
        const failedCredits = [];

        // Procesar cada crédito
        for (const credit of creditsWithoutPlan) {
            console.log(`\n--- Procesando ${credit.creditNumber} ---`);
            
            const scheduleData = generateBasicPaymentSchedule({
                loanAmount: credit.principalAmount,
                monthlyInterestRate: credit.interestRate,
                termMonths: credit.termMonths,
                paymentFrequency: credit.paymentFrequency,
                startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd')
            });

            if (scheduleData && scheduleData.schedule.length > 0) {
                console.log(`✅ Plan generado: ${scheduleData.schedule.length} cuotas`);
                
                if (!SIMULATION_MODE) {
                    try {
                        // Insertar plan de pagos
                        for (const payment of scheduleData.schedule) {
                            await newDb.execute(
                                'INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [
                                    credit.id,
                                    payment.paymentNumber,
                                    `${payment.paymentDate} 12:00:00`,
                                    payment.amount,
                                    payment.principal,
                                    payment.interest,
                                    payment.balance
                                ]
                            );
                        }

                        // Actualizar fecha de vencimiento
                        const lastPayment = scheduleData.schedule[scheduleData.schedule.length - 1];
                        await newDb.execute(
                            'UPDATE credits SET dueDate = ? WHERE id = ?',
                            [`${lastPayment.paymentDate} 12:00:00`, credit.id]
                        );

                        console.log(`✅ Plan insertado en base de datos`);
                        successCount++;
                    } catch (error) {
                        console.log(`❌ Error al insertar: ${error.message}`);
                        failedCount++;
                        failedCredits.push(credit.creditNumber);
                    }
                } else {
                    console.log(`[SIMULACIÓN] Se insertarían ${scheduleData.schedule.length} registros`);
                    successCount++;
                }
            } else {
                console.log(`❌ No se pudo generar plan de pagos`);
                failedCount++;
                failedCredits.push(credit.creditNumber);
            }
        }

        console.log('\n=== RESUMEN ===');
        console.log(`Créditos procesados exitosamente: ${successCount}`);
        console.log(`Créditos que fallaron: ${failedCount}`);
        
        if (failedCredits.length > 0) {
            console.log('Créditos que fallaron:', failedCredits.join(', '));
        }

        if (SIMULATION_MODE) {
            console.log('\n💡 Para ejecutar los cambios reales, ejecuta:');
            console.log('node migration-scripts/fix-missing-payment-plans.js');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    fixMissingPaymentPlans()
        .then(() => {
            console.log('Script completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { fixMissingPaymentPlans };