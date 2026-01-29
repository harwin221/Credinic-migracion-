'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createUser, updateUserAction } from "@/app/settings/users/actions";
import { UserRole, AppUser } from "@/lib/types";
import { USER_ROLES } from "@/lib/constants";
import { Loader2, Phone, Eye, EyeOff } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { getSucursales } from "@/services/sucursal-service";

const generateUsername = (fullName: string): string => {
  if (!fullName) return '';
  const normalized = fullName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const parts = normalized.split(' ').filter(p => !!p);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  
  if (parts.length > 2) {
    return `${parts[0]}.${parts[2]}`.replace(/[^a-z0-9_.]/g, '');
  }
  
  return `${parts[0]}.${parts[1]}`.replace(/[^a-z0-9_.]/g, '');
};

const UserFormSchema = z.object({
  displayName: z.string().min(3, "El nombre completo es requerido."),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres."),
  password: z.string().optional(),
  phone: z.string().optional(),
  role: z.string(),
  branch: z.string(),
  status: z.boolean(),
});

type UserFormValues = z.infer<typeof UserFormSchema>;

type UserFormProps = {
  onFinished: () => void;
  initialData?: AppUser | null;
}

const GLOBAL_ACCESS_ROLES = ['ADMINISTRADOR', 'FINANZAS'];

export function UserForm({ onFinished, initialData }: UserFormProps) {
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const [branches, setBranches] = React.useState<{value: string, label: string}[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  
  const formSchema = React.useMemo(() => {
    return UserFormSchema.superRefine((data, ctx) => {
        if (!initialData && (!data.password || data.password.length < 6)) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["password"],
                message: "La contraseña debe tener al menos 6 caracteres.",
            });
        }
    });
  }, [initialData]);

  React.useEffect(() => {
    const fetchFormData = async () => {
        try {
            const branchesData = await getSucursales();
            if (branchesData && Array.isArray(branchesData)) {
              setBranches(branchesData.map(doc => ({ value: doc.id, label: doc.name.toUpperCase() })));
            }
        } catch (error) {
            console.error("Error al obtener datos del formulario: ", error);
        }
    };
    fetchFormData();
  }, []);
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: initialData?.fullName || "",
      username: initialData?.username || "",
      password: "",
      phone: initialData?.phone || "",
      role: initialData?.role || "GESTOR",
      branch: initialData?.sucursal || "",
      status: initialData?.active !== false,
    },
  });
  
  const role = form.watch("role");
  const displayNameValue = form.watch("displayName");

  React.useEffect(() => {
    if (initialData) return;
    const generatedUser = generateUsername(displayNameValue);
    if (generatedUser) {
      form.setValue('username', generatedUser, { shouldValidate: true });
    }
  }, [displayNameValue, form, initialData]);

  const [phoneValue, setPhoneValue] = React.useState(form.getValues('phone') || '');
  const showPhoneField = ['GESTOR'].includes(role);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhoneValue(formatted);
    form.setValue('phone', formatted, { shouldValidate: true });
  };

  React.useEffect(() => {
    if (GLOBAL_ACCESS_ROLES.includes(role)) {
      form.setValue('branch', 'TODAS');
    }
  }, [role, form]);

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        displayName: initialData.fullName,
        username: initialData.username,
        phone: initialData.phone || '',
        role: initialData.role,
        branch: initialData.sucursal || (GLOBAL_ACCESS_ROLES.includes(initialData.role) ? 'TODAS' : ''),
        status: initialData.active !== false,
        password: "",
      });
      setPhoneValue(initialData.phone || '');
    } else {
      form.reset({ displayName: "", username: "", password: "", phone: "", role: "GESTOR", branch: "", status: true });
      setPhoneValue('');
    }
  }, [initialData, form]);

  async function onSubmit(values: UserFormValues) {
    setLoading(true);
    if (!currentUser) {
        toast({ title: "Error", description: "No se pudo identificar al usuario actual.", variant: "destructive" });
        setLoading(false);
        return;
    }
    try {
      let result: { success: boolean; error?: string; };

      if (initialData) {
        result = await updateUserAction(initialData.id, {
            fullName: values.displayName.toUpperCase(),
            username: values.username,
            phone: values.phone || undefined,
            role: values.role.toUpperCase() as UserRole,
            sucursal: values.branch,
            sucursalName: branches.find(b => b.value === values.branch)?.label,
            active: values.status,
        }, currentUser);
      } else {
        if (!values.password) {
            toast({ title: "Error", description: "La contraseña es requerida.", variant: "destructive" });
            setLoading(false);
            return;
        }
        result = await createUser({
            displayName: values.displayName,
            username: values.username,
            password: values.password,
            phone: values.phone,
            role: values.role.toUpperCase() as UserRole,
            branch: values.branch,
            active: values.status,
        }, currentUser);
      }
      
      if (result.success) {
          toast({
            title: `Usuario ${initialData ? 'Actualizado' : 'Creado'}`,
            description: "La información se ha guardado exitosamente.",
          });
          onFinished();
      } else {
          throw new Error(result.error || "Ocurrió un error desconocido.");
      }

    } catch(e: any) {
        console.error("Error al guardar usuario: ", e);
        toast({
            title: "Error al Guardar",
            description: e.message || "No se pudo guardar la información del usuario.",
            variant: "destructive"
        });
    } finally {
        setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto pr-6 pl-1 -mr-6 space-y-6 py-4">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Juan Pérez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de Usuario</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: juan.perez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
           {showPhoneField && (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                     <FormControl>
                        <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="8888-8888" {...field} value={phoneValue} onChange={handlePhoneChange} className="pl-8" maxLength={9} />
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          {!initialData && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} {...field} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    La contraseña debe tener al menos 6 caracteres.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rol</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleccione un rol..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {USER_ROLES.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sucursal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={GLOBAL_ACCESS_ROLES.includes(role)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una sucursal..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GLOBAL_ACCESS_ROLES.includes(role) ? (
                      <SelectItem value="TODAS">TODAS</SelectItem>
                    ) : (
                      branches.map(branch => <SelectItem key={branch.value} value={branch.value}>{branch.label}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Estado del Usuario</FormLabel>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="bg-background/95 py-4 mt-auto">
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                {loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
        </div>
      </form>                                    
    </Form>
  )
}
