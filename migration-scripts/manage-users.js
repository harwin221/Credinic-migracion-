require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// Función para generar ID de usuario
const generateUserId = () => `user_${randomUUID()}`;

// Función para generar email ficticio
const generateEmail = (username) => `${username}@credinica.com`;

class UserManager {
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

  async listUsers() {
    console.log('=== LISTA DE USUARIOS ===\n');
    
    const [users] = await this.connection.execute(`
      SELECT id, fullName, username, email, role, sucursal_name, active, createdAt
      FROM users 
      ORDER BY fullName
    `);

    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos');
      return;
    }

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username || 'NO DEFINIDO'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   Sucursal: ${user.sucursal_name || 'TODAS'}`);
      console.log(`   Activo: ${user.active ? 'SÍ' : 'NO'}`);
      console.log(`   Creado: ${user.createdAt}`);
      console.log('   ---');
    });

    console.log(`\nTotal: ${users.length} usuarios`);
  }

  async createUser(userData) {
    const {
      displayName,
      username,
      password,
      phone = null,
      role = 'OPERATIVO',
      branch = 'TODAS',
      active = true
    } = userData;

    console.log(`\n🔧 Creando usuario: ${displayName}`);

    // Verificar si el username ya existe
    const [existing] = await this.connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      throw new Error(`El username "${username}" ya está en uso`);
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId();
    const email = generateEmail(username);

    // Obtener información de sucursal
    let branchId = null;
    let branchName = 'TODAS';

    if (branch !== 'TODAS') {
      const [branchResult] = await this.connection.execute(
        'SELECT id, name FROM sucursales WHERE id = ? OR name = ?',
        [branch, branch]
      );

      if (branchResult.length === 0) {
        throw new Error(`Sucursal "${branch}" no encontrada`);
      }

      branchId = branchResult[0].id;
      branchName = branchResult[0].name;
    }

    // Insertar usuario
    await this.connection.execute(`
      INSERT INTO users (id, fullName, email, username, hashed_password, phone, role, sucursal_id, sucursal_name, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      userId,
      displayName.toUpperCase(),
      email,
      username,
      hashedPassword,
      phone,
      role.toUpperCase(),
      branchId,
      branchName,
      active
    ]);

    console.log('✅ Usuario creado exitosamente');
    console.log(`   ID: ${userId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Rol: ${role.toUpperCase()}`);
    console.log(`   Sucursal: ${branchName}`);

    return userId;
  }

  async resetPassword(username, newPassword = 'password123') {
    console.log(`\n🔐 Reseteando contraseña para: ${username}`);

    const [users] = await this.connection.execute(
      'SELECT id, fullName FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      throw new Error(`Usuario "${username}" no encontrado`);
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.connection.execute(
      'UPDATE users SET hashed_password = ?, mustChangePassword = 0, updatedAt = NOW() WHERE id = ?',
      [hashedPassword, user.id]
    );

    console.log('✅ Contraseña reseteada exitosamente');
    console.log(`   Usuario: ${username}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
  }

  async activateUser(username) {
    console.log(`\n✅ Activando usuario: ${username}`);

    const result = await this.connection.execute(
      'UPDATE users SET active = 1, updatedAt = NOW() WHERE username = ?',
      [username]
    );

    if (result[0].affectedRows === 0) {
      throw new Error(`Usuario "${username}" no encontrado`);
    }

    console.log('✅ Usuario activado exitosamente');
  }

  async deactivateUser(username) {
    console.log(`\n❌ Desactivando usuario: ${username}`);

    const result = await this.connection.execute(
      'UPDATE users SET active = 0, updatedAt = NOW() WHERE username = ?',
      [username]
    );

    if (result[0].affectedRows === 0) {
      throw new Error(`Usuario "${username}" no encontrado`);
    }

    console.log('✅ Usuario desactivado exitosamente');
  }

  async fixUserFields(username) {
    console.log(`\n🔧 Arreglando campos del usuario: ${username}`);

    const [users] = await this.connection.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      throw new Error(`Usuario "${username}" no encontrado`);
    }

    const user = users[0];
    const updates = [];
    const values = [];

    // Arreglar username si está vacío
    if (!user.username || user.username.trim() === '') {
      updates.push('username = ?');
      values.push(username);
      console.log('   - Arreglando campo username');
    }

    // Arreglar email si está vacío
    if (!user.email || user.email.trim() === '') {
      updates.push('email = ?');
      values.push(generateEmail(username));
      console.log('   - Arreglando campo email');
    }

    // Asegurar que esté activo
    if (!user.active) {
      updates.push('active = ?');
      values.push(1);
      console.log('   - Activando usuario');
    }

    if (updates.length > 0) {
      values.push(user.id);
      await this.connection.execute(
        `UPDATE users SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`,
        values
      );
      console.log('✅ Campos arreglados exitosamente');
    } else {
      console.log('✅ No se necesitan arreglos');
    }
  }

  async testLogin(username, password = 'password123') {
    console.log(`\n🧪 Probando login para: ${username}`);

    const [users] = await this.connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username.toLowerCase()]
    );

    if (users.length === 0) {
      console.log('❌ Usuario no encontrado');
      return false;
    }

    const user = users[0];
    console.log(`   Usuario encontrado: ${user.fullName}`);
    console.log(`   Activo: ${user.active ? 'SÍ' : 'NO'}`);

    if (!user.active) {
      console.log('❌ Usuario inactivo');
      return false;
    }

    if (!user.hashed_password) {
      console.log('❌ No hay contraseña hasheada');
      return false;
    }

    const passwordMatch = await bcrypt.compare(password, user.hashed_password);
    console.log(`   Contraseña correcta: ${passwordMatch ? '✅ SÍ' : '❌ NO'}`);

    return passwordMatch;
  }

  async getSucursales() {
    console.log('\n=== SUCURSALES DISPONIBLES ===\n');
    
    const [sucursales] = await this.connection.execute(
      'SELECT id, name FROM sucursales ORDER BY name'
    );

    console.log('TODAS (para administradores)');
    sucursales.forEach((sucursal, index) => {
      console.log(`${sucursal.id} - ${sucursal.name}`);
    });

    return sucursales;
  }
}

// Función principal
async function main() {
  const userManager = new UserManager();
  
  try {
    await userManager.connect();
    
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'list':
        await userManager.listUsers();
        break;

      case 'create':
        if (args.length < 4) {
          console.log('Uso: node manage-users.js create <nombre> <username> <password> [rol] [sucursal]');
          console.log('Ejemplo: node manage-users.js create "Juan Pérez" juanperez password123 OPERATIVO TODAS');
          break;
        }
        await userManager.createUser({
          displayName: args[1],
          username: args[2],
          password: args[3],
          role: args[4] || 'OPERATIVO',
          branch: args[5] || 'TODAS'
        });
        break;

      case 'reset-password':
        if (args.length < 2) {
          console.log('Uso: node manage-users.js reset-password <username> [nueva_contraseña]');
          console.log('Ejemplo: node manage-users.js reset-password administrador password123');
          break;
        }
        await userManager.resetPassword(args[1], args[2] || 'password123');
        break;

      case 'activate':
        if (args.length < 2) {
          console.log('Uso: node manage-users.js activate <username>');
          break;
        }
        await userManager.activateUser(args[1]);
        break;

      case 'deactivate':
        if (args.length < 2) {
          console.log('Uso: node manage-users.js deactivate <username>');
          break;
        }
        await userManager.deactivateUser(args[1]);
        break;

      case 'fix':
        if (args.length < 2) {
          console.log('Uso: node manage-users.js fix <username>');
          console.log('Arregla campos faltantes del usuario');
          break;
        }
        await userManager.fixUserFields(args[1]);
        break;

      case 'test-login':
        if (args.length < 2) {
          console.log('Uso: node manage-users.js test-login <username> [password]');
          break;
        }
        await userManager.testLogin(args[1], args[2] || 'password123');
        break;

      case 'sucursales':
        await userManager.getSucursales();
        break;

      case 'fix-admin':
        console.log('🔧 Arreglando usuario administrador...');
        await userManager.fixUserFields('administrador');
        await userManager.resetPassword('administrador', 'password123');
        await userManager.activateUser('administrador');
        console.log('✅ Usuario administrador arreglado completamente');
        break;

      default:
        console.log('=== GESTOR DE USUARIOS CREDINICA ===\n');
        console.log('Comandos disponibles:');
        console.log('  list                                    - Listar todos los usuarios');
        console.log('  create <nombre> <username> <password>   - Crear nuevo usuario');
        console.log('  reset-password <username> [password]    - Resetear contraseña');
        console.log('  activate <username>                     - Activar usuario');
        console.log('  deactivate <username>                   - Desactivar usuario');
        console.log('  fix <username>                          - Arreglar campos del usuario');
        console.log('  test-login <username> [password]        - Probar login');
        console.log('  sucursales                              - Listar sucursales');
        console.log('  fix-admin                               - Arreglar usuario administrador');
        console.log('\nEjemplos:');
        console.log('  node manage-users.js list');
        console.log('  node manage-users.js create "María García" maria password123 GESTOR TODAS');
        console.log('  node manage-users.js reset-password administrador password123');
        console.log('  node manage-users.js fix-admin');
        break;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await userManager.disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { UserManager };