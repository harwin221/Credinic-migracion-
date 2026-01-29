#!/usr/bin/env node

/**
 * Script para corregir el campo managedBy en payments_registered
 * Cambia los IDs de usuario por los nombres completos de los usuarios
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const SIMULATION_MODE = process.argv.includes('--simulate');

async function createConnection() {
    return await mysql.createConnection({
        host: process.env.NEW_DB_HOST || 'localhost',
        user: process.env.NEW_DB_USER || 'root',
        password: process.env.NEW_DB_PASSWORD || '',
        database: process.env.NEW_DB_DATABASE || 'harrue9_credinica',
        timezone: '+00:00'
    });
}

async function fixPaymentManagedBy() {
    const connection = await createConnection();
    
    try {
        console.log('=== CORRECCIÓN DE CAMPO managedBy EN PAGOS ===');
        console.log(`Modo: ${SIMULATION_MODE ? 'SIMULACIÓN' : 'EJECUCIÓN REAL'}`);
        console.log('');

        // Obtener todos los pagos que tienen managedBy como ID de usuario
        const [payments] = await connection.execute(`
            SELECT pr.id, pr.managedBy, u.fullName 
            FROM payments_registered pr
            LEFT JOIN users u ON pr.managedBy = u.id
            WHERE pr.managedBy LIKE 'user_%'
        `);

        console.log(`Encontrados ${payments.length} pagos con managedBy como ID de usuario`);
        
        if (payments.length === 0) {
            console.log('No hay pagos que corregir.');
            return;
        }

        let updatedCount = 0;
        let notFoundCount = 0;

        for (const payment of payments) {
            if (payment.fullName) {
                console.log(`  [${SIMULATION_MODE ? 'SIM' : 'REAL'}] Actualizando pago ${payment.id}: "${payment.managedBy}" -> "${payment.fullName}"`);
                
                if (!SIMULATION_MODE) {
                    await connection.execute(
                        'UPDATE payments_registered SET managedBy = ? WHERE id = ?',
                        [payment.fullName, payment.id]
                    );
                }
                updatedCount++;
            } else {
                console.log(`  [AVISO] No se encontró usuario para ID: ${payment.managedBy} en pago ${payment.id}`);
                notFoundCount++;
            }
        }

        console.log('');
        console.log('=== RESUMEN ===');
        console.log(`Pagos actualizados: ${updatedCount}`);
        console.log(`Pagos sin usuario encontrado: ${notFoundCount}`);
        console.log(`Total procesados: ${payments.length}`);

        if (SIMULATION_MODE) {
            console.log('');
            console.log('NOTA: Este fue un modo de simulación. Para ejecutar los cambios reales, ejecuta:');
            console.log('node migration-scripts/fix-payment-managed-by.js');
        }

    } catch (error) {
        console.error('Error durante la corrección:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    fixPaymentManagedBy()
        .then(() => {
            console.log('Corrección completada exitosamente.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { fixPaymentManagedBy };