
'use server';

import * as React from 'react';
import { getSession } from '@/app/(auth)/login/actions';
import { getPortfolioForGestor } from '@/services/portfolio-service';
import { getSucursales } from '@/services/sucursal-service';
import { generateColocacionVsRecuperacionReport } from '@/services/report-service';
import { GlobalDashboard } from '@/app/dashboard/components/AdminDashboard';
import { DefaultDashboard } from '@/app/dashboard/components/DefaultDashboard';
import { GestorDashboard } from './components/GestorDashboard';
import { format } from 'date-fns';

export default async function DashboardPage() {
    const user = await getSession();

    if (!user) {
        return <DefaultDashboard user={{ fullName: 'Invitado', role: '' } as any} />;
    }

    const userRole = user.role.toUpperCase();
    // Usar la función correcta para obtener la fecha actual en Nicaragua
    const { todayInNicaragua } = await import('@/lib/date-utils');
    const todayNic = todayInNicaragua();

    switch (userRole) {
        case 'GESTOR': {
            const { portfolio, dailySummary } = await getPortfolioForGestor(user.id);
            return <GestorDashboard user={user} initialPortfolio={portfolio} initialSummary={dailySummary} />;
        }
        case 'ADMINISTRADOR':
        case 'GERENTE':
        case 'FINANZAS':
        case 'OPERATIVO': {
            const initialSucursales = await getSucursales();

            const sucursalesFilter = (user.role === 'ADMINISTRADOR' || user.role === 'FINANZAS') ? undefined : [user.sucursal || ''];

            const initialReportData = await generateColocacionVsRecuperacionReport({
                sucursales: sucursalesFilter,
                dateFrom: todayNic,
                dateTo: todayNic,
            });

            return <GlobalDashboard user={user} initialSucursales={initialSucursales} initialReportData={initialReportData} />;
        }
        default:
            return <DefaultDashboard user={user} />;
    }
}
