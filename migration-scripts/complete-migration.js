require('dotenv').config();
const mysql = require('mysql2/promise');

// Script maestro de migración completa
// Este script hace toda la migración de una vez para evitar confusiones

async function completeMigration() {
  console.log('🚀 === MIGRACIÓN COMPLETA CREDINICA ===\n');
  console.log('Este script migra todos los datos de la base antigua a la nueva\n');

  const oldConnection = await mysql.createConnection({
    host: process.env.OLD_DB_HOST,
    user: process.env.OLD_DB_USER,
    password: process.env.OLD_DB_PASSWORD,
    database: process.env.OLD_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const newConnection = await mysql.createConnection({
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // ========== PASO 1: LIMPIAR BASE NUEVA ==========
    console.log('🧹 PASO 1: Limpiando base de datos nueva...');
    await newConnection.execute('DELETE FROM payments_registered');
    await newConnection.execute('DELETE FROM payment_plan');
    await newConnection.execute('DELETE FROM guarantors');
    await newConnection.execute('DELETE FROM guarantees');
    await newConnection.execute('DELETE FROM credits');
    await newConnection.execute('DELETE FROM clients');
    await newConnection.execute('DELETE FROM users WHERE username != "administrador"');
    console.log('   ✅ Base de datos limpiada\n');

    // ========== PASO 2: CREAR GEOGRAFÍA ==========
    console.log('🌍 PASO 2: Configurando geografía de Nicaragua...');
    
    // Verificar si ya existe geografía
    const [existingDepts] = await newConnection.execute('SELECT COUNT(*) as count FROM departments');
    if (existingDepts[0].count === 0) {
      // Insertar departamentos
      const departments = [
        { id: 'dept_01', name: 'Boaco' },
        { id: 'dept_02', name: 'Carazo' },
        { id: 'dept_03', name: 'Chinandega' },
        { id: 'dept_04', name: 'Chontales' },
        { id: 'dept_05', name: 'Estelí' },
        { id: 'dept_06', name: 'Granada' },
        { id: 'dept_07', name: 'Jinotega' },
        { id: 'dept_08', name: 'León' },
        { id: 'dept_09', name: 'Madriz' },
        { id: 'dept_10', name: 'Managua' },
        { id: 'dept_11', name: 'Masaya' },
        { id: 'dept_12', name: 'Matagalpa' },
        { id: 'dept_13', name: 'Nueva Segovia' },
        { id: 'dept_14', name: 'Río San Juan' },
        { id: 'dept_15', name: 'Rivas' },
        { id: 'dept_16', name: 'RACCS' },
        { id: 'dept_17', name: 'RACCN' }
      ];

      for (const dept of departments) {
        await newConnection.execute('INSERT INTO departments (id, name) VALUES (?, ?)', [dept.id, dept.name]);
      }

      // Insertar algunos municipios principales (simplificado)
      const municipalities = [
        { id: 'muni_001', name: 'Managua', departmentId: 'dept_10' },
        { id: 'muni_002', name: 'León', departmentId: 'dept_08' },
        { id: 'muni_003', name: 'Granada', departmentId: 'dept_06' },
        { id: 'muni_004', name: 'Masaya', departmentId: 'dept_11' },
        { id: 'muni_005', name: 'Matagalpa', departmentId: 'dept_12' },
        { id: 'muni_006', name: 'Estelí', departmentId: 'dept_05' },
        { id: 'muni_007', name: 'Chinandega', departmentId: 'dept_03' },
        { id: 'muni_008', name: 'Jinotega', departmentId: 'dept_07' },
        { id: 'muni_009', name: 'Boaco', departmentId: 'dept_01' },
        { id: 'muni_010', name: 'Chontales', departmentId: 'dept_04' }
      ];

      for (const muni of municipalities) {
        await newConnection.execute('INSERT INTO municipalities (id, name, departmentId) VALUES (?, ?, ?)', [muni.id, muni.name, muni.departmentId]);
      }

      console.log('   ✅ Geografía configurada (17 departamentos, 10 municipios principales)');
    } else {
      console.log('   ✅ Geografía ya existe');
    }

    // ========== PASO 3: CREAR SUCURSAL PRINCIPAL ==========
    console.log('\n🏢 PASO 3: Configurando sucursal principal...');
    const [existingSucursal] = await newConnection.execute('SELECT * FROM sucursales WHERE name = ?', ['Sucursal Principal']);
    let sucursalId = 'sucursal_principal';
    
    if (existingSucursal.length === 0) {
      await newConnection.execute(
        'INSERT INTO sucursales (id, name, address, phone, manager, active) VALUES (?, ?, ?, ?, ?, ?)',
        [sucursalId, 'Sucursal Principal', 'Dirección Principal', '0000-0000', 'Administrador', 1]
      );
      console.log('   ✅ Sucursal principal creada');
    } else {
      sucursalId = existingSucursal[0].id;
      console.log('   ✅ Sucursal principal ya existe');
    }

    // ========== PASO 4: MIGRAR USUARIOS ==========
    console.log('\n👥 PASO 4: Migrando usuarios...');
    const [oldUsers] = await oldConnection.execute('SELECT * FROM usuarios');
    let userCount = 0;

    for (const oldUser of oldUsers) {
      const userId = `user_${oldUser.id_usuario}`;
      const fullName = `${oldUser.nombre || ''} ${oldUser.apellido || ''}`.trim() || 'Usuario Sin Nombre';
      const role = oldUser.tipo_usuario === 'administrador' ? 'ADMINISTRADOR' : 
                   oldUser.tipo_usuario === 'gestor' ? 'GESTOR' : 'OPERATIVO';

      await newConnection.execute(`
        INSERT INTO users (id, fullName, email, username, hashed_password, role, sucursal_id, sucursal_name, active, legacyId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, fullName, oldUser.email || '', oldUser.usuario || `user${oldUser.id_usuario}`,
        '$2a$10$7s6on4CsiBPWc5hgrFIdt.C34.b3.YfyPqj.FPGhhI1pENOe2h8cC', // password123
        role, sucursalId, 'Sucursal Principal', 1, oldUser.id_usuario
      ]);
      userCount++;
    }
    console.log(`   ✅ ${userCount} usuarios migrados`);

    // ========== PASO 5: MIGRAR CLIENTES ==========
    console.log('\n🏠 PASO 5: Migrando clientes...');
    const [oldClients] = await oldConnection.execute('SELECT * FROM clientes');
    let clientCount = 0;

    for (const oldClient of oldClients) {
      const clientId = `client_${oldClient.id_cliente}`;
      
      // Asignar geografía por defecto (Managua)
      const departmentId = 'dept_10'; // Managua
      const municipalityId = 'muni_001'; // Managua

      await newConnection.execute(`
        INSERT INTO clients (id, name, cedula, phone, address, departmentId, municipalityId, legacyId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        clientId,
        oldClient.nombre || 'Cliente Sin Nombre',
        oldClient.cedula || '',
        oldClient.telefono || '',
        oldClient.direccion || '',
        departmentId,
        municipalityId,
        oldClient.id_cliente
      ]);
      clientCount++;
    }
    console.log(`   ✅ ${clientCount} clientes migrados`);

    // ========== PASO 6: MIGRAR CRÉDITOS ==========
    console.log('\n💳 PASO 6: Migrando créditos...');
    const [oldCredits] = await oldConnection.execute('SELECT * FROM creditos');
    let creditCount = 0;

    // Buscar un gestor para asignar por defecto
    const [gestores] = await newConnection.execute('SELECT * FROM users WHERE role = "GESTOR" LIMIT 1');
    const defaultGestor = gestores.length > 0 ? gestores[0].fullName : 'Administrador Administrador';

    for (const oldCredit of oldCredits) {
      const creditId = `credit_${oldCredit.id_credito}`;
      const clientId = `client_${oldCredit.id_cliente}`;
      
      // Obtener nombre del cliente
      const [clientData] = await newConnection.execute('SELECT name FROM clients WHERE legacyId = ?', [oldCredit.id_cliente]);
      const clientName = clientData.length > 0 ? clientData[0].name : 'Cliente Desconocido';

      // Mapear estado
      let status = 'Active';
      if (oldCredit.estado === 'pagado' || oldCredit.estado === 'cancelado') status = 'Paid';
      else if (oldCredit.estado === 'anulado' || oldCredit.estado === 'rechazado') status = 'Rejected';

      await newConnection.execute(`
        INSERT INTO credits (
          id, creditNumber, clientId, clientName, status, applicationDate, approvalDate, approvedBy,
          amount, principalAmount, interestRate, termMonths, paymentFrequency, currencyType,
          totalAmount, totalInterest, totalInstallmentAmount, firstPaymentDate, deliveryDate, dueDate,
          collectionsManager, createdBy, branch, branchName, productType, subProduct, productDestination,
          legacyId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        creditId, `CRE-${String(oldCredit.id_credito).padStart(6, '0')}`, clientId, clientName,
        status, oldCredit.fecha_solicitud || new Date(), oldCredit.fecha_aprobacion || new Date(), 'Sistema',
        oldCredit.monto || 0, oldCredit.monto || 0, oldCredit.tasa_interes || 3.5, oldCredit.plazo_meses || 12,
        'Diario', 'CÓRDOBAS', oldCredit.monto_total || oldCredit.monto || 0, 
        (oldCredit.monto_total || oldCredit.monto || 0) - (oldCredit.monto || 0), 
        oldCredit.cuota_diaria || 0, oldCredit.fecha_primer_pago || new Date(),
        oldCredit.fecha_desembolso || new Date(), oldCredit.fecha_vencimiento || new Date(),
        defaultGestor, 'Sistema', sucursalId, 'Sucursal Principal',
        'Microcrédito', 'Comercio', 'Capital de Trabajo', oldCredit.id_credito
      ]);
      creditCount++;
    }
    console.log(`   ✅ ${creditCount} créditos migrados`);

    // ========== PASO 7: MIGRAR PAGOS ==========
    console.log('\n💰 PASO 7: Migrando pagos...');
    const [oldPayments] = await oldConnection.execute('SELECT * FROM pagos');
    let paymentCount = 0;

    for (const oldPayment of oldPayments) {
      const paymentId = `payment_${oldPayment.id_pago}`;
      const creditId = `credit_${oldPayment.id_credito}`;

      await newConnection.execute(`
        INSERT INTO payments_registered (id, creditId, paymentDate, amount, managedBy, transactionNumber, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        paymentId, creditId, oldPayment.fecha_pago || new Date(),
        oldPayment.monto || 0, defaultGestor, oldPayment.numero_transaccion || '',
        oldPayment.estado === 'anulado' ? 'ANULADO' : 'VALIDO'
      ]);
      paymentCount++;
    }
    console.log(`   ✅ ${paymentCount} pagos migrados`);

    // ========== PASO 8: CONVERTIR ESTADOS A INGLÉS ==========
    console.log('\n🔄 PASO 8: Normalizando estados...');
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

    let totalUpdated = 0;
    for (const [spanishStatus, englishStatus] of Object.entries(statusMapping)) {
      const [result] = await newConnection.execute(
        'UPDATE credits SET status = ? WHERE status = ?',
        [englishStatus, spanishStatus]
      );
      totalUpdated += result.affectedRows;
    }
    console.log(`   ✅ ${totalUpdated} estados normalizados`);

    // ========== PASO 9: CREAR USUARIO ADMINISTRADOR ==========
    console.log('\n👑 PASO 9: Configurando usuario administrador...');
    const [existingAdmin] = await newConnection.execute('SELECT * FROM users WHERE username = ?', ['administrador']);
    
    if (existingAdmin.length === 0) {
      await newConnection.execute(`
        INSERT INTO users (id, fullName, email, username, hashed_password, role, sucursal_id, sucursal_name, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'user_admin', 'Administrador Administrador', 'administrador', 'administrador',
        '$2a$10$7s6on4CsiBPWc5hgrFIdt.C34.b3.YfyPqj.FPGhhI1pENOe2h8cC', // password123
        'ADMINISTRADOR', sucursalId, 'Sucursal Principal', 1
      ]);
      console.log('   ✅ Usuario administrador creado');
    } else {
      // Asegurar que tenga username correcto
      await newConnection.execute('UPDATE users SET username = ? WHERE id = ?', ['administrador', existingAdmin[0].id]);
      console.log('   ✅ Usuario administrador verificado');
    }

    // ========== RESUMEN FINAL ==========
    console.log('\n📊 === RESUMEN DE MIGRACIÓN ===');
    
    const [finalUsers] = await newConnection.execute('SELECT COUNT(*) as count FROM users');
    const [finalClients] = await newConnection.execute('SELECT COUNT(*) as count FROM clients');
    const [finalCredits] = await newConnection.execute('SELECT COUNT(*) as count FROM credits');
    const [finalPayments] = await newConnection.execute('SELECT COUNT(*) as count FROM payments_registered');
    const [activeCredits] = await newConnection.execute('SELECT COUNT(*) as count FROM credits WHERE status = "Active"');

    console.log(`👥 Usuarios migrados: ${finalUsers[0].count}`);
    console.log(`🏠 Clientes migrados: ${finalClients[0].count}`);
    console.log(`💳 Créditos migrados: ${finalCredits[0].count}`);
    console.log(`💰 Pagos migrados: ${finalPayments[0].count}`);
    console.log(`✅ Créditos activos: ${activeCredits[0].count}`);

    console.log('\n🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
    console.log('📋 CREDENCIALES DE ACCESO:');
    console.log('   Usuario: administrador');
    console.log('   Contraseña: password123');
    console.log('\n💡 El sistema está listo para usar!');

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await oldConnection.end();
    await newConnection.end();
  }
}

completeMigration();