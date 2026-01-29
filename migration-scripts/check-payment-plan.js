#!/usr/bin/env node

/**
 * Script para verificar el plan de pagos de un crédito específico
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

async function checkPaymentPlan() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== VERIFICACIÓN DEL PLAN DE PAGOS ===');
        
        // Buscar el crédito CRE-000425
        console.log('🔍 Buscando crédito CRE-000425...');
        const [credits] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, totalAmount
            FROM credits 
            WHERE creditNumber = 'CRE-000425'
        `);

        if (credits.length === 0) {
            console.log('❌ No se encontró el crédito CRE-000425');
            return;
        }

        const credit = credits[0];
        console.log('✅ Crédito encontrado:');
        console.table([credit]);

        // Verificar si existe plan de pagos
        console.log('\n📋 Verificando plan de pagos...');
        const [paymentPlan] = await newDb.execute(`
            SELECT * FROM payment_plan 
            WHERE creditId = ? 
            ORDER BY paymentNumber
        `, [credit.id]);

        console.log(`Plan de pagos encontrado: ${paymentPlan.length} registros`);
        
        if (paymentPlan.length > 0) {
            console.log('Primeros 5 registros del plan:');
            console.table(paymentPlan.slice(0, 5));
            
            console.log('\nÚltimos 5 registros del plan:');
            console.table(paymentPlan.slice(-5));
        } else {
            console.log('❌ No se encontró plan de pagos para este crédito');
        }

        // Verificar estructura de la tabla payment_plan
        console.log('\n🏗️ Estructura de la tabla payment_plan:');
        const [structure] = await newDb.execute('DESCRIBE payment_plan');
        console.table(structure);

        // Verificar si hay algún plan de pagos en la tabla
        console.log('\n📊 Estadísticas generales de payment_plan:');
        const [stats] = await newDb.execute(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT creditId) as unique_credits,
                MIN(paymentNumber) as min_payment_number,
                MAX(paymentNumber) as max_payment_number
            FROM payment_plan
        `);
        console.table(stats);

        // Verificar algunos créditos que sí tienen plan de pagos
        console.log('\n🔍 Créditos con plan de pagos (muestra):');
        const [creditsWithPlan] = await newDb.execute(`
            SELECT c.creditNumber, c.clientName, COUNT(pp.id) as plan_records
            FROM credits c
            INNER JOIN payment_plan pp ON c.id = pp.creditId
            GROUP BY c.id, c.creditNumber, c.clientName
            ORDER BY plan_records DESC
            LIMIT 5
        `);
        console.table(creditsWithPlan);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkPaymentPlan()
        .then(() => {
            console.log('Verificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkPaymentPlan };