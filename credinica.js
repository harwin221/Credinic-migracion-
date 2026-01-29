#!/usr/bin/env node

/**
 * CrediNica - Script Maestro de Migración
 * 
 * Este script proporciona acceso rápido a todas las funciones de migración
 * y mantenimiento del sistema CrediNica.
 */

const { spawn } = require('child_process');
const path = require('path');

const SCRIPTS = {
  'migrate': {
    file: 'migration-scripts/complete-migration.js',
    description: 'Ejecuta la migración completa de datos (RECOMENDADO)'
  },
  'check': {
    file: 'migration-scripts/check-migration-status.js',
    description: 'Verifica el estado de la migración'
  },
  'fix-users': {
    file: 'migration-scripts/user-toolkit.js',
    description: 'Herramientas para gestión de usuarios'
  },
  'fix-branch': {
    file: 'migration-scripts/fix-missing-branch-gestor.js',
    description: 'Corrige sucursales y gestores faltantes'
  },
  'fix-statuses': {
    file: 'migration-scripts/fix-credit-statuses.js',
    description: 'Convierte estados de créditos a inglés'
  },
  'reset-admin': {
    file: 'migration-scripts/reset-admin-password.js',
    description: 'Resetea la contraseña del administrador'
  },
  'fix-payment-names': {
    file: 'migration-scripts/fix-payment-managed-by.js',
    description: 'Corrige nombres de gestores en historial de pagos'
  }
};

function showHelp() {
  console.log('🚀 CrediNica - Sistema de Migración\n');
  console.log('Uso: node credinica.js <comando>\n');
  console.log('Comandos disponibles:\n');
  
  Object.entries(SCRIPTS).forEach(([cmd, info]) => {
    console.log(`  ${cmd.padEnd(12)} - ${info.description}`);
  });
  
  console.log('\nEjemplos:');
  console.log('  node credinica.js migrate     # Migración completa (RECOMENDADO)');
  console.log('  node credinica.js check       # Verificar estado');
  console.log('  node credinica.js reset-admin # Resetear admin');
  console.log('\n💡 Para migración nueva, usa: node credinica.js migrate');
}

function runScript(scriptPath) {
  console.log(`\n🔄 Ejecutando: ${scriptPath}\n`);
  
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (error) => {
    console.error(`❌ Error al ejecutar el script: ${error.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✅ Script completado exitosamente`);
    } else {
      console.log(`\n❌ Script terminó con código de error: ${code}`);
      process.exit(code);
    }
  });
}

// Procesar argumentos
const command = process.argv[2];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

if (SCRIPTS[command]) {
  runScript(SCRIPTS[command].file);
} else {
  console.error(`❌ Comando desconocido: ${command}`);
  console.log('\nComandos disponibles:');
  Object.keys(SCRIPTS).forEach(cmd => console.log(`  - ${cmd}`));
  console.log('\nUsa "node credinica.js help" para más información');
  process.exit(1);
}