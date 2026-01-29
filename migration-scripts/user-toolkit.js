#!/usr/bin/env node

/**
 * TOOLKIT DE GESTIÓN DE USUARIOS CREDINICA
 * 
 * Este script te permite manejar todos los problemas comunes con usuarios
 * sin necesidad de molestar al desarrollador cada vez.
 * 
 * Uso: node user-toolkit.js [comando] [parámetros]
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const generateUserId = () => `user_${randomUUID()}`;
const generateEmail = (username) => `${username}@credinica.com`;

class UserToolkit {
  constructor() {
    this.connection = null;
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: process.env.NEW_DB_HOST,
      user: process.env.NEW_DB_USER,
      password: process.env.NEW_DB_PASSWORD,
      database: process.env.NEW_DB_DATABASE,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
    }
  }

  // ========================================
  // COMANDO: DIAGNÓSTICO COMPLETO
  // ========================================
  async diagnose() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO DEL SISTEMA ===\n');

    // 1. Verificar conexión a BD
    console.log('1. 🔌 Verificando conexión a base de datos...');
    try {
      await this.connection.execute('SELECT 1');
      console.log('   ✅ Conexión exitosa\n');
    } catch (error) {
      console.log('   ❌ Error de conexión:', error.message);
      return;
    }

    // 2. Contar usuarios
    const [userCount] = await this.connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`2. 👥 Total de usuarios: ${userCount[0].count}`);

    // 3. Usuarios activos vs inactivos
    const [activeCount] = await this.connection.execute('SELECT COUNT(*) as count FROM users WHERE active = 1');
    const [inactiveCount] = await this.connection.execute('SELECT COUNT(*) as count FROM users WHERE active = 0');
    console.log(`   ✅ Activos: ${activeCount[0].count}`);
    console.log(`   ❌ Inactivos: ${inactiveCount[0].count}\n`);

    // 4. Usuarios con problemas
    const [problemUsers] = await this.connection.execute(`
      SELECT COUNT(*) as count FROM users 
      WHERE username IS NULL OR username = '' OR hashed_password IS NULL
    `);
    console.log(`3. ⚠️  Usuarios con problemas: ${problemUsers[0].count}`);

    if (problemUsers[0].count > 0) {
      const [problems] = await this.connection.execute(`
        SELECT fullName, username, email, 
               CASE WHEN username IS NULL OR username = '' THEN 'Sin username' ELSE '' END as issue1,
               CASE WHEN hashed_password IS NULL THEN 'Sin contraseña' ELSE '' END as issue2
        FROM users 
        WHERE username IS NULL OR username = '' OR hashed_password IS NULL
      `);

      problems.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.fullName}`);
        if (user.issue1) console.log(`      - ${user.issue1}`);
        if (user.issue2) console.log(`      - ${user.issue2}`);
      });
    }

    // 5. Verificar usuario administrador
    console.log('\n4. 👑 Verificando usuario administrador...');
    const [admin] = await this.connection.execute(`
      SELECT username, active, hashed_password IS NOT NULL as has_password
      FROM users WHERE username = 'administrador' OR email = 'administrador'
    `);

    if (admin.length === 0) {
      console.log('   ❌ Usuario administrador NO ENCONTRADO');
    } else {
      const adminUser = admin[0];
      console.log(`   Username: ${adminUser.username || 'NO DEFINIDO'}`);
      console.log(`   Activo: ${adminUser.active ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   Contraseña: ${adminUser.has_password ? '✅ SÍ' : '❌ NO'}`);
      
      if (adminUser.has_password) {
        const testLogin = await this.testLoginQuiet('administrador', 'password123');
        console.log(`   Login funciona: ${testLogin ? '✅ SÍ' : '❌ NO'}`);
      }
    }

    // 6. Recomendaciones
    console.log('\n5. 💡 RECOMENDACIONES:');
    if (problemUsers[0].count > 0) {
      console.log('   - Ejecuta: node user-toolkit.js fix-all');
    }
    if (admin.length === 0 || !admin[0].active || !admin[0].has_password) {
      console.log('   - Ejecuta: node user-toolkit.js fix-admin');
    }
    console.log('   - Para crear un nuevo usuario: node user-toolkit.js create');
    console.log('   - Para ver todos los comandos: node user-toolkit.js help');
  }

  // ========================================
  // COMANDO: ARREGLAR TODO AUTOMÁTICAMENTE
  // ========================================
  async fixAll() {
    console.log('🔧 === ARREGLANDO TODOS LOS PROBLEMAS ===\n');

    // 1. Arreglar usuario administrador
    console.log('1. 👑 Arreglando usuario administrador...');
    await this.fixAdmin();

    // 2. Arreglar usuarios con username faltante
    console.log('\n2. 👥 Arreglando usuarios con problemas...');
    const [problemUsers] = await this.connection.execute(`
      SELECT id, fullName, username, email 
      FROM users 
      WHERE (username IS NULL OR username = '') AND id != (
        SELECT id FROM users WHERE username = 'administrador' LIMIT 1
      )
    `);

    for (const user of problemUsers) {
      let newUsername = user.email || user.fullName.toLowerCase().replace(/\s+/g, '');
      newUsername = newUsername.replace(/@.*$/, '').replace(/[^a-z0-9]/g, '');
      
      // Asegurar unicidad
      let finalUsername = newUsername;
      let counter = 1;
      while (true) {
        const [existing] = await this.connection.execute(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [finalUsername, user.id]
        );
        if (existing.length === 0) break;
        finalUsername = `${newUsername}${counter}`;
        counter++;
      }

      await this.connection.execute(
        'UPDATE users SET username = ?, email = ? WHERE id = ?',
        [finalUsername, generateEmail(finalUsername), user.id]
      );

      console.log(`   ✅ ${user.fullName} -> username: ${finalUsername}`);
    }

    // 3. Activar todos los usuarios
    await this.connection.execute('UPDATE users SET active = 1');
    console.log('\n3. ✅ Todos los usuarios activados');

    console.log('\n🎉 ¡TODOS LOS PROBLEMAS ARREGLADOS!');
    console.log('\n📋 CREDENCIALES DE ADMINISTRADOR:');
    console.log('   Usuario: administrador');
    console.log('   Contraseña: password123');
  }

  // ========================================
  // COMANDO: ARREGLAR SOLO ADMINISTRADOR
  // ========================================
  async fixAdmin() {
    const [admin] = await this.connection.execute(`
      SELECT id, username, email, active, hashed_password
      FROM users WHERE username = 'administrador' OR email = 'administrador'
    `);

    if (admin.length === 0) {
      // Crear administrador
      console.log('   🆕 Creando usuario administrador...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userId = generateUserId();

      await this.connection.execute(`
        INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [userId, 'Administrador', 'administrador', 'administrador', hashedPassword, 'ADMINISTRADOR', 1]);

      console.log('   ✅ Usuario administrador creado');
    } else {
      // Arreglar administrador existente
      const adminUser = admin[0];
      const updates = [];
      const values = [];

      if (!adminUser.username || adminUser.username !== 'administrador') {
        updates.push('username = ?');
        values.push('administrador');
      }

      if (!adminUser.active) {
        updates.push('active = ?');
        values.push(1);
      }

      if (!adminUser.hashed_password) {
        updates.push('hashed_password = ?');
        values.push(await bcrypt.hash('password123', 10));
      } else {
        // Verificar si la contraseña actual funciona
        const passwordWorks = await bcrypt.compare('password123', adminUser.hashed_password);
        if (!passwordWorks) {
          updates.push('hashed_password = ?');
          values.push(await bcrypt.hash('password123', 10));
        }
      }

      if (updates.length > 0) {
        values.push(adminUser.id);
        await this.connection.execute(
          `UPDATE users SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`,
          values
        );
        console.log('   ✅ Usuario administrador arreglado');
      } else {
        console.log('   ✅ Usuario administrador ya está correcto');
      }
    }
  }

  // ========================================
  // COMANDO: CREAR USUARIO INTERACTIVO
  // ========================================
  async createInteractive() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
      console.log('🆕 === CREAR NUEVO USUARIO ===\n');

      const fullName = await question('Nombre completo: ');
      const username = await question('Username (nombre de usuario): ');
      const password = await question('Contraseña (Enter para usar "password123"): ') || 'password123';
      
      console.log('\nRoles disponibles:');
      console.log('1. ADMINISTRADOR - Acceso total');
      console.log('2. FINANZAS - Gestión financiera');
      console.log('3. GESTOR - Gestión de cartera');
      console.log('4. OPERATIVO - Operaciones básicas');
      
      const roleChoice = await question('Selecciona rol (1-4): ');
      const roles = ['', 'ADMINISTRADOR', 'FINANZAS', 'GESTOR', 'OPERATIVO'];
      const role = roles[parseInt(roleChoice)] || 'OPERATIVO';

      // Verificar si username ya existe
      const [existing] = await this.connection.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );

      if (existing.length > 0) {
        console.log(`\n❌ El username "${username}" ya está en uso`);
        return;
      }

      // Crear usuario
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = generateUserId();

      await this.connection.execute(`
        INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [userId, fullName.toUpperCase(), generateEmail(username), username, hashedPassword, role, 1]);

      console.log('\n✅ Usuario creado exitosamente!');
      console.log(`   Nombre: ${fullName}`);
      console.log(`   Username: ${username}`);
      console.log(`   Contraseña: ${password}`);
      console.log(`   Rol: ${role}`);

    } finally {
      rl.close();
    }
  }

  // ========================================
  // FUNCIONES AUXILIARES
  // ========================================
  async testLoginQuiet(username, password) {
    try {
      const [users] = await this.connection.execute(
        'SELECT hashed_password FROM users WHERE username = ? AND active = 1',
        [username]
      );
      
      if (users.length === 0) return false;
      return await bcrypt.compare(password, users[0].hashed_password);
    } catch {
      return false;
    }
  }

  async listUsers() {
    const [users] = await this.connection.execute(`
      SELECT fullName, username, email, role, active
      FROM users ORDER BY fullName
    `);

    console.log('👥 === LISTA DE USUARIOS ===\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   Estado: ${user.active ? '✅ Activo' : '❌ Inactivo'}`);
      console.log('   ---');
    });
  }

  showHelp() {
    console.log('🛠️  === TOOLKIT DE USUARIOS CREDINICA ===\n');
    console.log('COMANDOS PRINCIPALES:');
    console.log('  diagnose     - Diagnóstico completo del sistema');
    console.log('  fix-all      - Arregla todos los problemas automáticamente');
    console.log('  fix-admin    - Arregla solo el usuario administrador');
    console.log('  create       - Crear nuevo usuario (modo interactivo)');
    console.log('  list         - Listar todos los usuarios');
    console.log('  help         - Mostrar esta ayuda');
    console.log('\nCOMAN DOS RÁPIDOS:');
    console.log('  node user-toolkit.js diagnose    - Ver qué está mal');
    console.log('  node user-toolkit.js fix-all     - Arreglar todo');
    console.log('  node user-toolkit.js create      - Crear usuario');
    console.log('\n💡 CONSEJO: Siempre ejecuta "diagnose" primero para ver el estado del sistema.');
  }
}

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================
async function main() {
  const toolkit = new UserToolkit();
  
  try {
    await toolkit.connect();
    
    const command = process.argv[2] || 'help';

    switch (command) {
      case 'diagnose':
      case 'diagnostic':
      case 'check':
        await toolkit.diagnose();
        break;

      case 'fix-all':
      case 'fix':
      case 'repair':
        await toolkit.fixAll();
        break;

      case 'fix-admin':
      case 'admin':
        await toolkit.fixAdmin();
        console.log('\n✅ Usuario administrador arreglado');
        console.log('📋 Credenciales: administrador / password123');
        break;

      case 'create':
      case 'new':
        await toolkit.createInteractive();
        break;

      case 'list':
      case 'users':
        await toolkit.listUsers();
        break;

      case 'help':
      case '--help':
      case '-h':
      default:
        toolkit.showHelp();
        break;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Si el problema persiste, verifica:');
    console.log('   - Que el archivo .env tenga las credenciales correctas');
    console.log('   - Que la base de datos esté accesible');
    console.log('   - Que tengas permisos de escritura');
  } finally {
    await toolkit.disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { UserToolkit };