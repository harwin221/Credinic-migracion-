#!/usr/bin/env node

/**
 * Script para verificar los detalles del crédito CRE-000425 y por qué no tiene plan de pagos
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

async function checkCredit425Details() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== ANÁLISIS DETALLADO DEL CRÉDITO CRE-000425 ===');
        
        // Obtener todos los datos del crédito
        const [credit] = await newDb.execute(`
            SELECT * FROM credits 
            WHERE creditNumber = 'CRE-000425'
        `);

        if (credit.length === 0) {
            console.log('❌ Crédito no encontrado');
            return;
        }

        const creditData = credit[0];
        console.log('📋 Datos completos del crédito:');
        console.table([creditData]);

        // Verificar datos necesarios para generar plan de pagos
        console.log('\n🔍 Verificando datos necesarios para generar plan de pagos:');
        const requiredFields = {
            'principalAmount': creditData.principalAmount,
            'interestRate': creditData.interestRate,
            'termMonths': creditData.termMonths,
            'paymentFrequency': creditData.paymentFrequency,
            'firstPaymentDate': creditData.firstPaymentDate
        };

        console.table([requiredFields]);

        // Verificar si algún campo está vacío o es null
        const missingFields = [];
        Object.entries(requiredFields).forEach(([field, value]) => {
            if (value === null || value === undefined || value === '' || value === 0) {
                missingFields.push(field);
            }
        });

        if (missingFields.length > 0) {
            console.log('\n❌ Campos faltantes o inválidos:');
            console.log(missingFields.join(', '));
        } else {
            console.log('\n✅ Todos los campos necesarios están presentes');
        }

        // Verificar si existe plan de pagos
        console.log('\n📊 Verificando plan de pagos existente...');
        const [paymentPlan] = await newDb.execute(`
            SELECT COUNT(*) as count FROM payment_plan 
            WHERE creditId = ?
        `, [creditData.id]);

        console.log(`Plan de pagos existente: ${paymentPlan[0].count} registros`);

        // Verificar feriados (necesarios para el cálculo)
        console.log('\n📅 Verificando feriados configurados...');
        const [holidays] = await newDb.execute(`
            SELECT COUNT(*) as count FROM holidays
        `);

        console.log(`Feriados configurados: ${holidays[0].count}`);

        // Simular el cálculo del plan de pagos
        console.log('\n🧮 Datos para simular cálculo del plan:');
        const simulationData = {
            loanAmount: parseFloat(creditData.principalAmount || 0),
            monthlyInterestRate: parseFloat(creditData.interestRate || 0),
            termMonths: parseInt(creditData.termMonths || 0),
            paymentFrequency: creditData.paymentFrequency,
            startDate: creditData.firstPaymentDate ? new Date(creditData.firstPaymentDate).toISOString().split('T')[0] : null
        };

        console.table([simulationData]);

        // Verificar si los valores son válidos para el cálculo
        const validationIssues = [];
        if (simulationData.loanAmount <= 0) validationIssues.push('Monto del préstamo debe ser mayor a 0');
        if (simulationData.monthlyInterestRate <= 0) validationIssues.push('Tasa de interés debe ser mayor a 0');
        if (simulationData.termMonths <= 0) validationIssues.push('Plazo debe ser mayor a 0');
        if (!simulationData.startDate) validationIssues.push('Fecha de primer pago es requerida');
        if (!simulationData.paymentFrequency) validationIssues.push('Frecuencia de pago es requerida');

        if (validationIssues.length > 0) {
            console.log('\n❌ Problemas de validación:');
            validationIssues.forEach(issue => console.log(`  - ${issue}`));
        } else {
            console.log('\n✅ Datos válidos para generar plan de pagos');
        }

        // Comparar con un crédito que SÍ tiene plan de pagos
        console.log('\n🔍 Comparando con crédito que SÍ tiene plan de pagos...');
        const [workingCredit] = await newDb.execute(`
            SELECT c.*, COUNT(pp.id) as plan_count
            FROM credits c
            LEFT JOIN payment_plan pp ON c.id = pp.creditId
            WHERE c.status = 'Active'
            GROUP BY c.id
            HAVING plan_count > 0
            LIMIT 1
        `);

        if (workingCredit.length > 0) {
            console.log('Crédito de referencia (con plan de pagos):');
            const refCredit = workingCredit[0];
            const refData = {
                creditNumber: refCredit.creditNumber,
                principalAmount: refCredit.principalAmount,
                interestRate: refCredit.interestRate,
                termMonths: refCredit.termMonths,
                paymentFrequency: refCredit.paymentFrequency,
                firstPaymentDate: refCredit.firstPaymentDate,
                plan_count: refCredit.plan_count
            };
            console.table([refData]);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkCredit425Details()
        .then(() => {
            console.log('Análisis completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkCredit425Details };