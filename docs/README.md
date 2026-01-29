# 📋 CrediNica - Documentación del Sistema

## 🎯 **Descripción del Sistema**

CrediNica es un sistema completo de gestión de créditos y cobranza para microfinanzas, desarrollado como Progressive Web App (PWA) con funcionalidad offline para gestores de campo.

### **Características Principales:**
- **Gestión completa de clientes y créditos**
- **Cálculo automático de planes de pago**
- **Sistema de roles y permisos granular**
- **Reportes financieros y operativos**
- **Funcionalidad offline para gestores**
- **API móvil para app Android**
- **Manejo consistente de fechas en zona horaria Nicaragua**

---

## 🏗️ **Arquitectura del Sistema**

### **Stack Tecnológico:**
- **Frontend:** Next.js 15, React 18, TypeScript
- **Backend:** Next.js API Routes, Server Actions
- **Base de Datos:** MySQL 8.0
- **UI:** Tailwind CSS, Radix UI, Shadcn/ui
- **PWA:** Service Workers, Cache API
- **Autenticación:** JWT con cookies httpOnly

### **Estructura de Roles:**
- **ADMINISTRADOR** - Acceso completo al sistema
- **GERENTE** - Gestión operativa y supervisión general
- **FINANZAS** - Reportes financieros y arqueos
- **OPERATIVO** - Operaciones diarias de oficina
- **SUPERVISOR** - Supervisión de gestores por sucursal
- **GESTOR** - Gestión directa de clientes y cobranza

---

## 📱 **API Documentation**

### **Autenticación**
```http
POST /api/login
Content-Type: application/json

{
  "email": "usuario@credinica.com",
  "password": "password123"
}
```

### **Endpoints Principales**
- `GET /api/me` - Usuario actual
- `GET /api/credits` - Listar créditos
- `POST /api/credits` - Crear crédito
- `GET /api/clients` - Listar clientes
- `POST /api/clients` - Crear cliente
- `GET /api/reports/*` - Reportes del sistema

### **API Móvil (Android)**
- `GET /api/mobile/sync` - Sincronización completa offline
- `POST /api/mobile/payments` - Aplicar pagos (individual/batch)
- `POST /api/mobile/receipt` - Generar recibos
- `GET /api/mobile/status` - Estado y estadísticas

---

## 💰 **Lógica de Negocio**

### **Cálculo de Créditos:**
1. **Plan de Pagos:** Generación automática basada en:
   - Monto del préstamo
   - Tasa de interés mensual
   - Plazo en meses
   - Frecuencia de pago (Diario, Semanal, Catorcenal, Quincenal)
   - Ajuste automático por fines de semana y feriados

2. **Estado del Crédito:** Cálculo en tiempo real de:
   - Saldo pendiente
   - Monto en mora
   - Días de atraso
   - Clasificación de riesgo CONAMI (A, B, C, D, E)

### **Frecuencias de Pago:**
- **Diario:** 20 cuotas por mes (días laborables)
- **Semanal:** 4 cuotas por mes
- **Catorcenal:** 2 cuotas por mes (cada 14 días)
- **Quincenal:** 2 cuotas por mes (cada 15 días)

---

## 📅 **Manejo de Fechas**

### **Zona Horaria:** America/Managua (UTC-6)
### **Formato de Almacenamiento:** ISO 8601 strings
### **Base de Datos:** Campos DATETIME (no TIMESTAMP)

### **Utilidades Principales:**
```typescript
import { 
  nowInNicaragua,           // Fecha actual en Nicaragua
  formatDateForUser,        // Formato para mostrar: "31/10/2025"
  formatDateTimeForUser,    // Con hora: "31/10/2025 14:30:00"
  userInputToISO,          // Convertir input a ISO
  isoToMySQLDateTime       // Para base de datos
} from '@/lib/date-utils';
```

