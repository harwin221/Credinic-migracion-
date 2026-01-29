
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { AppUser as User, Sucursal, UserRole } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

interface FilterItem {
  id: string;
  name: string;
}

interface ReportFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filters: { queryString: string }) => void;
  reportTitle: string;
  sucursales: Sucursal[];
  managers: User[];
  gestores: User[];
  officeUsers: User[];
  hasViewTypeFilter?: boolean;
}

function CheckboxFilterGroup({
  title,
  items,
  selectedItems,
  onSelectedItemsChange,
  disabled = false,
  emptyMessage = "No hay datos",
}: {
  title: string;
  items: FilterItem[];
  selectedItems: string[];
  onSelectedItemsChange: (selected: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  const isAllSelected = items.length > 0 && selectedItems.length === items.length;

  const handleSelectAll = (checked: boolean) => {
    onSelectedItemsChange(checked ? items.map((item) => item.id) : []);
  };

  const handleItemChange = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectedItemsChange([...selectedItems, itemId]);
    } else {
      onSelectedItemsChange(selectedItems.filter((id) => id !== itemId));
    }
  };

  return (
    <div className="space-y-2 flex flex-col">
      <Label className={cn("font-semibold", disabled && "text-muted-foreground")}>{title}</Label>
      <div className={cn("rounded-md border p-2 flex-1 flex flex-col", disabled && "bg-muted/50 cursor-not-allowed")}>
        <ScrollArea className="flex-1 h-32">
          <div className={cn("space-y-3 p-2", disabled && "pointer-events-none")}>
             {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
             ) : (
                items.map((item) => (
                <div key={`${title}-${item.id}`} className="flex items-start gap-3">
                    <Checkbox
                        id={`${item.id}-${title}`}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => handleItemChange(item.id, !!checked)}
                        className="mt-0.5"
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor={`${item.id}-${title}`} className="font-normal text-foreground cursor-pointer break-words">
                            {item.name}
                        </Label>
                    </div>
                </div>
                ))
             )}
          </div>
        </ScrollArea>
        {items.length > 0 && (
            <div className={cn("border-t mt-auto pt-2 flex items-center space-x-3", disabled && "pointer-events-none")}>
              <Checkbox
                  id={`select-all-${title.replace(/\s+/g, '-')}`}
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
              />
              <Label htmlFor={`select-all-${title.replace(/\s+/g, '-')}`} className="font-normal text-sm cursor-pointer">
                  Seleccionar todos
              </Label>
            </div>
        )}
      </div>
    </div>
  );
}

