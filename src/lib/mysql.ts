
'use server';

import 'server-only';
import mysql from 'mysql2/promise';
import { unstable_noStore as noStore } from 'next/cache';
import { queryLimiter } from './rate-limiter';

// --- IMPLEMENTACIÓN DE SINGLETON PARA EL POOL DE CONEXIONES ---

// 1. Definir una interfaz para la variable global
interface GlobalWithPool {
  mysqlPool?: mysql.Pool;
}

// 2. Usar un alias para el objeto global para asegurar el tipado
const globalWithPool = globalThis as typeof globalThis & GlobalWithPool;

let pool: mysql.Pool;

// 3. Crear o reutilizar el pool
if (process.env.NODE_ENV === 'production') {
  // En producción, es seguro crear el pool una sola vez.
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    maxIdle: 3,
    idleTimeout: 60000,
    decimalNumbers: true,
    timezone: '+00:00', // UTC - Estándar ISO 8601
    dateStrings: false, // Convertir fechas a objetos Date de JavaScript
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  // En desarrollo, reutilizamos la conexión a través del objeto global para evitar
  // que el Hot Module Replacement (HMR) cree múltiples pools.
  if (!globalWithPool.mysqlPool) {
    globalWithPool.mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      maxIdle: 3,
      idleTimeout: 60000,
      decimalNumbers: true,
      timezone: '+00:00', // UTC - Estándar ISO 8601
      dateStrings: false, // Convertir fechas a objetos Date de JavaScript
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  pool = globalWithPool.mysqlPool;
}

/**
 * Función genérica para ejecutar consultas SQL.
 * Utiliza un pool de conexiones para manejar las conexiones de manera eficiente.
 * `unstable_noStore` se usa para asegurar que los resultados no se almacenen en caché
 * en el Data Cache de Next.js, garantizando datos frescos en cada solicitud.
 */
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  noStore(); // Previene el cacheo de los resultados de la consulta
  
  // Crear conexión directa (como en debug-credits.js que funcionó)
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    // Usar query() como en el script que funcionó
    const [rows] = await connection.query(sql, params);
    
    if (process.env.APP_DEBUG === 'true') {
      console.log('✅ Query success:', {
        sql: sql.substring(0, 100),
        params: params,
        rowCount: Array.isArray(rows) ? rows.length : 0
      });
    }
    
    return Array.isArray(rows) ? rows : [];
    
  } catch (error: any) {
    console.error('❌ MySQL Error:', {
      message: error.message,
      sql: sql.substring(0, 100),
      params: params
    });
    throw error;
  } finally {
    await connection.end();
  }
}


/**
 * Obtiene el siguiente valor de un contador de secuencia de la tabla `counters`.
 * Esta función usa una transacción para asegurar incrementos atómicos y prevenir condiciones de carrera.
 * @param sequenceName El nombre del campo contador (ej., 'clientNumber' o 'creditNumber').
 * @returns Una promesa que se resuelve con el siguiente número en la secuencia.
 */
export async function getNextSequenceValue(sequenceName: 'clientNumber' | 'creditNumber'): Promise<number> {
    // Obtiene una conexión única del pool para la transacción.
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Bloquea la fila para evitar que otros la lean o modifiquen hasta que la transacción termine.
        const [rows]: any = await connection.execute('SELECT * FROM counters WHERE id = ? FOR UPDATE', ['main']);

        let currentValue = 0;
        if (rows.length === 0) {
            // Si el contador no existe, lo crea.
            await connection.execute('INSERT INTO counters (id, clientNumber, creditNumber) VALUES (?, ?, ?)', ['main', 1, 1]);
            currentValue = 1;
        } else {
            currentValue = rows[0][sequenceName] || 0;
            currentValue++;
            await connection.execute(`UPDATE counters SET ${sequenceName} = ? WHERE id = ?`, [currentValue, 'main']);
        }
        
        await connection.commit();
        return currentValue;

    } catch (error) {
        await connection.rollback();
        console.error(`Error en la transacción para getNextSequenceValue (${sequenceName}):`, error);
        throw new Error('No se pudo obtener el siguiente valor de la secuencia.');
    } finally {
        // Asegura que la conexión siempre se libere de vuelta al pool.
        connection.release();
    }
}
