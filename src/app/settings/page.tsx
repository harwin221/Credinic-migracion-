
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Building, CalendarOff, Settings as SettingsIcon, Loader2, RefreshCw, ArrowLeft, ShieldAlert } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { useUser } from '@/hooks/use-user';
import { AccessDenied } from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ReportCard } from '@/app/reports/components/ReportCard';
import { revalidateActiveCreditsStatus } from '@/services/credit-service-server';

const ALLOWED_ROLES: UserRole[] = ['ADMINISTRADOR'];

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);

  if (!user) return null; // Or a loading skeleton
  if (!ALLOWED_ROLES.includes(user.role)) {
    return <AccessDenied />;
  }

  const handleSync = async () => {
    setIsSyncing(true);
    toast({ title: "Iniciando Sincronización...", description: "Regenerando planes de pago para créditos activos. Esto puede tardar un momento." });
    try {
      const result = await revalidateActiveCreditsStatus();
      if (result.success) {
        toast({
          title: "Sincronización Completada",
          description: `Se han regenerado ${result.updatedCount} planes de pago.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error de Sincronización",
        description: error instanceof Error ? error.message : "No se pudo completar la operación.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const settings = [
    {
      title: 'Usuarios',
      category: 'Gestión del Sistema',
      description: 'Gestionar cuentas de usuario, roles y permisos.',
      icon: Users,
      href: '/settings/users',
    },
    {
      title: 'Sucursales',
      category: 'Gestión del Sistema',
      description: 'Administrar sucursales y puntos de venta.',
      icon: Building,
      href: '/settings/sucursales',
    },
    {
      title: 'Días Feriados',
      category: 'Gestión del Sistema',
      description: 'Configurar días no laborables para cálculos de pago.',
      icon: CalendarOff,
      href: '/settings/holidays',
    },
    {
      title: 'Control de Acceso',
      category: 'Seguridad',
      description: 'Abrir o cerrar el acceso al sistema globalmente o por sucursal.',
      icon: ShieldAlert,
      href: '/settings/access-control',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settings.map((setting) => (
          <ReportCard
            key={setting.title}
            title={setting.title}
            category={setting.category}
            icon={setting.icon}
            onClick={() => router.push(setting.href)}
          />
        ))}
        <Card className="border-blue-500/50 hover:shadow-lg hover:border-blue-500 transition-all">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-5 w-5 text-blue-600" />Sincronizar Planes de Pago</CardTitle>
            <CardDescription className="text-xs">
              Vuelve a calcular todos los planes de pago de los créditos activos. Úsalo después de añadir feriados para corregir fechas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSync} disabled={isSyncing} className="w-full bg-blue-600 hover:bg-blue-700">
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isSyncing ? 'Sincronizando...' : 'Ejecutar Sincronización'}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

