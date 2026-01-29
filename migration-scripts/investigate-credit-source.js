#!/usr/bin/env node

/**
 * Script para investigar de dónde viene el crédito CRE-000425
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

async function investigateCreditSource() {
    const newDb = await createNewConnection();
    
    try {
        console.log('=== INVESTIGACIÓN DEL ORIGEN DEL CRÉDITO CRE-000425 ===');
        
        // Buscar por creditNumber
        console.log('🔍 Buscando por creditNumber = "CRE-000425"...');
        const [byNumber] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, legacyId, createdAt, updatedAt
            FROM credits 
            WHERE creditNumber = 'CRE-000425'
        `);
        
        console.log(`Resultados por creditNumber: ${byNumber.length}`);
        if (byNumber.length > 0) {
            console.table(byNumber);
        }

        // Buscar por ID específico (el que aparece en la URL)
        console.log('\n🔍 Buscando por ID = "cred_4692f6e8-122e-4d5d-a2c5-1fbe2e62f3d1"...');
        const [byId] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, legacyId, createdAt, updatedAt
            FROM credits 
            WHERE id = 'cred_4692f6e8-122e-4d5d-a2c5-1fbe2e62f3d1'
        `);
        
        console.log(`Resultados por ID específico: ${byId.length}`);
        if (byId.length > 0) {
            console.table(byId);
        }

        // Buscar créditos similares (CRE-00042X)
        console.log('\n🔍 Buscando créditos similares (CRE-00042X)...');
        const [similar] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, legacyId, createdAt, updatedAt
            FROM credits 
            WHERE creditNumber LIKE 'CRE-00042%'
            ORDER BY creditNumber
        `);
        
        console.log(`Créditos similares encontrados: ${similar.length}`);
        if (similar.length > 0) {
            console.table(similar);
        }

        // Buscar por cliente "LUIS ALFONSO VARGAS HERNANDEZ"
        console.log('\n🔍 Buscando por cliente "LUIS ALFONSO VARGAS HERNANDEZ"...');
        const [byClient] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, legacyId, createdAt, updatedAt
            FROM credits 
            WHERE clientName LIKE '%LUIS ALFONSO VARGAS%'
        `);
        
        console.log(`Créditos del cliente: ${byClient.length}`);
        if (byClient.length > 0) {
            console.table(byClient);
        }

        // Verificar si hay duplicados o inconsistencias
        console.log('\n📊 Estadísticas generales de créditos...');
        const [stats] = await newDb.execute(`
            SELECT 
                COUNT(*) as total_credits,
                COUNT(DISTINCT creditNumber) as unique_credit_numbers,
                COUNT(DISTINCT id) as unique_ids
            FROM credits
        `);
        console.table(stats);

        // Buscar créditos con números duplicados
        console.log('\n🔍 Buscando números de crédito duplicados...');
        const [duplicates] = await newDb.execute(`
            SELECT creditNumber, COUNT(*) as count
            FROM credits 
            GROUP BY creditNumber 
            HAVING COUNT(*) > 1
        `);
        
        console.log(`Números duplicados: ${duplicates.length}`);
        if (duplicates.length > 0) {
            console.table(duplicates);
        }

        // Verificar últimos créditos creados/modificados
        console.log('\n📅 Últimos créditos creados/modificados...');
        const [recent] = await newDb.execute(`
            SELECT id, creditNumber, clientName, status, createdAt, updatedAt
            FROM credits 
            ORDER BY updatedAt DESC 
            LIMIT 10
        `);
        console.table(recent);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await newDb.end();
    }
}

// Ejecutar el script
if (require.main === module) {
    investigateCreditSource()
        .then(() => {
            console.log('Investigación completada.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { investigateCreditSource };