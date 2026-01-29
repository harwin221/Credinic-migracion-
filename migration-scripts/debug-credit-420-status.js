#!/usr/bin/env node

/**
 * Script para debuggear el cálculo de estado del crédito CRE-000420
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

async function debugCreditStatus() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== DEBUG DEL CRÉDITO CRE-000420 ===');
        
        // Buscar el crédito CRE-000420
        const [credit] = await newDb.execute(
            'SELECT * FROM credits WHERE creditNumber = ?', 
            ['CRE-000420']
        );
        
        if (credit.length === 0) {
            console.log('❌ Crédito CRE-000420 no encontrado');
            return;
        }
        
        console.log('✅ Crédito encontrado:', credit[0].creditNumber);
        console.log('   Monto total:', credit[0].totalAmount);
        console.log('   Estado:', credit[0].status);
        
        // Buscar el plan de pagos
        const [paymentPlan] = await newDb.execute(
            'SELECT * FROM payment_plan WHERE creditId = ? ORDER BY paymentNumber', 
            [credit[0].id]
        );
        
        console.log(`\n📋 Plan de pagos: ${paymentPlan.length} cuotas`);
        
        // Mostrar las primeras cuotas y su estado
        const today = new Date().toISOString().split('T')[0]; // 2026-01-28
        console.log(`   Fecha actual: ${today}`);
        
        let cuotasVencidas = 0;
        let montoVencido = 0;
        
        paymentPlan.slice(0, 10).forEach(cuota => {
            const fechaCuota = cuota.paymentDate.toISOString().split('T')[0];
            const estaVencida = fechaCuota < today;
            
            if (estaVencida) {
                cuotasVencidas++;
                montoVencido += parseFloat(cuota.amount);
            }
            
            console.log(`   Cuota ${cuota.paymentNumber}: ${fechaCuota} - C$${cuota.amount} ${estaVencida ? '(VENCIDA)' : '(VIGENTE)'}`);
        });
        
        console.log(`\n💰 Cuotas vencidas: ${cuotasVencidas}`);
        console.log(`   Monto vencido: C$${montoVencido.toFixed(2)}`);
        
        // Buscar pagos registrados
        const [payments] = await newDb.execute(
            'SELECT * FROM payments_registered WHERE creditId = ? AND status != "ANULADO" ORDER BY paymentDate', 
            [credit[0].id]
        );
        
        console.log(`\n💳 Pagos registrados: ${payments.length}`);
        let totalPagado = 0;
        
        payments.forEach(pago => {
            const fechaPago = pago.paymentDate.toISOString().split('T')[0];
            totalPagado += parseFloat(pago.amount);
            console.log(`   ${fechaPago}: C$${pago.amount} - ${pago.managedBy}`);
        });
        
        console.log(`   Total pagado: C$${totalPagado.toFixed(2)}`);
        
        // Calcular mora manualmente
        const moraCalculada = Math.max(0, montoVencido - totalPagado);
        const diasAtraso = cuotasVencidas > 0 ? Math.max(0, Math.floor((new Date() - new Date(paymentPlan[0].paymentDate)) / (1000 * 60 * 60 * 24))) : 0;
        
        console.log(`\n🔍 CÁLCULO MANUAL:`);
        console.log(`   Monto vencido: C$${montoVencido.toFixed(2)}`);
        console.log(`   Total pagado: C$${totalPagado.toFixed(2)}`);
        console.log(`   Mora calculada: C$${moraCalculada.toFixed(2)}`);
        console.log(`   Días de atraso: ${diasAtraso}`);
        
        // Verificar qué muestra el sistema
        console.log(`\n🖥️  LO QUE DEBERÍA MOSTRAR EL SISTEMA:`);
        console.log(`   Monto en Mora: C$${moraCalculada.toFixed(2)} (actualmente muestra C$0.00)`);
        console.log(`   Días de Atraso: ${diasAtraso} (actualmente muestra 0)`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    debugCreditStatus()
        .then(() => {
            console.log('\nDebug completado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { debugCreditStatus };