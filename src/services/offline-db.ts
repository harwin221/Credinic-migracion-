
'use client';

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { RegisteredPayment, CreditDetail, Client, Payment } from '@/lib/types';

const DB_NAME = 'CrediNicaDB';
const DB_VERSION = 2;
const PENDING_PAYMENTS_STORE = 'pending_payments';
const CREDITS_STORE = 'credits';
const CLIENTS_STORE = 'clients';
const PAYMENT_PLANS_STORE = 'payment_plans';
const SYNC_STATUS_STORE = 'sync_status';

interface CrediNicaDBSchema extends DBSchema {
  [PENDING_PAYMENTS_STORE]: {
    key: string;
    value: {
      creditId: string;
      paymentData: Omit<RegisteredPayment, 'id'>;
      actorId: string;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
  [CREDITS_STORE]: {
    key: string;
    value: CreditDetail;
    indexes: { 'by-status': string; 'by-manager': string };
  };
  [CLIENTS_STORE]: {
    key: string;
    value: Client;
    indexes: { 'by-name': string };
  };
  [PAYMENT_PLANS_STORE]: {
    key: string;
    value: Payment & { creditId: string };
    indexes: { 'by-credit': string };
  };
  [SYNC_STATUS_STORE]: {
    key: string;
    value: {
      lastSync: string;
      gestorId: string;
      totalCredits: number;
      totalClients: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CrediNicaDBSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<CrediNicaDBSchema>> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB can only be used in the browser.'));
  }
  if (!dbPromise) {
    dbPromise = openDB<CrediNicaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Pending payments store
        if (!db.objectStoreNames.contains(PENDING_PAYMENTS_STORE)) {
          const store = db.createObjectStore(PENDING_PAYMENTS_STORE, {
            keyPath: 'timestamp',
          });
          store.createIndex('by-timestamp', 'timestamp');
        }

        // Credits store
        if (!db.objectStoreNames.contains(CREDITS_STORE)) {
          const store = db.createObjectStore(CREDITS_STORE, {
            keyPath: 'id',
          });
          store.createIndex('by-status', 'status');
          store.createIndex('by-manager', 'collectionsManager');
        }

        // Clients store
        if (!db.objectStoreNames.contains(CLIENTS_STORE)) {
          const store = db.createObjectStore(CLIENTS_STORE, {
            keyPath: 'id',
          });
          store.createIndex('by-name', 'name');
        }

        // Payment plans store
        if (!db.objectStoreNames.contains(PAYMENT_PLANS_STORE)) {
          const store = db.createObjectStore(PAYMENT_PLANS_STORE, {
            keyPath: ['creditId', 'paymentNumber'],
          });
          store.createIndex('by-credit', 'creditId');
        }

        // Sync status store
        if (!db.objectStoreNames.contains(SYNC_STATUS_STORE)) {
          db.createObjectStore(SYNC_STATUS_STORE, {
            keyPath: 'gestorId',
          });
        }
      },
    });
  }
  return dbPromise;
};

// ============================================================================
// FUNCIONES DE PAGOS PENDIENTES (EXISTENTES)
// ============================================================================

export async function savePendingPayment(
  creditId: string,
  paymentData: Omit<RegisteredPayment, 'id'>,
  actorId: string
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readwrite');
  await tx.store.add({
    creditId,
    paymentData,
    actorId,
    timestamp: Date.now(),
  });
  await tx.done;
}

export async function getPendingPayments(): Promise<{
  creditId: string;
  paymentData: Omit<RegisteredPayment, 'id'>;
  actorId: string;
  timestamp: number;
}[]> {
  const db = await getDb();
  return db.getAll(PENDING_PAYMENTS_STORE);
}

export async function deletePendingPayment(timestamp: number): Promise<void> {
  const db = await getDb();
  await db.delete(PENDING_PAYMENTS_STORE, String(timestamp));
}

// ============================================================================
// FUNCIONES DE SINCRONIZACIÓN COMPLETA (NUEVAS)
// ============================================================================

export async function saveOfflineData(syncData: {
  credits: CreditDetail[];
  clients: Client[];
  paymentPlans: any[];
  gestorId: string;
}): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([CREDITS_STORE, CLIENTS_STORE, PAYMENT_PLANS_STORE, SYNC_STATUS_STORE], 'readwrite');

  try {
    // Limpiar datos anteriores
    await tx.objectStore(CREDITS_STORE).clear();
    await tx.objectStore(CLIENTS_STORE).clear();
    await tx.objectStore(PAYMENT_PLANS_STORE).clear();

    // Guardar créditos
    for (const credit of syncData.credits) {
      await tx.objectStore(CREDITS_STORE).add(credit);
    }

    // Guardar clientes
    for (const client of syncData.clients) {
      await tx.objectStore(CLIENTS_STORE).add(client);
    }

    // Guardar planes de pago
    for (const plan of syncData.paymentPlans) {
      await tx.objectStore(PAYMENT_PLANS_STORE).add(plan);
    }

    // Actualizar estado de sincronización
    await tx.objectStore(SYNC_STATUS_STORE).put({
      gestorId: syncData.gestorId,
      lastSync: new Date().toISOString(),
      totalCredits: syncData.credits.length,
      totalClients: syncData.clients.length,
    });

    await tx.done;
  } catch (error) {
    console.error('Error saving offline data:', error);
    throw error;
  }
}

export async function getOfflineCredits(): Promise<CreditDetail[]> {
  const db = await getDb();
  return db.getAll(CREDITS_STORE);
}

export async function getOfflineCredit(creditId: string): Promise<CreditDetail | undefined> {
  const db = await getDb();
  return db.get(CREDITS_STORE, creditId);
}

export async function getOfflineClients(): Promise<Client[]> {
  const db = await getDb();
  return db.getAll(CLIENTS_STORE);
}

export async function getOfflineClient(clientId: string): Promise<Client | undefined> {
  const db = await getDb();
  return db.get(CLIENTS_STORE, clientId);
}

export async function getOfflinePaymentPlan(creditId: string): Promise<Payment[]> {
  const db = await getDb();
  const tx = db.transaction(PAYMENT_PLANS_STORE, 'readonly');
  const index = tx.store.index('by-credit');
  const plans = await index.getAll(creditId);
  return plans.sort((a, b) => a.paymentNumber - b.paymentNumber);
}

export async function getSyncStatus(): Promise<{
  lastSync: string;
  gestorId: string;
  totalCredits: number;
  totalClients: number;
} | null> {
  const db = await getDb();
  const statuses = await db.getAll(SYNC_STATUS_STORE);
  return statuses[0] || null;
}

export async function isDataAvailableOffline(): Promise<boolean> {
  const status = await getSyncStatus();
  return status !== null && status.totalCredits > 0;
}

// ============================================================================
// FUNCIONES DE BÚSQUEDA OFFLINE
// ============================================================================

export async function searchOfflineCredits(query: string): Promise<CreditDetail[]> {
  const credits = await getOfflineCredits();
  const lowerQuery = query.toLowerCase();
  
  return credits.filter(credit => 
    credit.clientName.toLowerCase().includes(lowerQuery) ||
    credit.creditNumber.toLowerCase().includes(lowerQuery) ||
    credit.id.toLowerCase().includes(lowerQuery)
  );
}

export async function searchOfflineClients(query: string): Promise<Client[]> {
  const clients = await getOfflineClients();
  const lowerQuery = query.toLowerCase();
  
  return clients.filter(client => 
    client.name.toLowerCase().includes(lowerQuery) ||
    client.clientNumber.toLowerCase().includes(lowerQuery) ||
    client.cedula.includes(query)
  );
}
