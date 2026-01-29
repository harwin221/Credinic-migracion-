require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixCreditStatuses() {
  const connection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔄 Convirtiendo estados de créditos de español a inglés...\n');

    // Mapeo de estados español -> inglés
    const statusMapping = {
      'Activo': 'Active',
      'Aprobado': 'Approved', 
      'Pendiente': 'Pending',
      'Pagado': 'Paid',
      'Cancelado': 'Paid',
      'Rechazado': 'Rejected',
      'Anulado': 'Rejected',
      'Expirado': 'Expired',
      'Vencido': 'Expired',
      'Fallecido': 'Fallecido'
    };

    // Verificar estados actuales
    console.log('📊 Estados actuales:');
    const [currentStatuses] = await connection.execute('SELECT status, COUNT(*) as count FROM credits GROUP BY status ORDER BY count DESC');
    currentStatuses.forEach(s => console.log(`   ${s.status}: ${s.count}`));

    let totalUpdated = 0;

    // Actualizar cada estado
    for (const [spanishStatus, englishStatus] of Object.entries(statusMapping)) {
      const [result] = await connection.execute(
        'UPDATE credits SET status = ? WHERE status = ?',
        [englishStatus, spanishStatus]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ ${spanishStatus} -> ${englishStatus}: ${result.affectedRows} créditos actualizados`);
        totalUpdated += result.affectedRows;
      }
    }

    console.log(`\n🎉 Total de créditos actualizados: ${totalUpdated}`);

    // Verificar estados después de la actualización
    console.log('\n📊 Estados después de la actualización:');
    const [newStatuses] = await connection.execute('SELECT status, COUNT(*) as count FROM credits GROUP BY status ORDER BY count DESC');
    newStatuses.forEach(s => console.log(`   ${s.status}: ${s.count}`));

    console.log('\n✅ ¡Conversión de estados completada exitosamente!');
    console.log('💡 Ahora los créditos deberían aparecer correctamente en el frontend.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixCreditStatuses();