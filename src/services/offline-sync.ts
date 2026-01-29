'use client';

import { saveOfflineData, getSyncStatus, isDataAvailableOffline } from './offline-db';
import type { AppUser } from '@/lib/types';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
const FORCE_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutos

class OfflineSyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private forceSyncInterval: NodeJS.Timeout | null = null;
  private isOnline = true;
  private user: AppUser | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  setUser(user: AppUser | null) {
    this.user = user;
    if (user && user.role === 'GESTOR') {
      this.startSyncIntervals();
    } else {
      this.stopSyncIntervals();
    }
  }

  private handleOnline() {
    this.isOnline = true;
    console.log('🌐 Conexión restaurada - iniciando sincronización');
    this.syncNow();
  }

  private handleOffline() {
    this.isOnline = false;
    console.log('📱 Modo offline activado');
  }

  private startSyncIntervals() {
    this.stopSyncIntervals();

    // Sincronización regular cada 5 minutos
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncNow();
      }
    }, SYNC_INTERVAL);

    // Sincronización forzada cada 30 minutos
    this.forceSyncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncNow(true);
      }
    }, FORCE_SYNC_INTERVAL);

    // Sincronización inicial
    if (this.isOnline) {
      setTimeout(() => this.syncNow(), 1000);
    }
  }

  private stopSyncIntervals() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.forceSyncInterval) {
      clearInterval(this.forceSyncInterval);
      this.forceSyncInterval = null;
    }
  }

  async syncNow(force = false): Promise<boolean> {
    if (!this.isOnline || !this.user || this.user.role !== 'GESTOR') {
      return false;
    }

    try {
      // Verificar si necesita sincronización
      if (!force) {
        const status = await getSyncStatus();
        if (status) {
          const lastSync = new Date(status.lastSync);
          const now = new Date();
          const timeDiff = now.getTime() - lastSync.getTime();
          
          // Si la última sincronización fue hace menos de 3 minutos, saltar
          if (timeDiff < 3 * 60 * 1000) {
            return true;
          }
        }
      }

      console.log('🔄 Iniciando sincronización de datos...');

      // Llamar al endpoint de sincronización
      const response = await fetch('/api/mobile/sync', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Error de sincronización: ${response.status}`);
      }

      const syncData = await response.json();

      // Guardar datos offline
      await saveOfflineData({
        credits: syncData.credits || [],
        clients: syncData.clients || [],
        paymentPlans: syncData.paymentPlans || [],
        gestorId: this.user.id,
      });

      console.log(`✅ Sincronización completa: ${syncData.stats?.totalCredits || 0} créditos, ${syncData.stats?.totalClients || 0} clientes`);
      
      return true;
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      return false;
    }
  }

  async getOfflineStatus(): Promise<{
    hasData: boolean;
    lastSync: string | null;
    totalCredits: number;
    totalClients: number;
  }> {
    const hasData = await isDataAvailableOffline();
    const status = await getSyncStatus();

    return {
      hasData,
      lastSync: status?.lastSync || null,
      totalCredits: status?.totalCredits || 0,
      totalClients: status?.totalClients || 0,
    };
  }

  destroy() {
    this.stopSyncIntervals();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
  }
}

// Instancia singleton
export const offlineSyncManager = new OfflineSyncManager();

// Hook para usar en componentes
export function useOfflineSync() {
  return {
    syncNow: () => offlineSyncManager.syncNow(true),
    getStatus: () => offlineSyncManager.getOfflineStatus(),
  };
}