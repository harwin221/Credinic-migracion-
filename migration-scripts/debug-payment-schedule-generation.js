#!/usr/bin/env node

/**
 * Script para debuggear por qué generatePaymentSchedule devuelve null para algunos créditos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

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

// Simulación simplificada de generatePaymentSchedule para debugging
function debugGeneratePaymentSchedule(data) {
    console.log('🔍 Debugging generatePaymentSchedule con datos:');
    console.table([data]);

    const loanAmount = Number(data.loanAmount);
    const monthlyInterestRate = Number(data.monthlyInterestRate);
    const termMonths = Number(data.termMonths);
    const { paymentFrequency, startDate: dateInput, holidays = [] } = data;

    console.log('\n📊 Validaciones:');
    const validations = {
        'dateInput existe': !!dateInput,
        'loanAmount válido': !isNaN(loanAmount) && loanAmount > 0,
        'interestRate válido': !isNaN(monthlyInterestRate) && monthlyInterestRate >= 0,
        'termMonths válido': !isNaN(termMonths) && termMonths > 0,
        'paymentFrequency existe': !!paymentFrequency
    };

    console.table([validations]);

    // Verificar condición de retorno null
    if (!dateInput || isNaN(loanAmount) || loanAmount <= 0 || isNaN(monthlyInterestRate) || monthlyInterestRate < 0 || isNaN(termMonths) || termMonths <= 0) {
        console.log('❌ RETORNARÍA NULL - Falló validación inicial');
        return null;
    }

    // Verificar parsing de fecha
    let initialDate;
    try {
        if (dateInput.includes('T')) {
            initialDate = new Date(dateInput);
        } else {
            initialDate = new Date(`${dateInput}T00:00:00`);
        }

        if (isNaN(initialDate.getTime())) {
            console.log('❌ RETORNARÍA NULL - Fecha inválida');
            return null;
        }

        console.log(`✅ Fecha parseada correctamente: ${initialDate.toISOString()}`);
    } catch (error) {
        console.log('❌ RETORNARÍA NULL - Error al parsear fecha:', error.message);
        return null;
    }

    // Verificar cálculo de numberOfPayments
    let numberOfPayments;
    switch (paymentFrequency) {
        case 'Diario': numberOfPayments = Math.round(termMonths * 20); break;
        case 'Semanal': numberOfPayments = Math.round(termMonths * 4); break;
        case 'Catorcenal': numberOfPayments = Math.round(termMonths * 2); break;
        case 'Quincenal': numberOfPayments = Math.round(termMonths * 2); break;
        default: 
            console.log('❌ RETORNARÍA NULL - Frecuencia de pago no reconocida');
            return null;
    }

    if (numberOfPayments <= 0) {
        console.log('❌ RETORNARÍA NULL - numberOfPayments <= 0');
        return null;
    }

    console.log(`✅ numberOfPayments calculado: ${numberOfPayments}`);
    console.log('✅ RETORNARÍA DATOS VÁLIDOS');
    
    return { success: true, numberOfPayments };
}

async function debugPaymentScheduleGeneration() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== DEBUG DE GENERACIÓN DE PLAN DE PAGOS ===');
        
        // Obtener algunos créditos activos sin plan de pagos
        console.log('🔍 Buscando créditos activos sin plan de pagos...');
        const [creditsWithoutPlan] = await newDb.execute(`
            SELECT c.id, c.creditNumber, c.clientName, c.principalAmount, c.interestRate, 
                   c.termMonths, c.paymentFrequency, c.firstPaymentDate,
                   COUNT(pp.id) as plan_count
            FROM credits c
            LEFT JOIN payment_plan pp ON c.id = pp.creditId
            WHERE c.status = 'Active'
            GROUP BY c.id
            HAVING plan_count = 0
            LIMIT 5
        `);

        console.log(`Créditos sin plan de pagos: ${creditsWithoutPlan.length}`);

        if (creditsWithoutPlan.length === 0) {
            console.log('✅ Todos los créditos activos tienen plan de pagos');
            return;
        }

        // Obtener feriados
        const [holidays] = await newDb.execute("SELECT date FROM holidays");
        const holidayDates = holidays.map(h => formatDateForUser(h.date, 'yyyy-MM-dd'));
        console.log(`\n📅 Feriados configurados: ${holidayDates.length}`);
        if (holidayDates.length > 0) {
            console.log('Feriados:', holidayDates.join(', '));
        }

        // Debuggear cada crédito
        for (const credit of creditsWithoutPlan) {
            console.log(`\n\n=== DEBUGGEANDO CRÉDITO ${credit.creditNumber} ===`);
            
            const scheduleData = debugGeneratePaymentSchedule({
                loanAmount: credit.principalAmount,
                monthlyInterestRate: credit.interestRate,
                termMonths: credit.termMonths,
                paymentFrequency: credit.paymentFrequency,
                startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd'),
                holidays: holidayDates
            });

            if (!scheduleData) {
                console.log(`❌ ${credit.creditNumber} - generatePaymentSchedule devolvería NULL`);
            } else {
                console.log(`✅ ${credit.creditNumber} - generatePaymentSchedule devolvería datos válidos`);
            }
        }

        // Comparar con un crédito que SÍ tiene plan
        console.log('\n\n=== COMPARACIÓN CON CRÉDITO QUE SÍ TIENE PLAN ===');
        const [creditsWithPlan] = await newDb.execute(`
            SELECT c.id, c.creditNumber, c.clientName, c.principalAmount, c.interestRate, 
                   c.termMonths, c.paymentFrequency, c.firstPaymentDate,
                   COUNT(pp.id) as plan_count
            FROM credits c
            LEFT JOIN payment_plan pp ON c.id = pp.creditId
            WHERE c.status = 'Active'
            GROUP BY c.id
            HAVING plan_count > 0
            LIMIT 1
        `);

        if (creditsWithPlan.length > 0) {
            const workingCredit = creditsWithPlan[0];
            console.log(`\nCrédito de referencia: ${workingCredit.creditNumber}`);
            
            debugGeneratePaymentSchedule({
                loanAmount: workingCredit.principalAmount,
                monthlyInterestRate: workingCredit.interestRate,
                termMonths: workingCredit.termMonths,
                paymentFrequency: workingCredit.paymentFrequency,
                startDate: formatDateForUser(workingCredit.firstPaymentDate, 'yyyy-MM-dd'),
                holidays: holidayDates
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    debugPaymentScheduleGeneration()
        .then(() => {
            console.log('\nDebug completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { debugPaymentScheduleGeneration };