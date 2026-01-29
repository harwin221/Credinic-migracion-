#!/usr/bin/env node

/**
 * Script para verificar el usuario administrador
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
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

async function checkAdminUser() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== VERIFICACIÓN DEL USUARIO ADMINISTRADOR ===');
        
        // Buscar todos los usuarios administradores
        const [admins] = await newDb.execute(
            'SELECT id, fullName, email, hashed_password, role FROM users WHERE role = ?', 
            ['ADMINISTRADOR']
        );
        
        console.log(`Administradores encontrados: ${admins.length}`);
        
        if (admins.length === 0) {
            console.log('❌ No hay administradores en el sistema');
            return;
        }
        
        for (const admin of admins) {
            console.log(`\n👤 Usuario: ${admin.fullName}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   ID: ${admin.id}`);
            console.log(`   Rol: ${admin.role}`);
            
            // Verificar si la contraseña es correcta
            const isValidPassword = await bcrypt.compare('admin123', admin.hashed_password);
            console.log(`   Contraseña 'admin123': ${isValidPassword ? '✅ Válida' : '❌ Inválida'}`);
            
            if (!isValidPassword) {
                console.log('   🔧 Actualizando contraseña...');
                const newHashedPassword = await bcrypt.hash('admin123', 10);
                await newDb.execute(
                    'UPDATE users SET hashed_password = ? WHERE id = ?',
                    [newHashedPassword, admin.id]
                );
                console.log('   ✅ Contraseña actualizada');
            }
        }
        
        // Verificar de nuevo después de la actualización
        console.log('\n=== VERIFICACIÓN FINAL ===');
        const [finalCheck] = await newDb.execute(
            'SELECT id, fullName, email, role FROM users WHERE role = ?', 
            ['ADMINISTRADOR']
        );
        
        console.table(finalCheck);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    checkAdminUser()
        .then(() => {
            console.log('\nVerificación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkAdminUser };