#!/usr/bin/env node

/**
 * Script para verificar el plan de pagos en la base de datos antigua
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function createOldConnection() {
    return await mysql.createConnection({
        host: process.env.OLD_DB_HOST || 'localhost',
        user: process.env.OLD_DB_USER || 'root',
        password: process.env.OLD_DB_PASSWORD || '',
        database: process.env.OLD_DB_DATABASE || 'harrue0_baseantigua',
        timezone: '+00:00'
    });
}

async function createNewConnection() {
    return await mysql.createConnection({
        host: process.env.NEW_DB_HOST || 'localhost',
        user: process.env.NEW_DB_USER || 'root',
        password: process.env.NEW_DB_PASSWORD || '',
        database: process.env.NEW_DB_DATABASE || 'harrue9_credinica',
        timezone: '+00:00'
    });
}

async function checkOldPaymentPlan() {
    const oldDb = await createOldConnection();
    const newDb = await createNewConnection();
    
    try {
        console.log('=== VERIFICACIÓN DEL PLAN DE PAGOS EN BASE ANTIGUA ===');
        
        // Primero encontrar el crédito en la base nueva para obtener su legacyId
        console.log('🔍 Buscando crédito CRE-000425 en base nueva...');
        const [newCredits] = await newDb.execute(`
            SELECT id, creditNumber, legacyId, clientName, status, totalAmount
            FROM credits 
            WHERE creditNumber = 'CRE-000425'
        `);

        if (newCredits.length === 0) {
            console.log('❌ No se encontró el crédito CRE-000425 en la base nueva');
            return;
        }

        const newCredit = newCredits[0];
        console.log('✅ Crédito encontrado en base nueva:');
        console.table([newCredit]);

        if (!newCredit.legacyId) {
            console.log('❌ El crédito no tiene legacyId, no se puede buscar en la base antigua');
            return;
        }

        // Buscar el crédito en la base antigua
        console.log(`\n🔍 Buscando crédito con ID ${newCredit.legacyId} en base antigua...`);
        const [oldCredits] = await oldDb.execute(`
            SELECT id, monto_prestamo, plazo_pago, monto_cuota, fecha_primer_pago
            FROM prestamos 
            WHERE id = ?
        `, [newCredit.legacyId]);

        if (oldCredits.length === 0) {
            console.log('❌ No se encontró el crédito en la base antigua');
            return;
        }

        const oldCredit = oldCredits[0];
        console.log('✅ Crédito encontrado en base antigua:');
        console.table([oldCredit]);

        // Verificar si existe tabla de plan de pagos en la base antigua
        console.log('\n🏗️ Verificando tablas relacionadas con plan de pagos en base antigua...');
        const [tables] = await oldDb.execute(`
            SHOW TABLES LIKE '%plan%'
        `);
        console.log('Tablas que contienen "plan":');
        console.table(tables);

        // Buscar tablas que podrían contener el plan de pagos
        const [allTables] = await oldDb.execute('SHOW TABLES');
        console.log('\n📋 Todas las tablas en la base antigua:');
        const tableNames = allTables.map(t => Object.values(t)[0]);
        console.log(tableNames.join(', '));

        // Buscar tablas relacionadas con cuotas o pagos
        const paymentRelatedTables = tableNames.filter(name => 
            name.toLowerCase().includes('cuota') || 
            name.toLowerCase().includes('pago') || 
            name.toLowerCase().includes('plan') ||
            name.toLowerCase().includes('amortiz')
        );

        if (paymentRelatedTables.length > 0) {
            console.log('\n💰 Tablas relacionadas con pagos/cuotas:');
            console.log(paymentRelatedTables.join(', '));

            // Verificar cada tabla
            for (const tableName of paymentRelatedTables) {
                try {
                    console.log(`\n🔍 Verificando tabla ${tableName}:`);
                    const [structure] = await oldDb.execute(`DESCRIBE ${tableName}`);
                    console.table(structure);

                    // Buscar registros relacionados con nuestro crédito
                    const [records] = await oldDb.execute(`
                        SELECT * FROM ${tableName} 
                        WHERE prestamo_id = ? OR id = ?
                        LIMIT 5
                    `, [newCredit.legacyId, newCredit.legacyId]);

                    if (records.length > 0) {
                        console.log(`✅ Encontrados ${records.length} registros en ${tableName}:`);
                        console.table(records);
                    } else {
                        console.log(`❌ No se encontraron registros en ${tableName}`);
                    }
                } catch (error) {
                    console.log(`❌ Error al verificar tabla ${tableName}:`, error.message);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await oldDb.end();
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkOldPaymentPlan()
        .then(() => {
            console.log('Verificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkOldPaymentPlan };