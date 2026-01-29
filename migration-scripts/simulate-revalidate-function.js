#!/usr/bin/env node

/**
 * Script para simular exactamente lo que hace revalidateActiveCreditsStatus
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

// Importar la lógica real de generatePaymentSchedule (simplificada)
function simulateGeneratePaymentSchedule(data) {
    const loanAmount = Number(data.loanAmount);
    const monthlyInterestRate = Number(data.monthlyInterestRate);
    const termMonths = Number(data.termMonths);
    let { paymentFrequency, startDate: dateInput, holidays = [] } = data;

    // Validaciones iniciales (igual que en el código real)
    if (!dateInput || isNaN(loanAmount) || loanAmount <= 0 || isNaN(monthlyInterestRate) || monthlyInterestRate < 0 || isNaN(termMonths) || termMonths <= 0) {
        return null;
    }

    // Parsing de fecha (igual que en el código real)
    let initialDate;
    try {
        if (dateInput.includes('T')) {
            initialDate = new Date(dateInput);
        } else {
            initialDate = new Date(`${dateInput}T00:00:00`);
        }

        if (isNaN(initialDate.getTime())) return null;
    } catch (error) {
        console.error('Error parsing date in generatePaymentSchedule:', error);
        return null;
    }

    // Cálculo de numberOfPayments (igual que en el código real)
    let numberOfPayments;
    switch (paymentFrequency) {
        case 'Diario': numberOfPayments = Math.round(termMonths * 20); break;
        case 'Semanal': numberOfPayments = Math.round(termMonths * 4); break;
        case 'Catorcenal': numberOfPayments = Math.round(termMonths * 2); break;
        case 'Quincenal': numberOfPayments = Math.round(termMonths * 2); break;
        default: return null;
    }

    if (numberOfPayments <= 0) return null;

    // Simular cálculos básicos
    const totalInterest = loanAmount * (monthlyInterestRate / 100) * termMonths;
    const totalPayment = loanAmount + totalInterest;
    const periodicPayment = totalPayment / numberOfPayments;
    const periodicInterest = totalInterest / numberOfPayments;
    const periodicPrincipal = loanAmount / numberOfPayments;

    // Simular schedule básico
    const schedule = [];
    let remainingBalance = totalPayment;

    for (let i = 1; i <= numberOfPayments; i++) {
        remainingBalance -= periodicPayment;
        
        // Simular fecha (sin lógica compleja de feriados)
        const paymentDate = new Date(initialDate);
        paymentDate.setDate(paymentDate.getDate() + (i - 1) * 7); // Aproximación semanal
        
        schedule.push({
            id: `payment_${i}`,
            creditId: 'calc',
            paymentNumber: i,
            paymentDate: paymentDate.toISOString().split('T')[0],
            amount: periodicPayment,
            principal: periodicPrincipal,
            interest: periodicInterest,
            balance: Math.max(0, remainingBalance),
        });
    }

    return { schedule };
}

async function simulateRevalidateFunction() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== SIMULACIÓN DE revalidateActiveCreditsStatus ===');
        
        // Paso 1: Obtener créditos activos (igual que en el código real)
        console.log('📋 Obteniendo créditos activos...');
        const [activeCredits] = await newDb.execute("SELECT * FROM credits WHERE status = 'Active'");
        console.log(`Créditos activos encontrados: ${activeCredits.length}`);

        // Paso 2: Obtener feriados (igual que en el código real)
        console.log('\n📅 Obteniendo feriados...');
        const [holidays] = await newDb.execute("SELECT date FROM holidays");
        const holidayDates = holidays.map(h => formatDateForUser(h.date, 'yyyy-MM-dd'));
        console.log(`Feriados configurados: ${holidayDates.length}`);

        let updatedCount = 0;
        let failedCount = 0;
        const failedCredits = [];

        // Paso 3: Procesar cada crédito (igual que en el código real)
        console.log('\n🔄 Procesando cada crédito...');
        
        for (const credit of activeCredits.slice(0, 10)) { // Limitar a 10 para testing
            console.log(`\n--- Procesando ${credit.creditNumber} ---`);
            
            // Verificar si ya tiene plan de pagos
            const [existingPlan] = await newDb.execute(
                'SELECT COUNT(*) as count FROM payment_plan WHERE creditId = ?', 
                [credit.id]
            );
            
            console.log(`Plan existente: ${existingPlan[0].count} registros`);

            const scheduleData = simulateGeneratePaymentSchedule({
                loanAmount: credit.principalAmount,
                monthlyInterestRate: credit.interestRate,
                termMonths: credit.termMonths,
                paymentFrequency: credit.paymentFrequency,
                startDate: formatDateForUser(credit.firstPaymentDate, 'yyyy-MM-dd'),
                holidays: holidayDates
            });

            if (scheduleData) {
                console.log(`✅ ${credit.creditNumber} - generatePaymentSchedule devolvió datos válidos`);
                console.log(`   Cuotas generadas: ${scheduleData.schedule.length}`);
                
                // SIMULAR la inserción (sin ejecutar realmente)
                console.log(`   [SIMULACIÓN] Borraría ${existingPlan[0].count} registros existentes`);
                console.log(`   [SIMULACIÓN] Insertaría ${scheduleData.schedule.length} nuevos registros`);
                
                updatedCount++;
            } else {
                console.log(`❌ ${credit.creditNumber} - generatePaymentSchedule devolvió NULL`);
                failedCount++;
                failedCredits.push({
                    creditNumber: credit.creditNumber,
                    principalAmount: credit.principalAmount,
                    interestRate: credit.interestRate,
                    termMonths: credit.termMonths,
                    paymentFrequency: credit.paymentFrequency,
                    firstPaymentDate: credit.firstPaymentDate
                });
            }
        }

        console.log('\n=== RESUMEN DE SIMULACIÓN ===');
        console.log(`Créditos que se actualizarían: ${updatedCount}`);
        console.log(`Créditos que fallarían: ${failedCount}`);
        
        if (failedCredits.length > 0) {
            console.log('\n❌ Créditos que fallarían:');
            console.table(failedCredits);
        }

        // Verificar créditos sin plan después de la simulación
        console.log('\n🔍 Verificando créditos sin plan de pagos...');
        const [creditsWithoutPlan] = await newDb.execute(`
            SELECT c.creditNumber, COUNT(pp.id) as plan_count
            FROM credits c
            LEFT JOIN payment_plan pp ON c.id = pp.creditId
            WHERE c.status = 'Active'
            GROUP BY c.id, c.creditNumber
            HAVING plan_count = 0
            ORDER BY c.creditNumber
        `);

        console.log(`Créditos activos sin plan de pagos: ${creditsWithoutPlan.length}`);
        if (creditsWithoutPlan.length > 0) {
            console.log('Lista de créditos sin plan:');
            creditsWithoutPlan.forEach(c => console.log(`  - ${c.creditNumber}`));
        }

    } catch (error) {
        console.error('Error en simulación:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    simulateRevalidateFunction()
        .then(() => {
            console.log('\nSimulación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { simulateRevalidateFunction };