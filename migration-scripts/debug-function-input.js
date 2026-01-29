#!/usr/bin/env node

/**
 * Script para debuggear qué datos recibe la función calculateCreditStatusDetails
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function createNewConnection() {
    return await mysql.createConnection({
        host: process.env.NEW_DB_HOST || 'localhost',
        user: process.env.NEW_DB_USER || 'root',
        password: process.env.NEW_DB_PASSWORD || '',
        database: process.env.NEW_DB_DATABASE || 'harrue9_credinica',
        timezone: '+00:00'
    });
}

function toISOStringSafe(date) {
    if (!date) return null;
    try {
        if (typeof date === 'string') {
            return new Date(date).toISOString();
        }
        return date.toISOString();
    } catch {
        return null;
    }
}

async function debugFunctionInput() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== DEBUG DE DATOS DE ENTRADA ===');
        
        // Buscar el crédito CRE-000420 por número
        const [creditSearch] = await newDb.execute('SELECT id FROM credits WHERE creditNumber = ?', ['CRE-000420']);
        if (creditSearch.length === 0) {
            console.log('❌ Crédito CRE-000420 no encontrado');
            return;
        }
        
        const creditId = creditSearch[0].id;
        console.log(`✅ ID del crédito CRE-000420: ${creditId}`);
        
        // Simular exactamente lo que hace getCredit
        const [creditRows] = await newDb.execute('SELECT * FROM credits WHERE id = ? LIMIT 1', [creditId]);
        if (creditRows.length === 0) {
            console.log('❌ Crédito no encontrado');
            return;
        }
        
        let creditData = creditRows[0];
        
        const [paymentPlanRows] = await newDb.execute('SELECT * FROM payment_plan WHERE creditId = ? ORDER BY paymentNumber', [creditId]);
        const [registeredPaymentRows] = await newDb.execute('SELECT * FROM payments_registered WHERE creditId = ? ORDER BY paymentDate DESC', [creditId]);
        
        // Simular el procesamiento que hace getCredit
        creditData.paymentPlan = paymentPlanRows.map((p) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) }));
        creditData.registeredPayments = registeredPaymentRows.map((p) => ({ ...p, paymentDate: toISOStringSafe(p.paymentDate) }));
        
        console.log('✅ Datos del crédito obtenidos:');
        console.log(`   Número: ${creditData.creditNumber}`);
        console.log(`   Estado: ${creditData.status}`);
        console.log(`   Monto total: ${creditData.totalAmount}`);
        
        console.log(`\n📋 Plan de pagos: ${creditData.paymentPlan.length} cuotas`);
        if (creditData.paymentPlan.length > 0) {
            console.log('   Primeras 3 cuotas:');
            creditData.paymentPlan.slice(0, 3).forEach(p => {
                console.log(`     Cuota ${p.paymentNumber}: ${p.paymentDate} - C$${p.amount}`);
            });
        }
        
        console.log(`\n💳 Pagos registrados: ${creditData.registeredPayments.length} pagos`);
        if (creditData.registeredPayments.length > 0) {
            creditData.registeredPayments.forEach(p => {
                console.log(`     ${p.paymentDate}: C$${p.amount} - ${p.status}`);
            });
        }
        
        // Verificar tipos de datos
        console.log(`\n🔍 VERIFICACIÓN DE TIPOS:`);
        console.log(`   paymentPlan es array: ${Array.isArray(creditData.paymentPlan)}`);
        console.log(`   registeredPayments es array: ${Array.isArray(creditData.registeredPayments)}`);
        
        if (creditData.paymentPlan.length > 0) {
            const firstPlan = creditData.paymentPlan[0];
            console.log(`   Primera cuota - paymentDate tipo: ${typeof firstPlan.paymentDate}`);
            console.log(`   Primera cuota - amount tipo: ${typeof firstPlan.amount}`);
        }
        
        if (creditData.registeredPayments.length > 0) {
            const firstPayment = creditData.registeredPayments[0];
            console.log(`   Primer pago - paymentDate tipo: ${typeof firstPayment.paymentDate}`);
            console.log(`   Primer pago - amount tipo: ${typeof firstPayment.amount}`);
            console.log(`   Primer pago - status: ${firstPayment.status}`);
        }
        
        // Ahora simular lo que haría calculateCreditStatusDetails
        console.log(`\n🧮 SIMULANDO calculateCreditStatusDetails:`);
        
        // Verificar si los arrays están definidos
        const paymentPlan = Array.isArray(creditData.paymentPlan) ? creditData.paymentPlan : [];
        const registeredPayments = Array.isArray(creditData.registeredPayments) ? creditData.registeredPayments : [];
        
        console.log(`   paymentPlan después de verificación: ${paymentPlan.length} elementos`);
        console.log(`   registeredPayments después de verificación: ${registeredPayments.length} elementos`);
        
        // Verificar estado del crédito
        if (creditData.status === 'Rejected' || creditData.status === 'Pending' || creditData.status === 'Fallecido') {
            console.log(`   ⚠️  Crédito tiene estado ${creditData.status} - retornaría valores por defecto`);
        } else {
            console.log(`   ✅ Crédito tiene estado ${creditData.status} - continuaría con cálculos`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    debugFunctionInput()
        .then(() => {
            console.log('\nDebug completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { debugFunctionInput };