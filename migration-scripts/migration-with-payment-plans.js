// Importamos las librerías necesarias
require('dotenv').config();
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');

// --- CONFIGURACIÓN GLOBAL ---
// ¡¡MODO DE SEGURIDAD!! true = Solo simula e imprime. false = Ejecuta los cambios en la BD nueva.
const SIMULATION_MODE = false;

// --- GENERADORES DE ID (EMULANDO LA LÓGICA DE LA APP NUEVA) ---
const generateCreditId = () => `cred_${randomUUID()}`;
const generateClientId = () => `cli_${randomUUID()}`;
const generateUserId = () => `user_${randomUUID()}`;
const generatePaymentId = () => `pay_${randomUUID()}`;

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

// --- DICCIONARIOS DE TRADUCCIÓN ---
const SEX_MAP = { 0: 'Masculino', 1: 'Femenino' };
const CIVIL_STATUS_MAP = { 0: 'Soltero', 1: 'Casado', 2: 'Union Libre', 3: 'Viudo(a)', 4: 'Divorciado' };
const USER_ROLE_MAP = { 1: 'ADMINISTRADOR', 2: 'FINANZAS', 4: 'GESTOR' };
const CREDIT_STATUS_MAP = { 1: 'Active', 2: 'Paid', 3: 'Expired', 4: 'Rejected' };
const PAYMENT_FREQ_MAP = { 1: 'Diario', 2: 'Semanal', 3: 'Quincenal', 4: 'Catorcenal' };
const CURRENCY_MAP = { 0: 'Cordobas' };
const PAYMENT_STATUS_MAP = { 1: 'valido', 2: 'anulado' };

// --- FUNCIÓN PARA GENERAR PLAN DE PAGOS ---
function formatDateForUser(date, format = 'dd/MM/yyyy') {
    if (!date) return '';
    
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        if (format === 'yyyy-MM-dd') {
            return d.toISOString().split('T')[0];
        }
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (error) {
        return '';
    }
}

function generatePaymentSchedule(data) {
    const loanAmount = Number(data.loanAmount);
    const monthlyInterestRate = Number(data.monthlyInterestRate);
    const termMonths = Number(data.termMonths);
    let { paymentFrequency, startDate: dateInput } = data;

    // Validaciones
    if (!dateInput || isNaN(loanAmount) || loanAmount <= 0 || isNaN(monthlyInterestRate) || monthlyInterestRate < 0 || isNaN(termMonths) || termMonths <= 0) {
        return null;
    }

    // Parsing de fecha
    let initialDate;
    try {
        if (dateInput.includes('T')) {
            initialDate = new Date(dateInput);
        } else {
            initialDate = new Date(`${dateInput}T12:00:00`); // Usar mediodía
        }
        if (isNaN(initialDate.getTime())) return null;
    } catch (error) {
        return null;
    }

    // Cálculo de numberOfPayments
    let numberOfPayments;
    let daysBetweenPayments;
    
    switch (paymentFrequency) {
        case 'Diario': 
            numberOfPayments = Math.round(termMonths * 20); 
            daysBetweenPayments = 1;
            break;
        case 'Semanal': 
            numberOfPayments = Math.round(termMonths * 4); 
            daysBetweenPayments = 7;
            break;
        case 'Catorcenal': 
            numberOfPayments = Math.round(termMonths * 2); 
            daysBetweenPayments = 14;
            break;
        case 'Quincenal': 
            numberOfPayments = Math.round(termMonths * 2); 
            daysBetweenPayments = 15;
            break;
        default: return null;
    }

    if (numberOfPayments <= 0) return null;

    // Cálculos financieros básicos
    const totalInterest = loanAmount * (monthlyInterestRate / 100) * termMonths;
    const totalPayment = loanAmount + totalInterest;
    const periodicPayment = totalPayment / numberOfPayments;
    const periodicInterest = totalInterest / numberOfPayments;
    const periodicPrincipal = loanAmount / numberOfPayments;

    // Generar schedule
    const schedule = [];
    let remainingBalance = totalPayment;
    let currentDate = new Date(initialDate);

    for (let i = 1; i <= numberOfPayments; i++) {
        remainingBalance -= periodicPayment;
        
        schedule.push({
            paymentNumber: i,
            paymentDate: currentDate.toISOString().split('T')[0],
            amount: Math.round(periodicPayment * 100) / 100, // Redondear a 2 decimales
            principal: Math.round(periodicPrincipal * 100) / 100,
            interest: Math.round(periodicInterest * 100) / 100,
            balance: Math.max(0, Math.round(remainingBalance * 100) / 100),
        });

        // Avanzar fecha para siguiente pago
        if (paymentFrequency === 'Quincenal') {
            // Lógica especial para quincenal (15 y 30/31 de cada mes)
            if (currentDate.getDate() <= 15) {
                currentDate.setDate(30);
                if (currentDate.getDate() !== 30) { // Si el mes no tiene 30, usar el último día
                    currentDate.setDate(0); // Último día del mes anterior
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(15);
            }
        } else {
            currentDate.setDate(currentDate.getDate() + daysBetweenPayments);
        }
    }

    return { schedule };
}

// --- FUNCIONES DE MIGRACIÓN POR FASE ---

async function prepareSchema(newDbConnection) {
    console.log(`--- FASE -1: Preparando esquema de la nueva BD ---`);

    const tablesToUpdate = [
        { tableName: 'users', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'clients', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'credits', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'payments_registered', columnName: 'legacyId', columnType: 'INT' }
    ];

    for (const table of tablesToUpdate) {
        const { tableName, columnName, columnType } = table;
        console.log(`  🛡️  Verificando la columna '${columnName}' en la tabla '${tableName}'...`);

        const checkSql = `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`;
        const [rows] = await newDbConnection.execute(checkSql, [newDbConfig.database, tableName, columnName]);

        if (rows[0].count === 0) {
            console.log(`    -> La columna no existe. Creándola...`);
            if (SIMULATION_MODE) {
                 console.log(`    [SIM] Se ejecutaría: ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
            } else {
                const addSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
                await newDbConnection.execute(addSql);
                console.log(`    ✅ Columna '${columnName}' creada en '${tableName}'.`);
            }
        } else {
            console.log(`    -> La columna ya existe. No se necesitan cambios.`);
        }
    }
    
    console.log(`--- FASE -1 COMPLETADA ---\n`);
}

async function cleanDestinationTables(newDbConnection) {
    console.log(`--- FASE 0: Limpiando tablas de destino ---`);
    if (SIMULATION_MODE) {
        console.log("  [SIM] En modo real, se vaciarían las tablas de destino.");
        return;
    }
    console.log("  🧹 Vaciando tablas de destino para una importación fresca...");
    await newDbConnection.execute('SET FOREIGN_KEY_CHECKS = 0;');
    await newDbConnection.execute('TRUNCATE TABLE payment_plan;'); // AGREGAR ESTA LÍNEA
    await newDbConnection.execute('TRUNCATE TABLE payments_registered;');
    await newDbConnection.execute('TRUNCATE TABLE credits;');
    await newDbConnection.execute('TRUNCATE TABLE clients;');
    await newDbConnection.execute('TRUNCATE TABLE users;');
    await newDbConnection.execute('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('  ✅ Tablas de destino limpias.');
    console.log(`--- FASE 0 COMPLETADA ---\n`);
}

async function getGeoMaps(oldDbConnection, newDbConnection) {
    // Obtener mapas de la BD antigua
    const [oldDepts] = await oldDbConnection.execute("SELECT id, nombre FROM departamento");
    const [oldMunis] = await oldDbConnection.execute("SELECT id, nombre, departamento_id FROM departamento_municipio");
    
    // Obtener mapas de la BD nueva
    const [newDepts] = await newDbConnection.execute("SELECT id, name FROM departments");
    const [newMunis] = await newDbConnection.execute("SELECT id, name FROM municipalities");
    
    // Crear mapas de nombres a IDs nuevos
    const newDeptNameToId = newDepts.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});
    const newMuniNameToId = newMunis.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});
    
    return {
        // Mapas antiguos (ID antiguo -> nombre y departamento)
        oldDepartmentMap: oldDepts.reduce((acc, row) => ({ ...acc, [row.id]: row.nombre }), {}),
        oldMunicipalityMap: oldMunis.reduce((acc, row) => ({ 
            ...acc, 
            [row.id]: { 
                nombre: row.nombre, 
                departamento_id: row.departamento_id 
            } 
        }), {}),
        // Mapas nuevos (nombre -> ID nuevo)
        newDeptNameToId,
        newMuniNameToId
    };
}

async function migrateUsersAndClients(oldDbConnection, newDbConnection, geoMaps) {
    console.log(`--- FASE 1: Importando USUARIOS y CLIENTES (Lógica Definitiva) ---`);
    const [users] = await oldDbConnection.execute("SELECT * FROM users");
    const translationMap = {};

    for (const user of users) {
        const userRole = USER_ROLE_MAP[user.tipo_usuario];

        if (userRole) { // Es un Usuario del Sistema
            const newId = generateUserId();
            translationMap[user.id] = newId;
            const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
            const email = user.username || `legacy_user_${user.id}@placeholder.com`;
            // Generar username basado en el email o crear uno único
            const username = user.username ? user.username.toLowerCase().replace(/[@.]/g, '') : `user${user.id}`;

            const sql = `INSERT INTO users (id, legacyId, fullName, email, username, hashed_password, phone, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                newId, 
                user.id, 
                fullName, 
                email,
                username, // Agregar username
                user.password || 'default_password_hash',
                user.telefono1 || null, 
                userRole || 'GESTOR', 
                user.created_at, 
                user.updated_at
            ];

            console.log(`  [${SIMULATION_MODE ? 'SIM': 'REAL'}] Importando USUARIO: ${fullName} (Username: ${username}) (ID Antiguo: ${user.id} -> ID Nuevo: ${newId})`);
            if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
        } else if (user.tipo_usuario === 3) { // Es un Cliente
            const newId = generateClientId();
            translationMap[user.id] = newId;
            const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
            const clientNumber = `CLI-${String(user.id).padStart(6, '0')}`;

            // Obtener información de geografía
            const municipalityInfo = geoMaps.oldMunicipalityMap[user.dep_mun];
            const municipalityName = municipalityInfo ? municipalityInfo.nombre : null;
            const departmentName = municipalityInfo ? geoMaps.oldDepartmentMap[municipalityInfo.departamento_id] : null;
            
            const departmentId = departmentName ? geoMaps.newDeptNameToId[departmentName] : null;
            const municipalityId = municipalityName ? geoMaps.newMuniNameToId[municipalityName] : null;

            const sql = `INSERT INTO clients (id, legacyId, clientNumber, name, firstName, lastName, cedula, phone, sex, civilStatus, department, municipality, departmentId, municipalityId, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                newId, 
                user.id, 
                clientNumber, 
                fullName, 
                user.nombres || '', 
                user.apellidos || '', 
                user.cedula || '', 
                user.telefono1 || '', 
                SEX_MAP[user.sexo] || 'Masculino', 
                CIVIL_STATUS_MAP[user.estado_civil] || 'Soltero', 
                departmentName || '', // Mantener compatibilidad
                municipalityName || '', // Mantener compatibilidad
                departmentId || null, // Nuevo campo relacional
                municipalityId || null, // Nuevo campo relacional
                user.direccion || '', // Dirección completa
                user.created_at || new Date(), 
                user.updated_at || new Date()
            ];

            console.log(`  [${SIMULATION_MODE ? 'SIM': 'REAL'}] Importando CLIENTE: ${fullName} (ID Antiguo: ${user.id} -> ID Nuevo: ${newId})`);
            if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
        } else {
            console.log(`  [AVISO] Omitiendo registro con ID antiguo ${user.id} (tipo_usuario: ${user.tipo_usuario}) - No es Usuario ni Cliente.`);
        }
    }
    console.log('  ✅ Usuarios y Clientes importados.');
    console.log(`--- FASE 1 COMPLETADA ---\n`);
    return translationMap;
}

async function migrateCredits(oldDbConnection, newDbConnection, userClientMap) {
    console.log(`--- FASE 2: Importando CRÉDITOS CON PLANES DE PAGO ---`);
    const [credits] = await oldDbConnection.execute("SELECT * FROM prestamos");
    
    // Obtener información de gestores de la BD antigua
    const [gestores] = await oldDbConnection.execute("SELECT id, nombres, apellidos FROM users WHERE tipo_usuario = 4");
    const gestorMap = gestores.reduce((acc, gestor) => {
        const fullName = `${gestor.nombres || ''} ${gestor.apellidos || ''}`.trim();
        return { ...acc, [gestor.id]: fullName };
    }, {});
    
    // Crear sucursal principal si no existe
    const [existingSucursal] = await newDbConnection.execute('SELECT * FROM sucursales WHERE name = ?', ['Sucursal Principal']);
    let sucursalId = 'sucursal_principal';
    if (existingSucursal.length === 0) {
        console.log('  🏢 Creando sucursal principal...');
        if (!SIMULATION_MODE) {
            await newDbConnection.execute(
                'INSERT INTO sucursales (id, name, address, phone, manager, active) VALUES (?, ?, ?, ?, ?, ?)',
                [sucursalId, 'Sucursal Principal', 'Dirección Principal', '0000-0000', 'Administrador', 1]
            );
        }
        console.log('  ✅ Sucursal principal creada');
    } else {
        sucursalId = existingSucursal[0].id;
    }
    
    const creditMap = {};
    let skippedCount = 0;
    let creditsWithPlan = 0;
    let creditsWithoutPlan = 0;

    for (const credit of credits) {
        const newClientId = userClientMap[credit.user_id];
        if (!newClientId) {
            console.log(`  [AVISO] Omitiendo crédito con ID antiguo ${credit.id} porque su cliente (ID antiguo ${credit.user_id}) no fue migrado.`);
            skippedCount++;
            continue;
        }

        const newId = generateCreditId();
        creditMap[credit.id] = newId;
        const creditNumber = `CRE-${String(credit.id).padStart(6, '0')}`;
        
        // Obtener nombre del gestor
        const gestorName = gestorMap[credit.agente_id] || 'Administrador Administrador';

        const sql = `INSERT INTO credits (id, legacyId, creditNumber, clientId, clientName, status, applicationDate, approvalDate, amount, principalAmount, interestRate, termMonths, paymentFrequency, currencyType, totalAmount, totalInterest, totalInstallmentAmount, firstPaymentDate, deliveryDate, collectionsManager, branch, branchName, createdAt, updatedAt) VALUES (?, ?, ?, ?, (SELECT name FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const values = [
            newId, 
            credit.id, 
            creditNumber, 
            newClientId, 
            newClientId, 
            CREDIT_STATUS_MAP[credit.estado] || 'Active', // Usar 'Active' en inglés
            credit.fecha_desembolso || new Date(),
            credit.fecha_desembolso || null,
            credit.monto_prestamo || 0,
            credit.monto_prestamo || 0,
            credit.tasa_prestamo || 0,
            credit.plazo_pago || 0,
            PAYMENT_FREQ_MAP[credit.forma_pago_tipo] || 'Diario',
            CURRENCY_MAP[credit.moneda_prestamo] || 'Cordobas',
            credit.monto_financiado || 0,
            credit.interes_total_pagar || 0,
            credit.monto_cuota || 0,
            credit.fecha_primer_pago || null,
            credit.fecha_desembolso || null,
            gestorName, // Nombre completo del gestor
            sucursalId, // ID de la sucursal
            'Sucursal Principal', // Nombre de la sucursal
            credit.created_at, 
            credit.updated_at
        ];

        console.log(`  [${SIMULATION_MODE ? 'SIM': 'REAL'}] Importando CRÉDITO: ${creditNumber} - Gestor: ${gestorName}`);
        if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);

        // *** NUEVA FUNCIONALIDAD: GENERAR PLAN DE PAGOS DURANTE LA MIGRACIÓN ***
        if (CREDIT_STATUS_MAP[credit.estado] === 'Active') {
            const scheduleData = generatePaymentSchedule({
                loanAmount: credit.monto_prestamo || 0,
                monthlyInterestRate: credit.tasa_prestamo || 0,
                termMonths: credit.plazo_pago || 0,
                paymentFrequency: PAYMENT_FREQ_MAP[credit.forma_pago_tipo] || 'Diario',
                startDate: formatDateForUser(credit.fecha_primer_pago, 'yyyy-MM-dd')
            });

            if (scheduleData && scheduleData.schedule.length > 0) {
                console.log(`    📋 Generando plan de pagos: ${scheduleData.schedule.length} cuotas`);
                
                if (!SIMULATION_MODE) {
                    // Insertar plan de pagos
                    for (const payment of scheduleData.schedule) {
                        await newDbConnection.execute(
                            'INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [
                                newId,
                                payment.paymentNumber,
                                `${payment.paymentDate} 12:00:00`,
                                payment.amount,
                                payment.principal,
                                payment.interest,
                                payment.balance
                            ]
                        );
                    }

                    // Actualizar fecha de vencimiento
                    const lastPayment = scheduleData.schedule[scheduleData.schedule.length - 1];
                    await newDbConnection.execute(
                        'UPDATE credits SET dueDate = ? WHERE id = ?',
                        [`${lastPayment.paymentDate} 12:00:00`, newId]
                    );
                }
                creditsWithPlan++;
            } else {
                console.log(`    ❌ No se pudo generar plan de pagos para ${creditNumber}`);
                creditsWithoutPlan++;
            }
        }
    }
    
    if (skippedCount > 0) console.log(`  Se omitieron ${skippedCount} créditos por no encontrar a su cliente/usuario correspondiente.`);
    console.log(`  ✅ Créditos importados: ${credits.length - skippedCount}`);
    console.log(`  ✅ Planes de pago generados: ${creditsWithPlan}`);
    if (creditsWithoutPlan > 0) console.log(`  ⚠️  Créditos sin plan de pagos: ${creditsWithoutPlan}`);
    console.log(`--- FASE 2 COMPLETADA ---\n`);
    return creditMap;
}

async function migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap) {
    console.log(`--- FASE 3: Importando PAGOS ---`);
    
    // Crear nueva conexión para pagos si es necesario
    let paymentsConnection = oldDbConnection;
    try {
        await oldDbConnection.ping();
    } catch (error) {
        console.log('  🔄 Creando nueva conexión para pagos...');
        paymentsConnection = await mysql.createConnection(oldDbConfig);
    }
    
    const [payments] = await paymentsConnection.execute("SELECT * FROM abonos");
    
    // Obtener información de usuarios antiguos para mapear nombres reales
    const [oldUsers] = await paymentsConnection.execute("SELECT id, nombres, apellidos FROM users");
    const userNameMap = {};
    oldUsers.forEach(user => {
        const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
        userNameMap[user.id] = fullName || `Usuario ${user.id}`;
    });
    
    let skippedCount = 0;

    for (const payment of payments) {
        const newCreditId = creditMap[payment.prestamo_id];
        if (!newCreditId) {
            console.log(`  [AVISO] Omitiendo pago con ID antiguo ${payment.id} porque su crédito (ID antiguo ${payment.prestamo_id}) no fue migrado.`);
            skippedCount++;
            continue;
        }
        
        const newId = generatePaymentId();
        // Usar el nombre real del gestor que creó el pago
        const realManagerName = userNameMap[payment.created_user_id] || 'Administrador Administrador';

        const sql = `INSERT INTO payments_registered (id, legacyId, creditId, paymentDate, amount, managedBy, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            newId, 
            payment.id, 
            newCreditId, 
            payment.fecha_abono, 
            payment.total_efectivo, 
            realManagerName, // Usar nombre real del gestor
            PAYMENT_STATUS_MAP[payment.estado] || 'valido'
        ];

        console.log(`  [${SIMULATION_MODE ? 'SIM': 'REAL'}] Importando PAGO (ID Antiguo: ${payment.id} -> ID Nuevo: ${newId}) - Gestor: ${realManagerName}`);
        if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
    }
     if (skippedCount > 0) console.log(`  Se omitieron ${skippedCount} pagos por no encontrar su crédito correspondiente.`);
    console.log('  ✅ Pagos importados.');
    
    // Cerrar conexión adicional si se creó
    if (paymentsConnection !== oldDbConnection) {
        await paymentsConnection.end();
    }
    
    console.log(`--- FASE 3 COMPLETADA ---\n`);
}

// --- FUNCIÓN PRINCIPAL DE MIGRACIÓN ---
async function runMigration() {
    let oldDbConnection;
    let newDbConnection;
    console.log('🚀 Iniciando el script de importación v7.0 (CON PLANES DE PAGO)...');

    if (SIMULATION_MODE) {
        console.log("\n**************************************************");
        console.log("***** MODO SIMULACIÓN DE IMPORTACIÓN ACTIVADO *****");
        console.log("No se realizarán cambios. Se verificará la nueva lógica de IDs.");
        console.log("**************************************************\n");
    } else {
        console.log("\n**************************************************");
        console.log("***** MODO REAL DE IMPORTACIÓN ACTIVADO *****");
        console.log("¡¡¡ LOS DATOS SE IMPORTARÁN A LA BASE DE DATOS NUEVA !!!");
        console.log("**************************************************\n");
    }

    try {
        console.log('🔌 Conectando a las bases de datos...');
        oldDbConnection = await mysql.createConnection(oldDbConfig);
        newDbConnection = await mysql.createConnection(newDbConfig);
        console.log('✅ Conexiones exitosas.\n');

        await newDbConnection.beginTransaction();
        console.log('🚦 Transacción iniciada en la BD Nueva.');

        await prepareSchema(newDbConnection);
        await cleanDestinationTables(newDbConnection);
        const geoMaps = await getGeoMaps(oldDbConnection, newDbConnection);
        const userClientMap = await migrateUsersAndClients(oldDbConnection, newDbConnection, geoMaps);
        const creditMap = await migrateCredits(oldDbConnection, newDbConnection, userClientMap);
        await migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap);
        
        if (!SIMULATION_MODE) {
            await newDbConnection.commit();
            console.log('\n💾 ¡¡¡ IMPORTACIÓN COMPLETA Y CAMBIOS GUARDADOS EN LA NUEVA BASE DE DATOS !!!');
        } else {
            await newDbConnection.rollback();
            console.log("\n⏪ SIMULACIÓN FINALIZADA. La base de datos nueva NO ha sido modificada.");
            console.log("Revisa la salida. Si todo es correcto, el ingeniero puede cambiar SIMULATION_MODE a false.");
        }

    } catch (error) {
        console.error('\n❌ ¡¡¡ERROR FATAL DURANTE LA IMPORTACIÓN!!! ❌');
        console.error(error);
        if (newDbConnection) {
            console.log('⏪ Revertiendo todos los cambios por error (rollback)...');
            await newDbConnection.rollback();
        }
    } finally {
        if (oldDbConnection) await oldDbConnection.end();
        if (newDbConnection) await newDbConnection.end();
        console.log('\n🚪 Script finalizado.');
    }
}

runMigration();