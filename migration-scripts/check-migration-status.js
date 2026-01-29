require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkMigrationStatus() {
  const connection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔍 === ESTADO DE LA MIGRACIÓN ===\n');

    // 1. Verificar usuarios
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [adminCount] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "ADMINISTRADOR"');
    console.log(`👥 Usuarios migrados: ${userCount[0].count}`);
    console.log(`👑 Administradores: ${adminCount[0].count}`);

    // 2. Verificar clientes
    const [clientCount] = await connection.execute('SELECT COUNT(*) as count FROM clients');
    const [clientsWithGeo] = await connection.execute('SELECT COUNT(*) as count FROM clients WHERE departmentId IS NOT NULL');
    console.log(`\n🏠 Clientes migrados: ${clientCount[0].count}`);
    console.log(`🗺️  Clientes con geografía: ${clientsWithGeo[0].count}`);

    // 3. Verificar créditos
    const [creditCount] = await connection.execute('SELECT COUNT(*) as count FROM credits');
    const [activeCredits] = await connection.execute('SELECT COUNT(*) as count FROM credits WHERE status = "Active"');
    console.log(`\n💳 Créditos migrados: ${creditCount[0].count}`);
    console.log(`✅ Créditos activos: ${activeCredits[0].count}`);

    // 4. Verificar pagos
    const [paymentCount] = await connection.execute('SELECT COUNT(*) as count FROM payments_registered');
    console.log(`\n💰 Pagos migrados: ${paymentCount[0].count}`);

    // 5. Verificar geografía
    const [deptCount] = await connection.execute('SELECT COUNT(*) as count FROM departments');
    const [muniCount] = await connection.execute('SELECT COUNT(*) as count FROM municipalities');
    console.log(`\n🌍 Departamentos: ${deptCount[0].count}`);
    console.log(`🏘️  Municipios: ${muniCount[0].count}`);

    // 6. Verificar integridad
    console.log('\n🔍 VERIFICACIÓN DE INTEGRIDAD:');
    
    // Usuarios sin username
    const [usersNoUsername] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE username IS NULL OR username = ""');
    console.log(`   Usuarios sin username: ${usersNoUsername[0].count} ${usersNoUsername[0].count === 0 ? '✅' : '❌'}`);

    // Clientes sin geografía
    const [clientsNoGeo] = await connection.execute('SELECT COUNT(*) as count FROM clients WHERE departmentId IS NULL');
    console.log(`   Clientes sin geografía: ${clientsNoGeo[0].count} ${clientsNoGeo[0].count === 0 ? '✅' : '⚠️'}`);

    // Créditos huérfanos
    const [orphanCredits] = await connection.execute(`
      SELECT COUNT(*) as count FROM credits c 
      LEFT JOIN clients cl ON c.clientId = cl.id 
      WHERE cl.id IS NULL
    `);
    console.log(`   Créditos sin cliente: ${orphanCredits[0].count} ${orphanCredits[0].count === 0 ? '✅' : '❌'}`);

    // 7. Estado general
    console.log('\n📊 ESTADO GENERAL:');
    const totalIssues = usersNoUsername[0].count + orphanCredits[0].count;
    
    if (totalIssues === 0) {
      console.log('   🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
      console.log('   ✅ Todos los datos están correctos');
    } else {
      console.log(`   ⚠️  Se encontraron ${totalIssues} problemas menores`);
      console.log('   💡 Ejecuta: node user-toolkit.js fix-all');
    }

    // 8. Credenciales
    console.log('\n📋 CREDENCIALES PRINCIPALES:');
    console.log('   Usuario: administrador');
    console.log('   Contraseña: password123');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkMigrationStatus();