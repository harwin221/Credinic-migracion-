
'use client';

import { useUser, UserProvider } from '@/hooks/use-user';
import { SidebarLayout } from '@/components/SidebarLayout';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getPendingPayments, deletePendingPayment } from '@/services/offline-db';
import { offlineSyncManager } from '@/services/offline-sync';
import { addPayment } from '@/app/credits/actions';
import { useToast } from '@/hooks/use-toast';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

/**
 * Componente interno que maneja la lógica de cliente.
 */
function LayoutManager({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const pathname = usePathname();

  const isPublicRoute = pathname === '/login' || pathname === '/setup';
  const isReportRoute = pathname.startsWith('/reports/');

  React.useEffect(() => {
    // Configurar el gestor de sincronización offline
    offlineSyncManager.setUser(user);

    return () => {
      // Limpiar cuando el componente se desmonte
      if (!user) {
        offlineSyncManager.setUser(null);
      }
    };
  }, [user]);

  React.useEffect(() => {
    async function syncPendingPayments() {
      if (isOnline && user) {
        const pending = await getPendingPayments();
        if (pending.length > 0) {
          toast({ title: "Sincronizando pagos...", description: `Enviando ${pending.length} pago(s) guardado(s) offline.` });
          let successCount = 0;
          for (const p of pending) {
            try {
              const result = await addPayment(p.creditId, p.paymentData, user);
              if (result.success) {
                await deletePendingPayment(p.timestamp);
                successCount++;
              } else {
                console.error('Error sincronizando pago:', result.error);
              }
            } catch (error) {
              console.error('Fallo al sincronizar pago:', error);
            }
          }
          if (successCount > 0) {
            toast({ title: "Sincronización Completa", description: `${successCount} pago(s) han sido sincronizados correctamente.` });
          }
        }
      }
    }

    const intervalId = setInterval(syncPendingPayments, 60 * 1000); // Revisa cada minuto
    syncPendingPayments(); // Revisa inmediatamente al cargar

    return () => clearInterval(intervalId);
  }, [isOnline, user, toast]);

  // Loader eliminado para permitir renderizado optimista
  // if (loading) { ... }

  // Si no hay usuario y estamos en una ruta pública, o si es una ruta de reporte,
  // renderiza el contenido sin el layout principal.
  if ((!user && isPublicRoute) || isReportRoute) {
    return <>{children}</>;
  }

  // Si hay un usuario, siempre se muestra el layout con la barra lateral.
  // El middleware ya se encarga de proteger las rutas no públicas.
  if (user) {
    return (
      <>
        <SidebarLayout>{children}</SidebarLayout>
        <PWAInstallPrompt />
      </>
    );
  }

  // Si no hay usuario y no es una ruta pública, el middleware ya habrá redirigido.
  // Mostramos los children, que en caso de not-found, será la página de not-found.
  if (!user && !isPublicRoute) {
    return <>{children}</>;
  }

  // Fallback en caso de que ninguna de las condiciones anteriores se cumpla.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}


/**
 * Este es el CLIENT-SIDE layout component.
 * Envuelve la aplicación con UserProvider y luego usa LayoutManager para manejar la lógica de cliente.
 */
export function AppClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <LayoutManager>{children}</LayoutManager>
    </UserProvider>
  );
}
