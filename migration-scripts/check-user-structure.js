#!/usr/bin/env node

/**
 * Script para verificar la estructura de la tabla users
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

async function checkUserStructure() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== ESTRUCTURA DE LA TABLA USERS ===');
        
        // Mostrar estructura de la tabla
        const [structure] = await newDb.execute('DESCRIBE users');
        console.table(structure);
        
        console.log('\n=== USUARIOS EN EL SISTEMA ===');
        
        // Mostrar todos los usuarios
        const [users] = await newDb.execute(
            'SELECT id, fullName, email, username, role, active FROM users'
        );
        
        console.table(users);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkUserStructure()
        .then(() => {
            console.log('\nVerificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkUserStructure };