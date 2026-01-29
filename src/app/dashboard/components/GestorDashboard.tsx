'use client';

import * as React from 'react';
import type { AppUser, CreditDetail, RegisteredPayment, PortfolioCredit } from '@/lib/types';
import { getPortfolioForGestor, type GestorDashboardData } from '@/services/portfolio-service';
import { Loader2, CalendarClock, AlertTriangle, ShieldCheck, Ban, Wallet, Users, BarChart, Eye, Search, ArrowRightLeft, Target, HandCoins, MoreHorizontal, Printer, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { nowInNicaragua } from '@/lib/date-utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PaymentForm } from '@/app/credits/components/PaymentForm';
import { addPayment } from '@/app/credits/actions';
import { calculateCreditStatusDetails } from '@/lib/utils';
import { printDocument } from '@/services/printer-service';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { CreditSearchDialog } from './CreditSearchDialog';
import { getCredit } from '@/services/credit-service';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const formatCurrency = (amount: number = 0) => `C$${amount.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;

interface CategorizedCredits {
  paidToday: PortfolioCredit[];
  dueToday: PortfolioCredit[];
  overdue: PortfolioCredit[];
  expired: PortfolioCredit[];
  upToDate: PortfolioCredit[];
}

const BigStatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ElementType, color: string }) => (
     <Card className={cn("text-white transition-all hover:shadow-xl hover:-translate-y-1", color)}>
        <CardContent className="pt-6 text-center space-y-2">
            <Icon className="h-10 w-10 mx-auto opacity-80" />
            <p className="text-sm font-medium uppercase tracking-wider">{title}</p>
            <p className="text-4xl font-bold">{value}</p>
        </CardContent>
    </Card>
);


const statusConfig = {
    paidToday: { color: 'bg-blue-500', label: 'Cobrado Hoy' },
    dueToday: { color: 'bg-green-500', label: 'Cuota del Día' },
    overdue: { color: 'bg-orange-500', label: 'En Mora' },
    expired: { color: 'bg-red-500', label: 'Vencido' },
    upToDate: { color: 'bg-gray-500', label: 'Al Día' },
};

export function GestorDashboard({ user, initialPortfolio, initialSummary }: { user: AppUser, initialPortfolio: PortfolioCredit[], initialSummary: GestorDashboardData }) {
  const { toast } = useToast();
  const router = useRouter();

  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedCreditForPayment, setSelectedCreditForPayment] = React.useState<CreditDetail | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const categorizeCredits = React.useCallback((portfolio: PortfolioCredit[]): CategorizedCredits => {
    const categories: CategorizedCredits = { paidToday: [], dueToday: [], overdue: [], expired: [], upToDate: [] };
    
    portfolio.forEach(credit => {
      if (credit.details.paidToday > 0) {
        categories.paidToday.push(credit);
      } else if (credit.details.isDueToday) {
        categories.dueToday.push(credit);
      } else if (credit.details.isExpired) {
        categories.expired.push(credit);
      } else if (credit.details.overdueAmount > 0) {
        categories.overdue.push(credit);
      } else {
        categories.upToDate.push(credit);
      }
    });
    return categories;
  }, []);
  
  const [categorizedCredits, setCategorizedCredits] = React.useState<CategorizedCredits>(() => categorizeCredits(initialPortfolio));
  const [dailySummary, setDailySummary] = React.useState<GestorDashboardData | null>(initialSummary);

  const fetchPortfolio = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { portfolio, dailySummary } = await getPortfolioForGestor(user.id);
      setCategorizedCredits(categorizeCredits(portfolio));
      setDailySummary(dailySummary);
      toast({ title: "Cartera Actualizada", description: "Se han cargado los datos más recientes." });
    } catch (error) {
      console.error("Error fetching gestor portfolio:", error);
      toast({ title: 'Error', description: 'No se pudo refrescar la cartera de cobros.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, categorizeCredits]);

  const handleSelectCreditForPayment = async (credit: CreditDetail) => {
    if (!credit || !credit.id) return;
    const fullCreditDetails = await getCredit(credit.id);
    if (fullCreditDetails) {
        setSelectedCreditForPayment(fullCreditDetails);
        setIsPaymentModalOpen(true);
    } else {
        toast({title: 'Error', description: 'No se pudo cargar la información completa del crédito.', variant: 'destructive'});
    }
  };
  
  const handleReprintReceipt = (credit: PortfolioCredit) => {
    const lastPayment = [...(credit.registeredPayments || [])]
      .filter(p => p.status !== 'ANULADO')
      .sort((a,b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
      
    if (lastPayment) {
        printDocument('receipt', credit.id, lastPayment.id, true);
    } else {
        toast({ title: 'Error', description: 'No se encontró el último pago para reimprimir.', variant: 'destructive'});
    }
  };

  const handlePaymentSubmit = async (paymentValues: any) => {
    if (!selectedCreditForPayment || !user) return;
    
    const newPayment: Omit<RegisteredPayment, 'id'> = {
        paymentDate: nowInNicaragua(),
        amount: paymentValues.amount,
        managedBy: user.fullName,
        transactionNumber: `PAY-${Date.now()}`,
        status: 'VALIDO'
    };
    
    try {
        const result = await addPayment(selectedCreditForPayment.id, newPayment, user);
        if (result.success && result.paymentId) {
            toast({ title: "Pago Registrado", description: "El abono ha sido registrado exitosamente.", variant: 'info' });
            setIsPaymentModalOpen(false);
            fetchPortfolio(); // Refresh dashboard data
            printDocument('receipt', selectedCreditForPayment.id, result.paymentId, false);
        } else {
            throw new Error(result.error || "Error desconocido al registrar el pago.");
        }
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const paymentFormDetails = selectedCreditForPayment ? calculateCreditStatusDetails(selectedCreditForPayment) : null;
  
  const CreditCategoryTable = ({ credits, statusKey }: { credits: PortfolioCredit[], statusKey: keyof typeof statusConfig }) => {
    if (credits.length === 0) {
        return <div className="text-center text-muted-foreground p-8">No hay clientes en esta categoría.</div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>{statusKey === 'paidToday' ? 'Monto Cobrado' : 'Monto a Pagar'}</TableHead>
                    <TableHead className="text-right">Saldo Restante</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {credits.map(credit => {
                    const totalToPay = (credit.details.dueTodayAmount || 0) + credit.details.overdueAmount;
                    const paidToday = credit.details.paidToday > 0;
                    return (
                        <TableRow key={credit.id} onClick={!paidToday ? () => handleSelectCreditForPayment(credit) : undefined} className={!paidToday ? "cursor-pointer" : ""}>
                            <TableCell className="font-medium flex flex-col">
                               <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", statusConfig[statusKey].color)}></span>
                                {credit.clientName}
                               </div>
                               {paidToday && statusKey === 'dueToday' && <Badge variant="secondary" className="w-fit mt-1">Abonado</Badge>}
                            </TableCell>
                            <TableCell>{formatCurrency(paidToday ? credit.details.paidToday : totalToPay)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(credit.details.remainingBalance)}</TableCell>
                             <TableCell className="text-right">
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleSelectCreditForPayment(credit)}>
                                            <Wallet className="mr-2 h-4 w-4"/> Aplicar Abono
                                        </DropdownMenuItem>
                                        {paidToday && (
                                         <DropdownMenuItem onClick={() => handleReprintReceipt(credit)}>
                                            <Printer className="mr-2 h-4 w-4"/> Reimprimir
                                        </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
  };

  return (
    <>
    <div className="space-y-6">
        <div className="flex justify-end gap-2">
             <Button variant="secondary" onClick={() => setIsSearchOpen(true)}>
                <HandCoins className="mr-2 h-4 w-4" /> Registrar Abono Externo
            </Button>
            <Button variant="outline" onClick={fetchPortfolio} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Actualizar Cartera
            </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <BigStatCard title="Recuperado Hoy" value={formatCurrency(dailySummary?.recuperacionTotal ?? 0)} icon={Wallet} color="bg-gradient-to-br from-blue-500 to-cyan-500" />
            <BigStatCard title="Clientes Atendidos" value={dailySummary?.totalClientesCobrados ?? 0} icon={Users} color="bg-gradient-to-br from-green-500 to-emerald-500" />
            <BigStatCard title="Meta de Cobro" value={formatCurrency(dailySummary?.metaDeCobro ?? 0)} icon={Target} color="bg-gradient-to-br from-orange-500 to-amber-500" />
            <BigStatCard title="Renovaciones" value={dailySummary?.pendingRenewals ?? 0} icon={HandCoins} color="bg-gradient-to-br from-violet-500 to-purple-500" />
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Cartera de Cobros Asignada</CardTitle>
          <CardDescription>
            Toca sobre un cliente para registrar un abono rápido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dueToday">
            <div className="overflow-x-auto pb-2">
                <TabsList className="grid w-full grid-cols-5 min-w-[700px] md:min-w-0">
                  <TabsTrigger value="paidToday">
                    <CheckCircle className="mr-2 h-4 w-4" /> Cobrado Hoy ({categorizedCredits.paidToday.length})
                  </TabsTrigger>
                  <TabsTrigger value="dueToday">
                    <CalendarClock className="mr-2 h-4 w-4" /> Cuota del Día ({categorizedCredits.dueToday.length})
                  </TabsTrigger>
                  <TabsTrigger value="overdue">
                    <AlertTriangle className="mr-2 h-4 w-4" /> En Mora ({categorizedCredits.overdue.length})
                  </TabsTrigger>
                  <TabsTrigger value="expired">
                    <Ban className="mr-2 h-4 w-4" /> Vencidos ({categorizedCredits.expired.length})
                  </TabsTrigger>
                  <TabsTrigger value="upToDate">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Al Día ({categorizedCredits.upToDate.length})
                  </TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="paidToday" className="mt-4"><CreditCategoryTable credits={categorizedCredits.paidToday} statusKey="paidToday" /></TabsContent>
            <TabsContent value="dueToday" className="mt-4"><CreditCategoryTable credits={categorizedCredits.dueToday} statusKey="dueToday" /></TabsContent>
            <TabsContent value="overdue" className="mt-4"><CreditCategoryTable credits={categorizedCredits.overdue} statusKey="overdue" /></TabsContent>
            <TabsContent value="expired" className="mt-4"><CreditCategoryTable credits={categorizedCredits.expired} statusKey="expired" /></TabsContent>
            <TabsContent value="upToDate" className="mt-4"><CreditCategoryTable credits={categorizedCredits.upToDate} statusKey="upToDate" /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>

     {selectedCreditForPayment && paymentFormDetails && (
        <PaymentForm 
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            onSubmit={handlePaymentSubmit}
            creditBalance={paymentFormDetails.remainingBalance}
            dueTodayAmount={paymentFormDetails.dueTodayAmount}
            paidToday={paymentFormDetails.paidToday}
            overdueAmount={paymentFormDetails.overdueAmount}
            lateFee={paymentFormDetails.currentLateFee}
            lateDays={paymentFormDetails.lateDays}
            clientName={selectedCreditForPayment.clientName}
            clientId={selectedCreditForPayment.clientId}
        />
     )}

     <CreditSearchDialog 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        mode="credit"
        onSelectCreditForPayment={handleSelectCreditForPayment}
     />
    </>
  );
}
