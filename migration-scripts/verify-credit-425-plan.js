#!/usr/bin/env node

/**
 * Script para verificar que el crédito CRE-000425 tenga su plan de pagos
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

async function verifyCreditPlan() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== VERIFICACIÓN DEL CRÉDITO CRE-000425 ===');
        
        // Buscar el crédito CRE-000425
        const [credit] = await newDb.execute(
            'SELECT * FROM credits WHERE creditNumber = ?', 
            ['CRE-000425']
        );
        
        if (credit.length === 0) {
            console.log('❌ Crédito CRE-000425 no encontrado');
            return;
        }
        
        console.log('✅ Crédito CRE-000425 encontrado:');
        console.log(`   ID: ${credit[0].id}`);
        console.log(`   Cliente: ${credit[0].clientName}`);
        console.log(`   Monto: ${credit[0].amount}`);
        console.log(`   Estado: ${credit[0].status}`);
        console.log(`   Gestor: ${credit[0].collectionsManager}`);
        
        // Buscar el plan de pagos
        const [paymentPlan] = await newDb.execute(
            'SELECT * FROM payment_plan WHERE creditId = ? ORDER BY paymentNumber', 
            [credit[0].id]
        );
        
        if (paymentPlan.length === 0) {
            console.log('❌ Plan de pagos no encontrado para CRE-000425');
        } else {
            console.log(`✅ Plan de pagos encontrado: ${paymentPlan.length} cuotas`);
            console.log('   Primeras 3 cuotas:');
            console.table(paymentPlan.slice(0, 3).map(p => ({
                Cuota: p.paymentNumber,
                Fecha: p.paymentDate.toISOString().split('T')[0],
                Monto: p.amount,
                Capital: p.principal,
                Interés: p.interest,
                Saldo: p.balance
            })));
        }
        
        // Verificar pagos registrados
        const [payments] = await newDb.execute(
            'SELECT * FROM payments_registered WHERE creditId = ? ORDER BY paymentDate', 
            [credit[0].id]
        );
        
        console.log(`✅ Pagos registrados: ${payments.length}`);
        if (payments.length > 0) {
            console.log('   Últimos 3 pagos:');
            console.table(payments.slice(-3).map(p => ({
                Fecha: p.paymentDate.toISOString().split('T')[0],
                Monto: p.amount,
                Gestor: p.managedBy,
                Estado: p.status
            })));
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    verifyCreditPlan()
        .then(() => {
            console.log('\nVerificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { verifyCreditPlan };