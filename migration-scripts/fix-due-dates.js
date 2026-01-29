require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixDueDates() {
  const connection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('📅 Corrigiendo fechas de vencimiento...\n');

    // Obtener créditos con fechas inválidas
    const [credits] = await connection.execute(`
      SELECT id, creditNumber, firstPaymentDate, termMonths, paymentFrequency 
      FROM credits 
      WHERE dueDate IS NULL OR dueDate = '0000-00-00 00:00:00'
    `);

    console.log(`📊 Encontrados ${credits.length} créditos con fechas de vencimiento inválidas`);

    let fixedCount = 0;

    for (const credit of credits) {
      try {
        if (!credit.firstPaymentDate || !credit.termMonths) {
          console.log(`⚠️  Saltando ${credit.creditNumber}: faltan datos`);
          continue;
        }

        // Calcular fecha de vencimiento
        const firstPayment = new Date(credit.firstPaymentDate);
        let dueDate = new Date(firstPayment);

        // Calcular según frecuencia de pago
        if (credit.paymentFrequency === 'Diario') {
          // Para pagos diarios, agregar los días correspondientes a los meses
          const totalDays = credit.termMonths * 30; // Aproximadamente 30 días por mes
          dueDate.setDate(dueDate.getDate() + totalDays);
        } else if (credit.paymentFrequency === 'Semanal') {
          const totalWeeks = credit.termMonths * 4; // 4 semanas por mes
          dueDate.setDate(dueDate.getDate() + (totalWeeks * 7));
        } else if (credit.paymentFrequency === 'Quincenal') {
          const totalQuincenas = credit.termMonths * 2; // 2 quincenas por mes
          dueDate.setDate(dueDate.getDate() + (totalQuincenas * 15));
        } else {
          // Por defecto, agregar meses
          dueDate.setMonth(dueDate.getMonth() + credit.termMonths);
        }

        // Formatear fecha para MySQL
        const dueDateStr = dueDate.toISOString().slice(0, 19).replace('T', ' ');

        // Actualizar en la base de datos
        await connection.execute(
          'UPDATE credits SET dueDate = ? WHERE id = ?',
          [dueDateStr, credit.id]
        );

        console.log(`✅ ${credit.creditNumber}: ${dueDateStr}`);
        fixedCount++;

      } catch (error) {
        console.log(`❌ Error con ${credit.creditNumber}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Se corrigieron ${fixedCount} fechas de vencimiento`);

    // Verificar resultado
    console.log('\n📋 Verificando algunos ejemplos:');
    const [samples] = await connection.execute('SELECT creditNumber, dueDate FROM credits LIMIT 3');
    samples.forEach(s => console.log(`   ${s.creditNumber}: ${s.dueDate}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixDueDates();