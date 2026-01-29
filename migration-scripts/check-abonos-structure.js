#!/usr/bin/env node

/**
 * Script para verificar la estructura de la tabla abonos en la base de datos antigua
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

async function checkAbonosStructure() {
    const oldDb = await createOldConnection();
    
    try {
        console.log('=== ESTRUCTURA DE LA TABLA ABONOS ===');
        
        // Obtener estructura de la tabla
        const [columns] = await oldDb.execute(`
            DESCRIBE abonos
        `);

        console.log('Columnas en la tabla abonos:');
        console.table(columns);

        // Obtener una muestra de datos
        console.log('\n=== MUESTRA DE DATOS ===');
        const [sample] = await oldDb.execute(`
            SELECT * FROM abonos LIMIT 5
        `);

        console.log('Muestra de registros:');
        console.table(sample);

        // Verificar si hay campos relacionados con usuarios
        console.log('\n=== CAMPOS RELACIONADOS CON USUARIOS ===');
        const userRelatedFields = columns.filter(col => 
            col.Field.toLowerCase().includes('user') || 
            col.Field.toLowerCase().includes('created') ||
            col.Field.toLowerCase().includes('gestor') ||
            col.Field.toLowerCase().includes('agente')
        );

        if (userRelatedFields.length > 0) {
            console.log('Campos que podrían contener información del gestor:');
            console.table(userRelatedFields);
        } else {
            console.log('No se encontraron campos obvios relacionados con usuarios/gestores');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await oldDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkAbonosStructure()
        .then(() => {
            console.log('Verificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkAbonosStructure };