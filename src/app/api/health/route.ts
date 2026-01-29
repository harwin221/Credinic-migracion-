import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

/**
 * Health check endpoint para monitoreo de la API
 * Útil para apps Android para verificar conectividad
 */
export async function GET() {
  try {
    // Verificar conexión a la base de datos
    let dbStatus = 'unknown';
    let dbError = null;
    
    try {
      await query('SELECT 1 as test');
      dbStatus = 'connected';
    } catch (error: any) {
      dbStatus = 'disconnected';
      dbError = error.message;
    }

    const response = {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'CrediNic API',
      timezone: 'America/Managua',
      database: {
        status: dbStatus,
        host: process.env.MYSQL_HOST || 'not configured',
        database: process.env.MYSQL_DATABASE || 'not configured',
        error: dbError
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        APP_ENV: process.env.APP_ENV
      }
    };

    return NextResponse.json(response, { 
      status: dbStatus === 'connected' ? 200 : 503 
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Service unavailable',
      details: error.message
    }, { status: 503 });
  }
}