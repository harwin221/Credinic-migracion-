#!/usr/bin/env node

/**
 * Script para probar la función de cálculo de estado del crédito
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Simular las funciones de fecha de la aplicación
function todayInNicaragua() {
    return '2026-01-28'; // Fecha actual simulada
}

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

// Función simplificada de cálculo de estado
function calculateCreditStatusSimple(credit, paymentPlan, registeredPayments) {
    console.log('\n=== INICIANDO CÁLCULO DE ESTADO ===');
    
    const asOfDateString = todayInNicaragua(); // '2026-01-28'
    console.log(`Fecha de cálculo: ${asOfDateString}`);
    
    // Filtrar cuotas vencidas (antes de hoy)
    const installmentsDueBeforeToday = paymentPlan.filter(p => {
        const installmentDateString = formatDateForUser(p.paymentDate, 'yyyy-MM-dd');
        const isOverdue = installmentDateString && installmentDateString < asOfDateString;
        console.log(`Cuota ${p.paymentNumber}: ${installmentDateString} ${isOverdue ? '(VENCIDA)' : '(VIGENTE)'}`);
        return isOverdue;
    });
    
    console.log(`\nCuotas vencidas: ${installmentsDueBeforeToday.length}`);
    
    const amountDueBeforeToday = installmentsDueBeforeToday.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    console.log(`Monto vencido: C$${amountDueBeforeToday.toFixed(2)}`);
    
    // Filtrar pagos válidos antes de hoy
    const validPayments = registeredPayments.filter(p => p.status !== 'ANULADO');
    const totalPaidBeforeToday = validPayments
        .filter(p => {
            const paymentDateString = formatDateForUser(p.paymentDate, 'yyyy-MM-dd');
            const isBeforeToday = paymentDateString && paymentDateString < asOfDateString;
            console.log(`Pago: ${paymentDateString} - C$${p.amount} ${isBeforeToday ? '(ANTES DE HOY)' : '(HOY O DESPUÉS)'}`);
            return isBeforeToday;
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    console.log(`Total pagado antes de hoy: C$${totalPaidBeforeToday.toFixed(2)}`);
    
    const overdueAmount = Math.max(0, amountDueBeforeToday - totalPaidBeforeToday);
    console.log(`Mora calculada: C$${overdueAmount.toFixed(2)}`);
    
    // Calcular días de atraso
    let lateDays = 0;
    if (overdueAmount > 0.01 && installmentsDueBeforeToday.length > 0) {
        const firstOverdueDate = new Date(installmentsDueBeforeToday[0].paymentDate);
        const today = new Date(asOfDateString);
        lateDays = Math.floor((today - firstOverdueDate) / (1000 * 60 * 60 * 24));
    }
    
    console.log(`Días de atraso: ${lateDays}`);
    
    return {
        overdueAmount,
        lateDays,
        amountDueBeforeToday,
        totalPaidBeforeToday
    };
}

async function createNewConnection() {
    return await mysql.createConnection({
        host: process.env.NEW_DB_HOST || 'localhost',
        user: process.env.NEW_DB_USER || 'root',
        password: process.env.NEW_DB_PASSWORD || '',
        database: process.env.NEW_DB_DATABASE || 'harrue9_credinica',
        timezone: '+00:00'
    });
}

async function testCreditCalculation() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== PRUEBA DE CÁLCULO DE ESTADO DEL CRÉDITO ===');
        
        // Obtener datos del crédito CRE-000420
        const [credit] = await newDb.execute(
            'SELECT * FROM credits WHERE creditNumber = ?', 
            ['CRE-000420']
        );
        
        const [paymentPlan] = await newDb.execute(
            'SELECT * FROM payment_plan WHERE creditId = ? ORDER BY paymentNumber', 
            [credit[0].id]
        );
        
        const [payments] = await newDb.execute(
            'SELECT * FROM payments_registered WHERE creditId = ? ORDER BY paymentDate', 
            [credit[0].id]
        );
        
        console.log(`Crédito: ${credit[0].creditNumber}`);
        console.log(`Plan de pagos: ${paymentPlan.length} cuotas`);
        console.log(`Pagos registrados: ${payments.length} pagos`);
        
        // Ejecutar cálculo simplificado
        const result = calculateCreditStatusSimple(credit[0], paymentPlan, payments);
        
        console.log('\n=== RESULTADO FINAL ===');
        console.log(`Monto en Mora: C$${result.overdueAmount.toFixed(2)}`);
        console.log(`Días de Atraso: ${result.lateDays}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    testCreditCalculation()
        .then(() => {
            console.log('\nPrueba completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { testCreditCalculation };