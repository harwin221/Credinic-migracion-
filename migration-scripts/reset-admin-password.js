
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// --- Configuración ---
const adminCredentials = {
    usernameForLogin: 'administrador', // Este es el valor para el campo de login
    emailForSearch: 'administrador', // El email que se usó en la migración
    newPassword: 'password123',
};

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    charset: 'utf8mb4'
};

// --- Función Principal ---
async function resetAdminPassword() {
    let connection;
    try {
        console.log('Conectando a la base de datos...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Conexión exitosa.');

        console.log(`Buscando al usuario con email '${adminCredentials.emailForSearch}'...`);
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [adminCredentials.emailForSearch]);

        if (users.length === 0) {
            console.error(`❌ ERROR: No se encontró al usuario con email '${adminCredentials.emailForSearch}'. No se puede resetear la contraseña.`);
            return;
        }
        
        const userId = users[0].id;
        console.log(`Usuario encontrado (ID: ${userId}). Hasheando la nueva contraseña...`);
        const hashedPassword = await bcrypt.hash(adminCredentials.newPassword, 10);
        
        console.log('Actualizando la contraseña en la base de datos...');
        await connection.execute('UPDATE users SET hashed_password = ? WHERE id = ?', [hashedPassword, userId]);
        
        console.log('✅ ¡Contraseña del administrador actualizada con éxito!');
        console.log(`   Usuario para login: ${adminCredentials.usernameForLogin}`);
        console.log(`   Nueva Contraseña: ${adminCredentials.newPassword}`);

    } catch (error) {
        console.error('❌ ERROR al resetear la contraseña del administrador:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Conexión cerrada.');
        }
    }
}

resetAdminPassword();
