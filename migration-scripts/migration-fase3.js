// MIGRACIÓN FASE 3: PAGOS (ABONOS)
require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const SIMULATION_MODE = false;
const BATCH_SIZE = 50; // Procesar pagos en lotes de 50

// --- GENERADORES DE ID BONITOS ---
let paymentCounter = 1;
const generatePaymentId = () => `pay_${String(paymentCounter++).padStart(3, '0')}`;

// --- CONFIGURACIÓN DE CONEXIONES ---
const oldDbConfig = {
    host: process.env.OLD_DB_HOST,
    user: process.env.OLD_DB_USER,
    password: process.env.OLD_DB_PASSWORD,
    database: process.env.OLD_DB_DATABASE,
    charset: 'utf8mb4'
};

const newDbConfig = {
    host: process.env.NEW_DB_HOST,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD,
    database: process.env.NEW_DB_DATABASE,
    charset: 'utf8mb4'
};

// --- DICCIONARIOS ---
const PAYMENT_STATUS_MAP = { 1: 'valido', 2: 'anulado' };

async function prepareSchema(newDbConnection) {
    console.log(`--- PREPARANDO ESQUEMA PARA PAGOS ---`);
    const checkSql = `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`;
    const [rows] = await newDbConnection.execute(checkSql, [newDbConfig.database, 'payments_registered', 'legacyId']);

    if (rows[0].count === 0) {
        if (!SIMULATION_MODE) {
            const addSql = `ALTER TABLE payments_registered ADD COLUMN legacyId INT`;
            await newDbConnection.execute(addSql);
            console.log(`  ✅ Columna 'legacyId' creada en 'payments_registered'.`);
        }
    }
}

async function reconnectIfNeeded(connection, config) {
    try {
        await connection.ping();
        return connection;
    } catch (error) {
        console.log('  🔄 Reconectando a la base de datos...');
        await connection.end();
        const newConnection = await mysql.createConnection(config);
        await newConnection.beginTransaction();
        return newConnection;
    }
}

async function migratePaymentsBatch(oldDbConnection, newDbConnection, creditMap, userClientMap, payments, startIndex, endIndex) {
    const batch = payments.slice(startIndex, endIndex);
    let processedCount = 0;
    let skippedCount = 0;

    for (const payment of batch) {
        const newCreditId = creditMap[payment.prestamo_id];
        if (!newCreditId) {
            skippedCount++;
            continue;
        }
        
        const newId = generatePaymentId();
        const managedByNewId = userClientMap[payment.created_used_id] || userClientMap[1]; // Admin por defecto

        // Mantener la hora exacta del pago (NO convertir a mediodía)
        // Los pagos necesitan la hora precisa de cuando se realizaron
        const paymentDateTime = payment.fecha_abono; // Mantener fecha y hora original

        const sql = `INSERT INTO payments_registered (id, legacyId, creditId, paymentDate, amount, managedBy, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            newId, payment.id, newCreditId, paymentDateTime, 
            payment.total_efectivo, managedByNewId,
            PAYMENT_STATUS_MAP[payment.estado] || 'valido'
        ];

        try {
            if (!SIMULATION_MODE) {
                await newDbConnection.execute(sql, values);
                processedCount++;
            }
        } catch (error) {
            console.log(`  ❌ Error al importar pago ID ${payment.id}: ${error.message}`);
            continue;
        }
    }

    return { processedCount, skippedCount };
}

async function migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap) {
    console.log(`--- FASE 3: MIGRANDO PAGOS EN LOTES ---`);
    
    const [payments] = await oldDbConnection.execute("SELECT * FROM abonos");
    console.log(`  📊 Total de pagos a procesar: ${payments.length}`);
    
    let totalProcessed = 0;
    let totalSkipped = 0;
    const totalBatches = Math.ceil(payments.length / BATCH_SIZE);

    for (let i = 0; i < payments.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const startIndex = i;
        const endIndex = Math.min(i + BATCH_SIZE, payments.length);
        
        console.log(`  📦 Procesando lote ${batchNumber}/${totalBatches} (${startIndex + 1}-${endIndex})...`);
        
        // Reconectar si es necesario
        newDbConnection = await reconnectIfNeeded(newDbConnection, newDbConfig);
        
        const { processedCount, skippedCount } = await migratePaymentsBatch(
            oldDbConnection, newDbConnection, creditMap, userClientMap, 
            payments, startIndex, endIndex
        );
        
        totalProcessed += processedCount;
        totalSkipped += skippedCount;
        
        console.log(`    ✅ Lote ${batchNumber}: ${processedCount} procesados, ${skippedCount} omitidos`);
        
        // Pequeña pausa entre lotes para no sobrecargar el servidor
        if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (totalSkipped > 0) console.log(`  ⚠️  Se omitieron ${totalSkipped} pagos por no encontrar su crédito.`);
    console.log(`  ✅ ${totalProcessed} pagos migrados exitosamente en ${totalBatches} lotes.`);
    
    return newDbConnection;
}

async function runFase3() {
    let oldDbConnection, newDbConnection;
    console.log('🚀 INICIANDO MIGRACIÓN FASE 3: PAGOS');

    try {
        // Cargar mapas de las fases anteriores
        if (!fs.existsSync('./translation-map.json')) {
            throw new Error('❌ No se encontró translation-map.json. Ejecuta primero la Fase 1.');
        }
        if (!fs.existsSync('./credit-map.json')) {
            throw new Error('❌ No se encontró credit-map.json. Ejecuta primero la Fase 2.');
        }

        const userClientMap = JSON.parse(fs.readFileSync('./translation-map.json', 'utf8'));
        const creditMap = JSON.parse(fs.readFileSync('./credit-map.json', 'utf8'));
        
        console.log(`📋 Mapa de usuarios/clientes: ${Object.keys(userClientMap).length} registros.`);
        console.log(`📋 Mapa de créditos: ${Object.keys(creditMap).length} registros.`);

        console.log('🔌 Conectando a bases de datos...');
        oldDbConnection = await mysql.createConnection(oldDbConfig);
        newDbConnection = await mysql.createConnection(newDbConfig);
        console.log('✅ Conexiones exitosas.');

        await newDbConnection.beginTransaction();
        
        await prepareSchema(newDbConnection);
        newDbConnection = await migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap);
        
        if (!SIMULATION_MODE) {
            await newDbConnection.commit();
            console.log('\n💾 FASE 3 COMPLETADA Y GUARDADA');
        } else {
            await newDbConnection.rollback();
            console.log('\n⏪ SIMULACIÓN COMPLETADA');
        }

    } catch (error) {
        console.error('\n❌ ERROR EN FASE 3:', error.message);
        if (newDbConnection) {
            try {
                await newDbConnection.rollback();
            } catch (rollbackError) {
                console.error('Error en rollback:', rollbackError.message);
            }
        }
    } finally {
        if (oldDbConnection) await oldDbConnection.end();
        if (newDbConnection) await newDbConnection.end();
        console.log('\n🚪 Fase 3 finalizada.');
    }
}

runFase3();