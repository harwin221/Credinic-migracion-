require('dotenv').config();
const mysql = require('mysql2/promise');

async function databaseHealthCheck() {
  const connection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🏥 === VERIFICACIÓN DE SALUD DE LA BASE DE DATOS ===\n');

    // 1. Verificar conexión
    console.log('1. 🔌 Verificando conexión...');
    await connection.execute('SELECT 1');
    console.log('   ✅ Conexión exitosa\n');

    // 2. Verificar tablas principales
    console.log('2. 📋 Verificando tablas principales...');
    const tables = ['users', 'clients', 'credits', 'payments_registered', 'departments', 'municipalities'];
    
    for (const table of tables) {
      try {
        const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${result[0].count} registros`);
      } catch (error) {
        console.log(`   ❌ ${table}: ERROR - ${error.message}`);
      }
    }

    // 3. Verificar índices y claves foráneas
    console.log('\n3. 🔗 Verificando integridad referencial...');
    
    // Créditos sin cliente
    const [orphanCredits] = await connection.execute(`
      SELECT COUNT(*) as count FROM credits c 
      LEFT JOIN clients cl ON c.clientId = cl.id 
      WHERE cl.id IS NULL
    `);
    console.log(`   Créditos huérfanos: ${orphanCredits[0].count} ${orphanCredits[0].count === 0 ? '✅' : '❌'}`);

    // Pagos sin crédito
    const [orphanPayments] = await connection.execute(`
      SELECT COUNT(*) as count FROM payments_registered p 
      LEFT JOIN credits c ON p.creditId = c.id 
      WHERE c.id IS NULL
    `);
    console.log(`   Pagos huérfanos: ${orphanPayments[0].count} ${orphanPayments[0].count === 0 ? '✅' : '❌'}`);

    // Clientes sin departamento válido
    const [invalidGeo] = await connection.execute(`
      SELECT COUNT(*) as count FROM clients c 
      LEFT JOIN departments d ON c.departmentId = d.id 
      WHERE c.departmentId IS NOT NULL AND d.id IS NULL
    `);
    console.log(`   Geografía inválida: ${invalidGeo[0].count} ${invalidGeo[0].count === 0 ? '✅' : '❌'}`);

    // 4. Verificar datos críticos
    console.log('\n4. 🔍 Verificando datos críticos...');
    
    // Usuarios sin contraseña
    const [usersNoPassword] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE hashed_password IS NULL');
    console.log(`   Usuarios sin contraseña: ${usersNoPassword[0].count} ${usersNoPassword[0].count === 0 ? '✅' : '❌'}`);

    // Usuarios inactivos
    const [inactiveUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE active = 0');
    console.log(`   Usuarios inactivos: ${inactiveUsers[0].count} ${inactiveUsers[0].count === 0 ? '✅' : 'ℹ️'}`);

    // Clientes sin cédula
    const [clientsNoCedula] = await connection.execute('SELECT COUNT(*) as count FROM clients WHERE cedula IS NULL OR cedula = ""');
    console.log(`   Clientes sin cédula: ${clientsNoCedula[0].count} ${clientsNoCedula[0].count === 0 ? '✅' : '⚠️'}`);

    // 5. Verificar rendimiento
    console.log('\n5. ⚡ Verificando rendimiento...');
    
    const startTime = Date.now();
    await connection.execute('SELECT COUNT(*) FROM clients c JOIN credits cr ON c.id = cr.clientId');
    const queryTime = Date.now() - startTime;
    
    console.log(`   Consulta compleja: ${queryTime}ms ${queryTime < 1000 ? '✅' : queryTime < 3000 ? '⚠️' : '❌'}`);

    // 6. Resumen final
    console.log('\n📊 RESUMEN DE SALUD:');
    const totalIssues = orphanCredits[0].count + orphanPayments[0].count + invalidGeo[0].count + usersNoPassword[0].count;
    
    if (totalIssues === 0) {
      console.log('   🎉 ¡BASE DE DATOS EN PERFECTO ESTADO!');
      console.log('   ✅ Todos los sistemas funcionando correctamente');
    } else if (totalIssues < 5) {
      console.log(`   ⚠️  Se encontraron ${totalIssues} problemas menores`);
      console.log('   💡 Recomendación: Ejecutar scripts de reparación');
    } else {
      console.log(`   ❌ Se encontraron ${totalIssues} problemas importantes`);
      console.log('   🚨 Recomendación: Revisar migración');
    }

    // 7. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    if (usersNoPassword[0].count > 0) {
      console.log('   - Ejecutar: node user-toolkit.js fix-all');
    }
    if (orphanCredits[0].count > 0 || orphanPayments[0].count > 0) {
      console.log('   - Revisar integridad de datos');
    }
    if (queryTime > 3000) {
      console.log('   - Considerar optimización de índices');
    }
    console.log('   - Hacer backup regular de la base de datos');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
  } finally {
    await connection.end();
  }
}

databaseHealthCheck();