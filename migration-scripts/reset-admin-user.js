#!/usr/bin/env node

/**
 * Script para crear/resetear el usuario administrador después de la migración
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
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

async function resetAdminUser() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== CREACIÓN/RESET DEL USUARIO ADMINISTRADOR ===');
        
        const adminUsername = 'admin';
        const adminEmail = 'admin@credinic.com';
        const adminPassword = 'admin123'; // Cambiar por una contraseña segura
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        // Verificar si ya existe un administrador
        const [existingAdmin] = await newDb.execute(
            'SELECT * FROM users WHERE role = ? OR username = ? OR email = ?', 
            ['ADMINISTRADOR', adminUsername, adminEmail]
        );
        
        if (existingAdmin.length > 0) {
            console.log('👤 Usuario administrador existente encontrado. Actualizando...');
            
            // Actualizar usuario existente con username
            await newDb.execute(
                'UPDATE users SET username = ?, email = ?, hashed_password = ?, fullName = ?, updatedAt = ? WHERE id = ?',
                [adminUsername, adminEmail, hashedPassword, 'Administrador Principal', new Date(), existingAdmin[0].id]
            );
            
            console.log('✅ Usuario administrador actualizado:');
            console.log(`   Username: ${adminUsername}`);
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Contraseña: ${adminPassword}`);
            console.log(`   ID: ${existingAdmin[0].id}`);
        } else {
            console.log('👤 Creando nuevo usuario administrador...');
            
            // Crear nuevo usuario administrador con username
            const adminId = `user_${randomUUID()}`;
            await newDb.execute(
                'INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [adminId, 'Administrador Principal', adminEmail, adminUsername, hashedPassword, 'ADMINISTRADOR', 1, new Date(), new Date()]
            );
            
            console.log('✅ Usuario administrador creado:');
            console.log(`   Username: ${adminUsername}`);
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Contraseña: ${adminPassword}`);
            console.log(`   ID: ${adminId}`);
        }
        
        // Verificar que el usuario fue creado/actualizado correctamente
        const [verifyAdmin] = await newDb.execute(
            'SELECT id, fullName, email, username, role FROM users WHERE role = ?', 
            ['ADMINISTRADOR']
        );
        
        if (verifyAdmin.length > 0) {
            console.log('\n✅ Verificación exitosa. Administradores en el sistema:');
            console.table(verifyAdmin);
        } else {
            console.log('\n❌ Error: No se encontró ningún administrador después de la operación');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    resetAdminUser()
        .then(() => {
            console.log('\nScript completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { resetAdminUser };