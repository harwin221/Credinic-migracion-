require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixMissingBranchAndGestor() {
  const connection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔧 Corrigiendo sucursales y gestores faltantes...\n');

    // 1. Verificar estado actual
    console.log('📊 Estado actual:');
    const [creditsWithoutBranch] = await connection.execute('SELECT COUNT(*) as count FROM credits WHERE branch IS NULL OR branch = ""');
    const [creditsWithoutGestor] = await connection.execute('SELECT COUNT(*) as count FROM credits WHERE collectionsManager IS NULL OR collectionsManager = ""');
    console.log(`   Créditos sin sucursal: ${creditsWithoutBranch[0].count}`);
    console.log(`   Créditos sin gestor: ${creditsWithoutGestor[0].count}`);

    // 2. Crear sucursal principal si no existe
    console.log('\n🏢 Verificando sucursal principal...');
    const [existingSucursal] = await connection.execute('SELECT * FROM sucursales WHERE name = ?', ['Sucursal Principal']);
    
    let sucursalId = 'sucursal_principal';
    if (existingSucursal.length === 0) {
      console.log('   Creando sucursal principal...');
      await connection.execute(
        'INSERT INTO sucursales (id, name, address, phone, manager, active) VALUES (?, ?, ?, ?, ?, ?)',
        [sucursalId, 'Sucursal Principal', 'Dirección Principal', '0000-0000', 'Administrador', 1]
      );
      console.log('   ✅ Sucursal principal creada');
    } else {
      sucursalId = existingSucursal[0].id;
      console.log('   ✅ Sucursal principal ya existe');
    }

    // 3. Buscar un gestor existente o usar administrador
    console.log('\n👤 Buscando gestor disponible...');
    const [gestores] = await connection.execute('SELECT * FROM users WHERE role = "GESTOR" LIMIT 1');
    
    let gestorName = 'Administrador Administrador';
    if (gestores.length > 0) {
      gestorName = gestores[0].fullName;
      console.log(`   Usando gestor: ${gestorName}`);
    } else {
      console.log('   No hay gestores, usando administrador por defecto');
    }

    // 4. Actualizar créditos sin sucursal
    console.log('\n🔄 Actualizando créditos...');
    const [branchResult] = await connection.execute(
      'UPDATE credits SET branch = ?, branchName = ? WHERE branch IS NULL OR branch = ""',
      [sucursalId, 'Sucursal Principal']
    );
    console.log(`   ✅ Sucursal asignada a ${branchResult.affectedRows} créditos`);

    // 5. Actualizar créditos sin gestor
    const [gestorResult] = await connection.execute(
      'UPDATE credits SET collectionsManager = ? WHERE collectionsManager IS NULL OR collectionsManager = ""',
      [gestorName]
    );
    console.log(`   ✅ Gestor asignado a ${gestorResult.affectedRows} créditos`);

    // 6. Verificar resultado final
    console.log('\n📊 Estado después de la corrección:');
    const [finalCreditsWithoutBranch] = await connection.execute('SELECT COUNT(*) as count FROM credits WHERE branch IS NULL OR branch = ""');
    const [finalCreditsWithoutGestor] = await connection.execute('SELECT COUNT(*) as count FROM credits WHERE collectionsManager IS NULL OR collectionsManager = ""');
    console.log(`   Créditos sin sucursal: ${finalCreditsWithoutBranch[0].count}`);
    console.log(`   Créditos sin gestor: ${finalCreditsWithoutGestor[0].count}`);

    // 7. Mostrar algunos ejemplos
    console.log('\n📋 Ejemplos de créditos corregidos:');
    const [examples] = await connection.execute('SELECT creditNumber, clientName, collectionsManager, branchName FROM credits LIMIT 3');
    examples.forEach(c => console.log(`   ${c.creditNumber} - ${c.clientName} - Gestor: ${c.collectionsManager} - Sucursal: ${c.branchName}`));

    console.log('\n🎉 ¡Corrección completada exitosamente!');
    console.log('💡 Ahora los créditos deberían aparecer correctamente en el frontend.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixMissingBranchAndGestor();