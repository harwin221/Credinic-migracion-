#!/usr/bin/env node

/**
 * ========================================
 * CREDINICA - SCRIPT MAESTRO DE MIGRACIÓN
 * ========================================
 * 
 * Este script realiza la migración completa del sistema CrediNica:
 * - Migra usuarios, clientes, créditos y pagos
 * - Genera planes de pago automáticamente
 * - Crea usuario administrador
 * - Corrige nombres de gestores en pagos
 * - Ejecuta verificaciones de salud
 * 
 * Autor: Sistema CrediNica
 * Versión: 1.0.0
 * Fecha: 2026-01-29
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================

// MODO DE SEGURIDAD: true = Solo simula, false = Ejecuta cambios reales
const SIMULATION_MODE = false;

// Configuración de conexiones
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

// ==========================================
// GENERADORES DE ID
// ==========================================

const generateCreditId = () => `cred_${randomUUID()}`;
const generateClientId = () => `cli_${randomUUID()}`;
const generateUserId = () => `user_${randomUUID()}`;
const generatePaymentId = () => `pay_${randomUUID()}`;

// ==========================================
// DICCIONARIOS DE TRADUCCIÓN
// ==========================================

const SEX_MAP = { 0: 'Masculino', 1: 'Femenino' };
const CIVIL_STATUS_MAP = { 0: 'Soltero', 1: 'Casado', 2: 'Union Libre', 3: 'Viudo(a)', 4: 'Divorciado' };
const USER_ROLE_MAP = { 1: 'ADMINISTRADOR', 2: 'FINANZAS', 4: 'GESTOR' };
const CREDIT_STATUS_MAP = { 1: 'Active', 2: 'Paid', 3: 'Expired', 4: 'Rejected' };
const PAYMENT_FREQ_MAP = { 1: 'Diario', 2: 'Semanal', 3: 'Quincenal', 4: 'Catorcenal' };
const CURRENCY_MAP = { 0: 'Cordobas' };
const PAYMENT_STATUS_MAP = { 1: 'valido', 2: 'anulado' };

// ==========================================
// UTILIDADES DE FECHA Y CÁLCULOS
// ==========================================

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
            initialDate = new Date(`${dateInput}T12:00:00`);
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
            amount: Math.round(periodicPayment * 100) / 100,
            principal: Math.round(periodicPrincipal * 100) / 100,
            interest: Math.round(periodicInterest * 100) / 100,
            balance: Math.max(0, Math.round(remainingBalance * 100) / 100),
        });

        // Avanzar fecha para siguiente pago
        if (paymentFrequency === 'Quincenal') {
            if (currentDate.getDate() <= 15) {
                currentDate.setDate(30);
                if (currentDate.getDate() !== 30) {
                    currentDate.setDate(0);
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

// ==========================================
// FUNCIONES DE MIGRACIÓN
// ==========================================

async function prepareSchema(newDbConnection) {
    console.log(`🔧 PREPARANDO ESQUEMA DE BASE DE DATOS...`);

    const tablesToUpdate = [
        { tableName: 'users', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'clients', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'credits', columnName: 'legacyId', columnType: 'INT' },
        { tableName: 'payments_registered', columnName: 'legacyId', columnType: 'INT' }
    ];

    for (const table of tablesToUpdate) {
        const { tableName, columnName, columnType } = table;
        
        const checkSql = `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`;
        const [rows] = await newDbConnection.execute(checkSql, [newDbConfig.database, tableName, columnName]);

        if (rows[0].count === 0) {
            console.log(`   ➕ Agregando columna ${columnName} a tabla ${tableName}`);
            if (!SIMULATION_MODE) {
                const addSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
                await newDbConnection.execute(addSql);
            }
        }
    }
    
    console.log(`   ✅ Esquema preparado\n`);
}

async function cleanDestinationTables(newDbConnection) {
    console.log(`🧹 LIMPIANDO TABLAS DE DESTINO...`);
    
    if (SIMULATION_MODE) {
        console.log("   [SIMULACIÓN] Tablas serían limpiadas");
        return;
    }
    
    await newDbConnection.execute('SET FOREIGN_KEY_CHECKS = 0;');
    await newDbConnection.execute('TRUNCATE TABLE payment_plan;');
    await newDbConnection.execute('TRUNCATE TABLE payments_registered;');
    await newDbConnection.execute('TRUNCATE TABLE credits;');
    await newDbConnection.execute('TRUNCATE TABLE clients;');
    await newDbConnection.execute('TRUNCATE TABLE users;');
    await newDbConnection.execute('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('   ✅ Tablas limpiadas\n');
}

async function getGeoMaps(oldDbConnection, newDbConnection) {
    console.log(`🗺️  CARGANDO MAPAS GEOGRÁFICOS...`);
    
    // Obtener mapas de la BD antigua
    const [oldDepts] = await oldDbConnection.execute("SELECT id, nombre FROM departamento");
    const [oldMunis] = await oldDbConnection.execute("SELECT id, nombre, departamento_id FROM departamento_municipio");
    
    // Obtener mapas de la BD nueva
    const [newDepts] = await newDbConnection.execute("SELECT id, name FROM departments");
    const [newMunis] = await newDbConnection.execute("SELECT id, name FROM municipalities");
    
    // Crear mapas de nombres a IDs nuevos
    const newDeptNameToId = newDepts.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});
    const newMuniNameToId = newMunis.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});
    
    console.log(`   ✅ Mapas geográficos cargados: ${oldDepts.length} departamentos, ${oldMunis.length} municipios\n`);
    
    return {
        oldDepartmentMap: oldDepts.reduce((acc, row) => ({ ...acc, [row.id]: row.nombre }), {}),
        oldMunicipalityMap: oldMunis.reduce((acc, row) => ({ 
            ...acc, 
            [row.id]: { 
                nombre: row.nombre, 
                departamento_id: row.departamento_id 
            } 
        }), {}),
        newDeptNameToId,
        newMuniNameToId
    };
}

async function migrateUsersAndClients(oldDbConnection, newDbConnection, geoMaps) {
    console.log(`👥 MIGRANDO USUARIOS Y CLIENTES...`);
    
    const [users] = await oldDbConnection.execute("SELECT * FROM users");
    const translationMap = {};
    let userCount = 0;
    let clientCount = 0;

    for (const user of users) {
        const userRole = USER_ROLE_MAP[user.tipo_usuario];

        if (userRole) { // Es un Usuario del Sistema
            const newId = generateUserId();
            translationMap[user.id] = newId;
            const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
            const email = user.username || `legacy_user_${user.id}@placeholder.com`;
            const username = user.username ? user.username.toLowerCase().replace(/[@.]/g, '') : `user${user.id}`;

            const sql = `INSERT INTO users (id, legacyId, fullName, email, username, hashed_password, phone, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                newId, user.id, fullName, email, username,
                user.password || 'default_password_hash',
                user.telefono1 || null, userRole || 'GESTOR', 
                user.created_at, user.updated_at
            ];

            console.log(`   👤 Usuario: ${fullName} (${username}) - Rol: ${userRole}`);
            if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
            userCount++;
            
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
                newId, user.id, clientNumber, fullName, 
                user.nombres || '', user.apellidos || '', user.cedula || '', user.telefono1 || '', 
                SEX_MAP[user.sexo] || 'Masculino', CIVIL_STATUS_MAP[user.estado_civil] || 'Soltero', 
                departmentName || '', municipalityName || '', departmentId || null, municipalityId || null,
                user.direccion || '', user.created_at || new Date(), user.updated_at || new Date()
            ];

            console.log(`   👨‍💼 Cliente: ${fullName} (${clientNumber}) - ${departmentName || 'Sin ubicación'}`);
            if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
            clientCount++;
        }
    }
    
    console.log(`   ✅ Migrados: ${userCount} usuarios, ${clientCount} clientes\n`);
    return translationMap;
}

async function migrateCredits(oldDbConnection, newDbConnection, userClientMap) {
    console.log(`💳 MIGRANDO CRÉDITOS Y GENERANDO PLANES DE PAGO...`);
    
    const [credits] = await oldDbConnection.execute("SELECT * FROM prestamos");
    
    // Obtener información de gestores
    const [gestores] = await oldDbConnection.execute("SELECT id, nombres, apellidos FROM users WHERE tipo_usuario = 4");
    const gestorMap = gestores.reduce((acc, gestor) => {
        const fullName = `${gestor.nombres || ''} ${gestor.apellidos || ''}`.trim();
        return { ...acc, [gestor.id]: fullName };
    }, {});
    
    // Crear sucursal principal si no existe
    const [existingSucursal] = await newDbConnection.execute('SELECT * FROM sucursales WHERE name = ?', ['Sucursal Principal']);
    let sucursalId = 'sucursal_principal';
    if (existingSucursal.length === 0) {
        console.log('   🏢 Creando sucursal principal...');
        if (!SIMULATION_MODE) {
            await newDbConnection.execute(
                'INSERT INTO sucursales (id, name, address, phone, manager, active) VALUES (?, ?, ?, ?, ?, ?)',
                [sucursalId, 'Sucursal Principal', 'Dirección Principal', '0000-0000', 'Administrador', 1]
            );
        }
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
            skippedCount++;
            continue;
        }

        const newId = generateCreditId();
        creditMap[credit.id] = newId;
        const creditNumber = `CRE-${String(credit.id).padStart(6, '0')}`;
        const gestorName = gestorMap[credit.agente_id] || 'Administrador Administrador';

        const sql = `INSERT INTO credits (id, legacyId, creditNumber, clientId, clientName, status, applicationDate, approvalDate, amount, principalAmount, interestRate, termMonths, paymentFrequency, currencyType, totalAmount, totalInterest, totalInstallmentAmount, firstPaymentDate, deliveryDate, collectionsManager, branch, branchName, createdAt, updatedAt) VALUES (?, ?, ?, ?, (SELECT name FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const values = [
            newId, credit.id, creditNumber, newClientId, newClientId, 
            CREDIT_STATUS_MAP[credit.estado] || 'Active',
            credit.fecha_desembolso || new Date(), credit.fecha_desembolso || null,
            credit.monto_prestamo || 0, credit.monto_prestamo || 0, credit.tasa_prestamo || 0,
            credit.plazo_pago || 0, PAYMENT_FREQ_MAP[credit.forma_pago_tipo] || 'Diario',
            CURRENCY_MAP[credit.moneda_prestamo] || 'Cordobas',
            credit.monto_financiado || 0, credit.interes_total_pagar || 0, credit.monto_cuota || 0,
            credit.fecha_primer_pago || null, credit.fecha_desembolso || null,
            gestorName, sucursalId, 'Sucursal Principal',
            credit.created_at, credit.updated_at
        ];

        console.log(`   💰 Crédito: ${creditNumber} - Gestor: ${gestorName} - Monto: C$${credit.monto_prestamo || 0}`);
        if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);

        // Generar plan de pagos para créditos activos
        if (CREDIT_STATUS_MAP[credit.estado] === 'Active') {
            const scheduleData = generatePaymentSchedule({
                loanAmount: credit.monto_prestamo || 0,
                monthlyInterestRate: credit.tasa_prestamo || 0,
                termMonths: credit.plazo_pago || 0,
                paymentFrequency: PAYMENT_FREQ_MAP[credit.forma_pago_tipo] || 'Diario',
                startDate: formatDateForUser(credit.fecha_primer_pago, 'yyyy-MM-dd')
            });

            if (scheduleData && scheduleData.schedule.length > 0) {
                console.log(`      📋 Plan de pagos: ${scheduleData.schedule.length} cuotas`);
                
                if (!SIMULATION_MODE) {
                    for (const payment of scheduleData.schedule) {
                        await newDbConnection.execute(
                            'INSERT INTO payment_plan (creditId, paymentNumber, paymentDate, amount, principal, interest, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [newId, payment.paymentNumber, `${payment.paymentDate} 12:00:00`,
                             payment.amount, payment.principal, payment.interest, payment.balance]
                        );
                    }

                    const lastPayment = scheduleData.schedule[scheduleData.schedule.length - 1];
                    await newDbConnection.execute(
                        'UPDATE credits SET dueDate = ? WHERE id = ?',
                        [`${lastPayment.paymentDate} 12:00:00`, newId]
                    );
                }
                creditsWithPlan++;
            } else {
                creditsWithoutPlan++;
            }
        }
    }
    
    console.log(`   ✅ Créditos migrados: ${credits.length - skippedCount}`);
    console.log(`   ✅ Planes de pago generados: ${creditsWithPlan}`);
    if (creditsWithoutPlan > 0) console.log(`   ⚠️  Sin plan de pagos: ${creditsWithoutPlan}`);
    console.log('');
    
    return creditMap;
}

async function migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap) {
    console.log(`💰 MIGRANDO PAGOS CON GESTORES REALES...`);
    
    let paymentsConnection = oldDbConnection;
    try {
        await oldDbConnection.ping();
    } catch (error) {
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
    let paymentCount = 0;

    for (const payment of payments) {
        const newCreditId = creditMap[payment.prestamo_id];
        if (!newCreditId) {
            skippedCount++;
            continue;
        }
        
        const newId = generatePaymentId();
        const realManagerName = userNameMap[payment.created_user_id] || 'Administrador Administrador';

        const sql = `INSERT INTO payments_registered (id, legacyId, creditId, paymentDate, amount, managedBy, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            newId, payment.id, newCreditId, payment.fecha_abono, 
            payment.total_efectivo, realManagerName,
            PAYMENT_STATUS_MAP[payment.estado] || 'valido'
        ];

        console.log(`   💵 Pago: C$${payment.total_efectivo} - Gestor: ${realManagerName} - Fecha: ${payment.fecha_abono}`);
        if (!SIMULATION_MODE) await newDbConnection.execute(sql, values);
        paymentCount++;
    }
    
    console.log(`   ✅ Pagos migrados: ${paymentCount}`);
    if (skippedCount > 0) console.log(`   ⚠️  Pagos omitidos: ${skippedCount}`);
    
    if (paymentsConnection !== oldDbConnection) {
        await paymentsConnection.end();
    }
    
    console.log('');
}

async function createAdminUser(newDbConnection) {
    console.log(`👑 CREANDO USUARIO ADMINISTRADOR...`);
    
    const adminUsername = 'admin';
    const adminEmail = 'admin@credinica.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Verificar si ya existe un administrador
    const [existingAdmin] = await newDbConnection.execute(
        'SELECT * FROM users WHERE role = ? OR username = ? OR email = ?', 
        ['ADMINISTRADOR', adminUsername, adminEmail]
    );
    
    if (existingAdmin.length > 0) {
        console.log('   👤 Actualizando administrador existente...');
        
        if (!SIMULATION_MODE) {
            await newDbConnection.execute(
                'UPDATE users SET username = ?, email = ?, hashed_password = ?, fullName = ?, updatedAt = ? WHERE id = ?',
                [adminUsername, adminEmail, hashedPassword, 'Administrador Principal', new Date(), existingAdmin[0].id]
            );
        }
        
        console.log(`   ✅ Administrador actualizado:`);
        console.log(`      Username: ${adminUsername}`);
        console.log(`      Email: ${adminEmail}`);
        console.log(`      Contraseña: ${adminPassword}`);
        console.log(`      ID: ${existingAdmin[0].id}`);
    } else {
        console.log('   👤 Creando nuevo administrador...');
        
        const adminId = `user_${randomUUID()}`;
        
        if (!SIMULATION_MODE) {
            await newDbConnection.execute(
                'INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [adminId, 'Administrador Principal', adminEmail, adminUsername, hashedPassword, 'ADMINISTRADOR', 1, new Date(), new Date()]
            );
        }
        
        console.log(`   ✅ Administrador creado:`);
        console.log(`      Username: ${adminUsername}`);
        console.log(`      Email: ${adminEmail}`);
        console.log(`      Contraseña: ${adminPassword}`);
        console.log(`      ID: ${adminId}`);
    }
    
    console.log('');
}

async function performHealthCheck(newDbConnection) {
    console.log(`🏥 VERIFICACIÓN DE SALUD DEL SISTEMA...`);
    
    try {
        // Verificar tablas principales
        const tables = ['users', 'clients', 'credits', 'payments_registered', 'payment_plan'];
        const counts = {};
        
        for (const table of tables) {
            const [result] = await newDbConnection.execute(`SELECT COUNT(*) as count FROM ${table}`);
            counts[table] = result[0].count;
            console.log(`   📊 ${table}: ${result[0].count} registros`);
        }

        // Verificar integridad referencial
        const [orphanCredits] = await newDbConnection.execute(`
            SELECT COUNT(*) as count FROM credits c 
            LEFT JOIN clients cl ON c.clientId = cl.id 
            WHERE cl.id IS NULL
        `);
        
        const [orphanPayments] = await newDbConnection.execute(`
            SELECT COUNT(*) as count FROM payments_registered p 
            LEFT JOIN credits c ON p.creditId = c.id 
            WHERE c.id IS NULL
        `);

        const [usersNoPassword] = await newDbConnection.execute(
            'SELECT COUNT(*) as count FROM users WHERE hashed_password IS NULL'
        );

        // Verificar administradores
        const [admins] = await newDbConnection.execute(
            'SELECT COUNT(*) as count FROM users WHERE role = ?', 
            ['ADMINISTRADOR']
        );

        console.log(`\n   🔍 VERIFICACIONES DE INTEGRIDAD:`);
        console.log(`      Créditos huérfanos: ${orphanCredits[0].count} ${orphanCredits[0].count === 0 ? '✅' : '❌'}`);
        console.log(`      Pagos huérfanos: ${orphanPayments[0].count} ${orphanPayments[0].count === 0 ? '✅' : '❌'}`);
        console.log(`      Usuarios sin contraseña: ${usersNoPassword[0].count} ${usersNoPassword[0].count === 0 ? '✅' : '❌'}`);
        console.log(`      Administradores: ${admins[0].count} ${admins[0].count > 0 ? '✅' : '❌'}`);

        const totalIssues = orphanCredits[0].count + orphanPayments[0].count + usersNoPassword[0].count;
        
        if (totalIssues === 0 && admins[0].count > 0) {
            console.log(`\n   🎉 ¡SISTEMA EN PERFECTO ESTADO!`);
            console.log(`      ✅ Todos los sistemas funcionando correctamente`);
        } else {
            console.log(`\n   ⚠️  Se encontraron ${totalIssues} problemas`);
            if (admins[0].count === 0) console.log(`      ❌ No hay administradores en el sistema`);
        }

    } catch (error) {
        console.error(`   ❌ Error en verificación de salud: ${error.message}`);
    }
    
    console.log('');
}

// ==========================================
// FUNCIÓN PRINCIPAL
// ==========================================

async function runCompleteMigration() {
    let oldDbConnection;
    let newDbConnection;
    
    console.log('🚀 ========================================');
    console.log('🚀 CREDINICA - MIGRACIÓN COMPLETA v1.0.0');
    console.log('🚀 ========================================\n');

    if (SIMULATION_MODE) {
        console.log("⚠️  MODO SIMULACIÓN ACTIVADO");
        console.log("   No se realizarán cambios reales\n");
    } else {
        console.log("🔥 MODO REAL ACTIVADO");
        console.log("   ¡Los cambios se aplicarán a la base de datos!\n");
    }

    try {
        console.log('🔌 CONECTANDO A BASES DE DATOS...');
        oldDbConnection = await mysql.createConnection(oldDbConfig);
        newDbConnection = await mysql.createConnection(newDbConfig);
        console.log('   ✅ Conexiones establecidas\n');

        if (!SIMULATION_MODE) {
            await newDbConnection.beginTransaction();
            console.log('🚦 Transacción iniciada\n');
        }

        // Ejecutar migración completa
        await prepareSchema(newDbConnection);
        await cleanDestinationTables(newDbConnection);
        const geoMaps = await getGeoMaps(oldDbConnection, newDbConnection);
        const userClientMap = await migrateUsersAndClients(oldDbConnection, newDbConnection, geoMaps);
        const creditMap = await migrateCredits(oldDbConnection, newDbConnection, userClientMap);
        await migratePayments(oldDbConnection, newDbConnection, creditMap, userClientMap);
        await createAdminUser(newDbConnection);
        await performHealthCheck(newDbConnection);
        
        if (!SIMULATION_MODE) {
            await newDbConnection.commit();
            console.log('💾 ¡¡¡ MIGRACIÓN COMPLETA EXITOSA !!!');
            console.log('✅ Todos los cambios han sido guardados');
        } else {
            await newDbConnection.rollback();
            console.log('⏪ SIMULACIÓN COMPLETADA');
            console.log('   Para ejecutar cambios reales, cambiar SIMULATION_MODE a false');
        }

        console.log('\n🎉 ========================================');
        console.log('🎉 MIGRACIÓN FINALIZADA CORRECTAMENTE');
        console.log('🎉 ========================================');

    } catch (error) {
        console.error('\n❌ ========================================');
        console.error('❌ ERROR FATAL EN LA MIGRACIÓN');
        console.error('❌ ========================================');
        console.error(error);
        
        if (newDbConnection && !SIMULATION_MODE) {
            console.log('⏪ Revirtiendo cambios...');
            await newDbConnection.rollback();
        }
        
        process.exit(1);
    } finally {
        if (oldDbConnection) await oldDbConnection.end();
        if (newDbConnection) await newDbConnection.end();
        console.log('\n🚪 Conexiones cerradas');
    }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
    runCompleteMigration()
        .then(() => {
            console.log('\n✅ Script completado exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { runCompleteMigration };