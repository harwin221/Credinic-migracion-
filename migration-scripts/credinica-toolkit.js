#!/usr/bin/env node

/**
 * 🛠️ CREDINICA TOOLKIT - SCRIPT MAESTRO
 * 
 * Este es el script principal que combina todas las funcionalidades
 * necesarias para la gestión completa del sistema CrediNica.
 * 
 * Uso: node migration-scripts/credinica-toolkit.js [comando]
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const generateUserId = () => `user_${randomUUID()}`;
const generateEmail = (username) => `${username}@credinica.com`;

class CredinicaToolkit {
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
  // DIAGNÓSTICO COMPLETO DEL SISTEMA
  // ========================================
  async systemDiagnosis() {
    console.log('🏥 === DIAGNÓSTICO COMPLETO DEL SISTEMA CREDINICA ===\n');

    // 1. Conexión a BD
    console.log('1. 🔌 Verificando conexión a base de datos...');
    try {
      await this.connection.execute('SELECT 1');
      console.log('   ✅ Conexión exitosa\n');
    } catch (error) {
      console.log('   ❌ Error de conexión:', error.message);
      return;
    }

    // 2. Estado de la migración
    console.log('2. 📊 Estado de la migración:');
    const [userCount] = await this.connection.execute('SELECT COUNT(*) as count FROM users');
    const [clientCount] = await this.connection.execute('SELECT COUNT(*) as count FROM clients');
    const [creditCount] = await this.connection.execute('SELECT COUNT(*) as count FROM credits');
    const [paymentCount] = await this.connection.execute('SELECT COUNT(*) as count FROM payments_registered');
    
    console.log(`   👥 Usuarios: ${userCount[0].count}`);
    console.log(`   🏠 Clientes: ${clientCount[0].count}`);
    console.log(`   💳 Créditos: ${creditCount[0].count}`);
    console.log(`   💰 Pagos: ${paymentCount[0].count}\n`);

    // 3. Problemas detectados
    console.log('3. ⚠️  Problemas detectados:');
    const [usersNoUsername] = await this.connection.execute('SELECT COUNT(*) as count FROM users WHERE username IS NULL OR username = ""');
    const [usersNoPassword] = await this.connection.execute('SELECT COUNT(*) as count FROM users WHERE hashed_password IS NULL');
    const [inactiveUsers] = await this.connection.execute('SELECT COUNT(*) as count FROM users WHERE active = 0');
    const [clientsNoGeo] = await this.connection.execute('SELECT COUNT(*) as count FROM clients WHERE departmentId IS NULL');
    
    console.log(`   Usuarios sin username: ${usersNoUsername[0].count} ${usersNoUsername[0].count === 0 ? '✅' : '❌'}`);
    console.log(`   Usuarios sin contraseña: ${usersNoPassword[0].count} ${usersNoPassword[0].count === 0 ? '✅' : '❌'}`);
    console.log(`   Usuarios inactivos: ${inactiveUsers[0].count} ${inactiveUsers[0].count === 0 ? '✅' : 'ℹ️'}`);
    console.log(`   Clientes sin geografía: ${clientsNoGeo[0].count} ${clientsNoGeo[0].count === 0 ? '✅' : '⚠️'}\n`);

    // 4. Usuario administrador
    console.log('4. 👑 Usuario administrador:');
    const [admin] = await this.connection.execute(`
      SELECT username, active, hashed_password IS NOT NULL as has_password
      FROM users WHERE username = 'administrador' OR email = 'administrador'
    `);

    if (admin.length === 0) {
      console.log('   ❌ NO ENCONTRADO');
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

    // 5. Recomendaciones
    console.log('\n5. 💡 RECOMENDACIONES:');
    const totalProblems = usersNoUsername[0].count + usersNoPassword[0].count;
    
    if (totalProblems === 0 && admin.length > 0) {
      console.log('   🎉 ¡SISTEMA EN PERFECTO ESTADO!');
      console.log('   ✅ No se requieren acciones');
    } else {
      if (admin.length === 0 || !admin[0].active || !admin[0].has_password) {
        console.log('   🚨 CRÍTICO: Ejecutar "fix-admin"');
      }
      if (totalProblems > 0) {
        console.log('   ⚠️  Ejecutar "fix-all" para arreglar problemas');
      }
      console.log('   📋 Credenciales: administrador / password123');
    }
  }

  // ========================================
  // ARREGLAR TODO EL SISTEMA
  // ========================================
  async fixAll() {
    console.log('🔧 === REPARACIÓN COMPLETA DEL SISTEMA ===\n');

    let fixedCount = 0;

    // 1. Arreglar administrador
    console.log('1. 👑 Arreglando usuario administrador...');
    await this.fixAdmin();
    fixedCount++;

    // 2. Arreglar usuarios sin username
    console.log('\n2. 👥 Arreglando usuarios...');
    const [problemUsers] = await this.connection.execute(`
      SELECT id, fullName, username, email 
      FROM users 
      WHERE (username IS NULL OR username = '') AND id != (
        SELECT id FROM users WHERE username = 'administrador' LIMIT 1
      )
    `);

    for (const user of problemUsers) {
      let newUsername = user.email || user.fullName.toLowerCase().replace(/\s+/g, '');
      newUsername = newUsername.replace(/@.*$/, '').replace(/[^a-z0-9]/g, '').substring(0, 20);
      
      if (!newUsername) {
        newUsername = `user${user.id.slice(-4)}`;
      }
      
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

      console.log(`   ✅ ${user.fullName} -> ${finalUsername}`);
      fixedCount++;
    }

    // 3. Activar todos los usuarios
    const [inactiveResult] = await this.connection.execute('UPDATE users SET active = 1 WHERE active = 0');
    if (inactiveResult.affectedRows > 0) {
      console.log(`\n3. ✅ Activados ${inactiveResult.affectedRows} usuarios`);
      fixedCount += inactiveResult.affectedRows;
    }

    // 4. Verificar geografía
    const [clientsNoGeo] = await this.connection.execute('SELECT COUNT(*) as count FROM clients WHERE departmentId IS NULL');
    if (clientsNoGeo[0].count > 0) {
      console.log(`\n4. ⚠️  ${clientsNoGeo[0].count} clientes sin geografía (esto es normal si no se migró desde BD antigua)`);
    }

    console.log(`\n🎉 REPARACIÓN COMPLETADA: ${fixedCount} elementos arreglados`);
    console.log('\n📋 CREDENCIALES PRINCIPALES:');
    console.log('   Usuario: administrador');
    console.log('   Contraseña: password123');
  }

  // ========================================
  // ARREGLAR SOLO ADMINISTRADOR
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

      const needsPasswordReset = !adminUser.hashed_password || 
        !(await bcrypt.compare('password123', adminUser.hashed_password || ''));

      if (needsPasswordReset) {
        updates.push('hashed_password = ?');
        values.push(await bcrypt.hash('password123', 10));
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
  // CREAR USUARIO RÁPIDO
  // ========================================
  async quickCreateUser(fullName, username, role = 'OPERATIVO') {
    console.log(`🆕 Creando usuario: ${fullName}`);

    // Verificar si existe
    const [existing] = await this.connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      console.log(`❌ El username "${username}" ya existe`);
      return false;
    }

    // Crear usuario
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userId = generateUserId();

    await this.connection.execute(`
      INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [userId, fullName.toUpperCase(), generateEmail(username), username, hashedPassword, role.toUpperCase(), 1]);

    console.log('✅ Usuario creado exitosamente');
    console.log(`   Username: ${username}`);
    console.log(`   Contraseña: password123`);
    console.log(`   Rol: ${role.toUpperCase()}`);

    return true;
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
      SELECT fullName, username, email, role, active, createdAt
      FROM users ORDER BY fullName
    `);

    console.log('👥 === USUARIOS DEL SISTEMA ===\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   Estado: ${user.active ? '✅ Activo' : '❌ Inactivo'}`);
      console.log(`   Creado: ${user.createdAt.toLocaleDateString()}`);
      console.log('   ---');
    });
  }

  showHelp() {
    console.log('🛠️  === CREDINICA TOOLKIT - SCRIPT MAESTRO ===\n');
    console.log('COMANDOS PRINCIPALES:');
    console.log('  diagnose         - Diagnóstico completo del sistema');
    console.log('  fix-all          - Reparar todos los problemas automáticamente');
    console.log('  fix-admin        - Reparar solo el usuario administrador');
    console.log('  list-users       - Listar todos los usuarios');
    console.log('  create-user      - Crear usuario rápido');
    console.log('  help             - Mostrar esta ayuda');
    console.log('\nEJEMPLOS:');
    console.log('  node migration-scripts/credinica-toolkit.js diagnose');
    console.log('  node migration-scripts/credinica-toolkit.js fix-all');
    console.log('  node migration-scripts/credinica-toolkit.js create-user "María García" maria GESTOR');
    console.log('\n💡 FLUJO RECOMENDADO:');
    console.log('  1. Ejecutar "diagnose" para ver el estado');
    console.log('  2. Ejecutar "fix-all" si hay problemas');
    console.log('  3. Usar "create-user" para nuevos usuarios');
    console.log('\n📋 CREDENCIALES PRINCIPALES:');
    console.log('  Usuario: administrador');
    console.log('  Contraseña: password123');
  }
}

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================
async function main() {
  const toolkit = new CredinicaToolkit();
  
  try {
    await toolkit.connect();
    
    const command = process.argv[2] || 'help';
    const args = process.argv.slice(3);

    switch (command) {
      case 'diagnose':
      case 'diagnosis':
      case 'check':
        await toolkit.systemDiagnosis();
        break;

      case 'fix-all':
      case 'fix':
      case 'repair':
        await toolkit.fixAll();
        break;

      case 'fix-admin':
      case 'admin':
        await toolkit.fixAdmin();
        console.log('\n✅ Usuario administrador verificado/arreglado');
        break;

      case 'create-user':
      case 'create':
        if (args.length < 2) {
          console.log('Uso: credinica-toolkit.js create-user "Nombre Completo" username [rol]');
          console.log('Ejemplo: credinica-toolkit.js create-user "María García" maria GESTOR');
          break;
        }
        await toolkit.quickCreateUser(args[0], args[1], args[2] || 'OPERATIVO');
        break;

      case 'list-users':
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
    console.log('\n💡 Verificar:');
    console.log('   - Archivo .env con credenciales correctas');
    console.log('   - Conexión a la base de datos');
    console.log('   - Permisos de escritura');
  } finally {
    await toolkit.disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { CredinicaToolkit };