### **Componentes de UI:**
```tsx
// Mostrar fechas
<DateDisplay date={credit.applicationDate} />
<DateDisplay date={payment.paymentDate} format="datetime" />

// Input de fechas
<DateInput 
  value={formData.date} 
  onChange={(iso) => setFormData({...formData, date: iso})}
  required
/>
```

---

## 📱 **Progressive Web App (PWA)**

### **Instalación:**
- **Android:** Chrome → Instalar aplicación
- **iOS:** Safari → Agregar a pantalla de inicio
- **Desktop:** Chrome/Edge → Instalar

### **Características PWA:**
- ✅ Funciona offline con cache inteligente
- ✅ Notificaciones push
- ✅ Experiencia nativa (pantalla completa)
- ✅ Actualizaciones automáticas
- ✅ Iconos en pantalla de inicio

---

## 🔐 **Seguridad**

### **Autenticación:**
- JWT tokens con cookies httpOnly
- Sesiones de 24 horas
- Middleware de protección de rutas

### **Protección de Datos:**
- Cédulas codificadas en Base64
- HTTPS obligatorio en producción
- Validación de datos en todos los endpoints
- Rate limiting implementado

### **Permisos Granulares:**
```typescript
// Ejemplo de permisos por rol
GERENTE: [
  'dashboard:view', 'client:view', 'client:create', 'client:edit',
  'credit:view:all', 'credit:create', 'credit:edit', 'credit:pay',
  'reports:view', 'reports:view:saldos', 'reports:view:operativos',
  'approval:view', 'approval:level2'
]
```

---

## 🗄️ **Base de Datos**

### **Migración:**
Para actualizar la estructura de base de datos:
```bash
mysql -u usuario -p database < docs/database_structure_migration.sql
```

### **Tablas Principales:**
- `users` - Usuarios del sistema
- `sucursales` - Oficinas/sucursales
- `clients` - Clientes
- `credits` - Créditos
- `payment_plan` - Plan de pagos
- `payments_registered` - Pagos registrados
- `audit_logs` - Auditoría completa

---

## 📊 **Reportes Disponibles**

### **Reportes de Cartera:**
- Saldos de Cartera
- Porcentaje Pagado
- Créditos Vencidos
- Análisis de Rechazos
- Proyección de Cuotas Futuras

### **Reportes Operativos:**
- Listado de Cobros Diario
- Colocación vs Recuperación
- Reporte de Desembolsos
- Reporte de Recuperación

### **Reportes Financieros:**
- Meta Cobranza
- Reporte de Provisiones
- Historial de Arqueos

---

## 🚀 **Desarrollo y Deployment**

### **Scripts Disponibles:**
```bash
npm run dev      # Desarrollo
npm run build    # Construcción
npm run start    # Producción
npm run lint     # Linting
```

### **Variables de Entorno:**
```env
JWT_SECRET=tu-secret-key-muy-segura
DATABASE_URL=mysql://user:pass@host:port/database
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

### **Estructura del Proyecto:**
```
src/
├── app/                 # Páginas y API routes
├── components/          # Componentes reutilizables
├── hooks/              # Custom hooks
├── lib/                # Utilidades y configuración
├── services/           # Servicios de datos
└── types/              # Definiciones TypeScript
```

---

## 📞 **Soporte y Mantenimiento**

### **Logs de Auditoría:**
Todas las acciones críticas se registran automáticamente:
- Creación/edición de clientes y créditos
- Aplicación y anulación de pagos
- Cambios de configuración
- Acciones administrativas

### **Monitoreo:**
- Health check: `GET /api/health`
- Versión del sistema: `GET /api/version`
- Métricas de rendimiento integradas

---

## 🎯 **Próximas Funcionalidades**

- **App Android nativa** con sincronización offline
- **Integración con impresoras térmicas** Bluetooth
- **Notificaciones push** para recordatorios
- **Dashboard ejecutivo** con métricas avanzadas
- **API de integración** con sistemas contables

---

**CrediNica - Sistema completo de gestión de microfinanzas** 🏦✨