export function ReportFilterModal({
  isOpen,
  onClose,
  onSubmit,
  reportTitle,
  sucursales,
  managers,
  gestores,
  officeUsers,
  hasViewTypeFilter = false,
}: ReportFilterModalProps) {
  const [selectedSucursales, setSelectedSucursales] = React.useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = React.useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [fechaInicial, setFechaInicial] = React.useState<Date | undefined>();
  const [fechaFinal, setFechaFinal] = React.useState<Date | undefined>();
  const [viewType, setViewType] = React.useState<'detailed' | 'summary'>('detailed');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filtrar gerentes basado en sucursales seleccionadas
  const managerOptions: FilterItem[] = React.useMemo(() => {
    // Si no hay sucursales seleccionadas, no mostrar gerentes
    if (selectedSucursales.length === 0) {
      return [];
    }
    
    // Filtrar gerentes que pertenecen a las sucursales seleccionadas
    const filteredManagers = managers.filter(s => 
      s.sucursal && selectedSucursales.includes(s.sucursal)
    );
    
    return [
      { id: 'OFICINA', name: 'OFICINA' },
      ...filteredManagers.map(s => ({ id: s.id, name: s.fullName }))
    ];
  }, [managers, selectedSucursales]);

  const filteredUsers = React.useMemo(() => {
    let finalUsers: User[] = [];
    const managersWithoutOficina = selectedManagers.filter(s => s !== 'OFICINA');

    if (managersWithoutOficina.length > 0) {
        // Since managerId is removed, we'll filter gestores by sucursal instead
        const gestoresOfManagers = gestores.filter(g => {
          if (selectedSucursales.length === 0) return true;
          return g.sucursal && selectedSucursales.includes(g.sucursal);
        });
        finalUsers.push(...gestoresOfManagers);
    }
    
    if (selectedManagers.includes('OFICINA')) {
      const usersFromOffice = officeUsers.filter(u => {
        if (selectedSucursales.length === 0) return true;
        return u.sucursal && selectedSucursales.includes(u.sucursal);
      }).filter(u => u.role !== 'GESTOR');
      finalUsers.push(...usersFromOffice);
    }
    
    const uniqueUsers = Array.from(new Map(finalUsers.map(u => [u.id, u])).values());
    return uniqueUsers.sort((a,b) => a.fullName.localeCompare(b.fullName));

  }, [selectedManagers, selectedSucursales, gestores, officeUsers]);


  // Limpiar usuarios cuando cambian las sucursales
  React.useEffect(() => {
    setSelectedUsers([]);
  }, [selectedSucursales]);
  
  // Limpiar usuarios cuando cambian los gerentes
  React.useEffect(() => {
    setSelectedUsers([]);
  }, [selectedManagers]);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedSucursales([]);
      setSelectedManagers([]);
      setSelectedUsers([]);
      setFechaInicial(undefined);
      setFechaFinal(undefined);
      setViewType('detailed');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    setIsSubmitting(true);
    
    const params = new URLSearchParams();
    selectedSucursales.forEach(s => params.append('sucursal', s));
    
    const usersToFilter = selectedUsers.length > 0 ? selectedUsers : filteredUsers.map(u => u.id);
    usersToFilter.forEach(u => params.append('user', u));
    
    if (fechaInicial) params.set('from', format(fechaInicial, 'yyyy-MM-dd'));
    if (fechaFinal) params.set('to', format(fechaFinal, 'yyyy-MM-dd'));
    if (hasViewTypeFilter) params.set('viewType', viewType);

    setTimeout(() => {
      onSubmit({ queryString: params.toString() });
      setIsSubmitting(false);
      onClose();
    }, 500);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{reportTitle}</DialogTitle>
          <DialogDescription>Selecciona los filtros para generar el reporte.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
             <CheckboxFilterGroup
                title="Sucursal:"
                items={sucursales}
                selectedItems={selectedSucursales}
                onSelectedItemsChange={setSelectedSucursales}
              />
             <CheckboxFilterGroup
                title="Gerente:"
                items={managerOptions}
                selectedItems={selectedManagers}
                onSelectedItemsChange={setSelectedManagers}
                disabled={selectedSucursales.length === 0}
                emptyMessage="Seleccione una sucursal para ver gerentes."
              />
             <CheckboxFilterGroup
                title="Usuario:"
                items={filteredUsers.map(u => ({ id: u.id!, name: u.fullName }))}
                selectedItems={selectedUsers}
                onSelectedItemsChange={setSelectedUsers}
                disabled={selectedManagers.length === 0}
                emptyMessage="Seleccione un gerente u 'Oficina' para ver usuarios."
             />
          </div>
          
           {hasViewTypeFilter && (
            <div className="space-y-2 pt-4">
              <Label className="font-semibold">Configuración de Visualización</Label>
              <RadioGroup
                value={viewType}
                onValueChange={(value) => setViewType(value as any)}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="detailed" />
                  <Label htmlFor="detailed" className="font-normal cursor-pointer">Detallado</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summary" id="summary" />
                  <Label htmlFor="summary" className="font-normal cursor-pointer">Resumido</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          <Separator className="my-4"/>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="fecha-inicial">Fecha Inicial:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="fecha-inicial"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fechaInicial && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaInicial ? format(fechaInicial, 'PPP', { locale: es }) : <span>DD/MM/YYYY</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaInicial}
                    onSelect={setFechaInicial}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha-final">Fecha Final:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="fecha-final"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fechaFinal && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaFinal ? format(fechaFinal, 'PPP', { locale: es }) : <span>DD/MM/YYYY</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaFinal}
                    onSelect={setFechaFinal}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        

        <DialogFooter className="pt-6 border-t mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="sm:w-40">
             {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              'Generar reporte'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
