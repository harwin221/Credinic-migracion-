require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAddresses() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('=== VERIFICANDO DIRECCIONES ===\n');

    // Verificar clientes con direcciones
    const [clients] = await connection.execute(`
      SELECT 
        c.name, 
        c.department, 
        c.municipality,
        c.departmentId,
        c.municipalityId,
        d.name as departmentName,
        m.name as municipalityName
      FROM clients c
      LEFT JOIN departments d ON c.departmentId = d.id
      LEFT JOIN municipalities m ON c.municipalityId = m.id
      LIMIT 10
    `);

    console.log('Primeros 10 clientes con sus direcciones:');
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   Dept (texto): ${client.department || 'NULL'}`);
      console.log(`   Muni (texto): ${client.municipality || 'NULL'}`);
      console.log(`   Dept ID: ${client.departmentId || 'NULL'}`);
      console.log(`   Muni ID: ${client.municipalityId || 'NULL'}`);
      console.log(`   Dept (relacional): ${client.departmentName || 'NULL'}`);
      console.log(`   Muni (relacional): ${client.municipalityName || 'NULL'}`);
      console.log('   ---');
    });

    // Contar clientes con direcciones
    const [withDept] = await connection.execute('SELECT COUNT(*) as count FROM clients WHERE departmentId IS NOT NULL');
    const [withMuni] = await connection.execute('SELECT COUNT(*) as count FROM clients WHERE municipalityId IS NOT NULL');
    
    console.log(`\nEstadísticas:`);
    console.log(`   Clientes con departmentId: ${withDept[0].count}`);
    console.log(`   Clientes con municipalityId: ${withMuni[0].count}`);

    // Verificar departamentos y municipios
    const [deptCount] = await connection.execute('SELECT COUNT(*) as count FROM departments');
    const [muniCount] = await connection.execute('SELECT COUNT(*) as count FROM municipalities');
    
    console.log(`   Departamentos disponibles: ${deptCount[0].count}`);
    console.log(`   Municipios disponibles: ${muniCount[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkAddresses();