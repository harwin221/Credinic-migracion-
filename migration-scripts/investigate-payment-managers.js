#!/usr/bin/env node

/**
 * Script para investigar los gestores reales de los pagos
 * y corregir el campo managedBy con los nombres correctos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const SIMULATION_MODE = process.argv.includes('--simulate');

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

async function investigatePaymentManagers() {
    const oldDb = await createOldConnection();
    const newDb = await createNewConnection();
    
    try {
        console.log('=== INVESTIGACIÓN DE GESTORES DE PAGOS ===');
        console.log(`Modo: ${SIMULATION_MODE ? 'SIMULACIÓN' : 'EJECUCIÓN REAL'}`);
        console.log('');

        // Obtener información de la base de datos antigua
        console.log('📊 Analizando estructura de pagos en base de datos antigua...');
        
        const [oldPayments] = await oldDb.execute(`
            SELECT 
                id, 
                prestamo_id, 
                created_user_id, 
                fecha_abono, 
                total_efectivo,
                estado
            FROM abonos 
            LIMIT 10
        `);

        console.log('Muestra de pagos antiguos:');
        console.table(oldPayments);

        // Obtener información de usuarios antiguos
        console.log('\n👥 Analizando usuarios que crearon pagos...');
        
        const [userStats] = await oldDb.execute(`
            SELECT 
                u.id,
                u.nombres,
                u.apellidos,
                u.tipo_usuario,
                COUNT(a.id) as total_pagos
            FROM users u
            LEFT JOIN abonos a ON u.id = a.created_user_id
            WHERE a.id IS NOT NULL
            GROUP BY u.id, u.nombres, u.apellidos, u.tipo_usuario
            ORDER BY total_pagos DESC
        `);

        console.log('Usuarios que crearon pagos:');
        console.table(userStats);

        // Verificar si podemos mapear los gestores correctamente
        console.log('\n🔍 Verificando mapeo actual en base nueva...');
        
        const [currentPayments] = await newDb.execute(`
            SELECT 
                managedBy,
                COUNT(*) as cantidad
            FROM payments_registered 
            GROUP BY managedBy
            ORDER BY cantidad DESC
        `);

        console.log('Gestores actuales en base nueva:');
        console.table(currentPayments);

        // Proponer corrección
        console.log('\n💡 PROPUESTA DE CORRECCIÓN:');
        
        if (userStats.length > 0) {
            console.log('Se pueden mapear los pagos a los siguientes gestores reales:');
            userStats.forEach(user => {
                const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
                console.log(`  - ${fullName} (${user.total_pagos} pagos)`);
            });
            
            console.log('\n¿Deseas proceder con la corrección? (Ejecuta sin --simulate)');
        } else {
            console.log('❌ No se encontraron usuarios que hayan creado pagos en la base antigua.');
        }

    } catch (error) {
        console.error('Error durante la investigación:', error);
        throw error;
    } finally {
        await oldDb.end();
        await newDb.end();
    }
}

async function fixPaymentManagers() {
    const oldDb = await createOldConnection();
    const newDb = await createNewConnection();
    
    try {
        console.log('=== CORRECCIÓN DE GESTORES DE PAGOS ===');
        console.log(`Modo: ${SIMULATION_MODE ? 'SIMULACIÓN' : 'EJECUCIÓN REAL'}`);
        console.log('');

        // Crear mapeo de usuarios antiguos a nombres
        const [oldUsers] = await oldDb.execute(`
            SELECT id, nombres, apellidos, tipo_usuario
            FROM users
        `);

        const userNameMap = {};
        oldUsers.forEach(user => {
            const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
            userNameMap[user.id] = fullName || `Usuario ${user.id}`;
        });

        console.log(`📋 Mapeando ${Object.keys(userNameMap).length} usuarios antiguos...`);

        // Obtener pagos antiguos con sus creadores
        const [oldPayments] = await oldDb.execute(`
            SELECT id, created_user_id, prestamo_id
            FROM abonos
        `);

        console.log(`💰 Procesando ${oldPayments.length} pagos antiguos...`);

        let updatedCount = 0;
        let notFoundCount = 0;

        for (const oldPayment of oldPayments) {
            // Buscar el pago en la nueva base usando legacyId
            const [newPayments] = await newDb.execute(`
                SELECT id, managedBy 
                FROM payments_registered 
                WHERE legacyId = ?
            `, [oldPayment.id]);

            if (newPayments.length > 0) {
                const newPayment = newPayments[0];
                const realManagerName = userNameMap[oldPayment.created_user_id];

                if (realManagerName && realManagerName !== 'Administrador Administrador') {
                    console.log(`  [${SIMULATION_MODE ? 'SIM' : 'REAL'}] Actualizando pago ${newPayment.id}: "${newPayment.managedBy}" -> "${realManagerName}"`);
                    
                    if (!SIMULATION_MODE) {
                        await newDb.execute(
                            'UPDATE payments_registered SET managedBy = ? WHERE id = ?',
                            [realManagerName, newPayment.id]
                        );
                    }
                    updatedCount++;
                } else {
                    // Mantener "Administrador Administrador" si no se encuentra el usuario
                    notFoundCount++;
                }
            }
        }

        console.log('');
        console.log('=== RESUMEN ===');
        console.log(`Pagos actualizados con gestores reales: ${updatedCount}`);
        console.log(`Pagos que mantienen "Administrador": ${notFoundCount}`);
        console.log(`Total procesados: ${oldPayments.length}`);

        if (SIMULATION_MODE) {
            console.log('');
            console.log('NOTA: Este fue un modo de simulación. Para ejecutar los cambios reales, ejecuta:');
            console.log('node migration-scripts/investigate-payment-managers.js fix');
        }

    } catch (error) {
        console.error('Error durante la corrección:', error);
        throw error;
    } finally {
        await oldDb.end();
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    const action = process.argv[2];
    
    if (action === 'fix') {
        fixPaymentManagers()
            .then(() => {
                console.log('Corrección completada exitosamente.');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Error fatal:', error);
                process.exit(1);
            });
    } else {
        investigatePaymentManagers()
            .then(() => {
                console.log('Investigación completada exitosamente.');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Error fatal:', error);
                process.exit(1);
            });
    }
}

module.exports = { investigatePaymentManagers, fixPaymentManagers };