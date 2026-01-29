#!/usr/bin/env node

/**
 * Script para investigar las tablas de plan de pagos en la base antigua
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

async function investigatePaymentPlanTables() {
    const oldDb = await createOldConnection();
    const newDb = await createNewConnection();
    
    try {
        console.log('=== INVESTIGACIÓN DE TABLAS DE PLAN DE PAGOS ===');
        
        // Obtener el legacyId del crédito CRE-000425
        const [newCredits] = await newDb.execute(`
            SELECT legacyId FROM credits WHERE creditNumber = 'CRE-000425'
        `);
        
        const legacyId = newCredits[0]?.legacyId;
        console.log(`Legacy ID del crédito CRE-000425: ${legacyId}`);

        // Investigar tabla prestamo_coutas (probablemente prestamo_cuotas)
        console.log('\n🔍 Investigando tabla prestamo_coutas:');
        try {
            const [structure1] = await oldDb.execute('DESCRIBE prestamo_coutas');
            console.log('Estructura de prestamo_coutas:');
            console.table(structure1);

            // Buscar registros para nuestro crédito
            const [records1] = await oldDb.execute(`
                SELECT * FROM prestamo_coutas 
                WHERE prestamo_id = ?
                ORDER BY numero_cuota
            `, [legacyId]);

            console.log(`Registros encontrados en prestamo_coutas: ${records1.length}`);
            if (records1.length > 0) {
                console.log('Primeros 5 registros:');
                console.table(records1.slice(0, 5));
            }
        } catch (error) {
            console.log('❌ Error al investigar prestamo_coutas:', error.message);
        }

        // Investigar tabla prestamo_cuota_abono
        console.log('\n🔍 Investigando tabla prestamo_cuota_abono:');
        try {
            const [structure2] = await oldDb.execute('DESCRIBE prestamo_cuota_abono');
            console.log('Estructura de prestamo_cuota_abono:');
            console.table(structure2);

            // Esta tabla parece ser una relación entre cuotas y abonos
            // Vamos a ver algunos registros de ejemplo
            const [records2] = await oldDb.execute(`
                SELECT * FROM prestamo_cuota_abono 
                LIMIT 5
            `);

            console.log('Muestra de registros en prestamo_cuota_abono:');
            console.table(records2);
        } catch (error) {
            console.log('❌ Error al investigar prestamo_cuota_abono:', error.message);
        }

        // Verificar si existe una tabla de cuotas específica
        console.log('\n🔍 Buscando tabla de cuotas específica...');
        try {
            // Intentar diferentes nombres posibles
            const possibleNames = ['cuotas', 'prestamo_cuotas', 'plan_pagos', 'amortizacion'];
            
            for (const tableName of possibleNames) {
                try {
                    const [exists] = await oldDb.execute(`
                        SELECT COUNT(*) as count FROM information_schema.tables 
                        WHERE table_schema = ? AND table_name = ?
                    `, [process.env.OLD_DB_DATABASE, tableName]);
                    
                    if (exists[0].count > 0) {
                        console.log(`✅ Tabla ${tableName} existe`);
                        const [structure] = await oldDb.execute(`DESCRIBE ${tableName}`);
                        console.table(structure);
                    }
                } catch (e) {
                    // Tabla no existe, continuar
                }
            }
        } catch (error) {
            console.log('❌ Error al buscar tablas de cuotas:', error.message);
        }

        // Verificar si el plan de pagos se genera dinámicamente
        console.log('\n💡 Verificando si el plan se puede calcular dinámicamente...');
        const [creditInfo] = await oldDb.execute(`
            SELECT 
                id,
                monto_prestamo,
                tasa_prestamo,
                plazo_pago,
                monto_cuota,
                fecha_primer_pago,
                forma_pago_tipo
            FROM prestamos 
            WHERE id = ?
        `, [legacyId]);

        if (creditInfo.length > 0) {
            console.log('Información del crédito para calcular plan:');
            console.table(creditInfo);
            
            const credit = creditInfo[0];
            console.log('\n📊 Datos para generar plan de pagos:');
            console.log(`- Monto: ${credit.monto_prestamo}`);
            console.log(`- Tasa: ${credit.tasa_prestamo}%`);
            console.log(`- Plazo: ${credit.plazo_pago} meses`);
            console.log(`- Cuota: ${credit.monto_cuota}`);
            console.log(`- Primera cuota: ${credit.fecha_primer_pago}`);
            console.log(`- Tipo de pago: ${credit.forma_pago_tipo}`);
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
    investigatePaymentPlanTables()
        .then(() => {
            console.log('Investigación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { investigatePaymentPlanTables };