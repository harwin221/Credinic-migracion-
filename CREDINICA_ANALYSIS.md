# Análisis Completo del Sistema CrediNica

## 1. PERMISOS Y ROLES DE USUARIOS

### Roles Definidos

El sistema define 5 roles principales con permisos específicos:

#### 1.1 ADMINISTRADOR
**Descripción:** Acceso total al sistema. Único con permisos de eliminación y configuración.

**Permisos:**
- Dashboard: view
- Clientes: view, create, edit, delete
- Créditos: view:all, create, edit, delete, pay
- Pagos: void_request, void:approve
- Cierres: view, create
- Calculadora: use
- Reportes: view, view:saldos, view:operativos, view:financieros
- Auditoría: view
- Configuración: view, seed_data
- Usuarios: view, create, edit, delete, reset_password
- Sucursales: view, create, edit, delete
- Aprobaciones: view, level2
- Desembolsos: view
- Plan de Pagos: edit_dates

#### 1.2 FINANZAS
**Descripción:** Acceso de solo lectura a reportes financieros y operativos.

**Permisos:**
- Dashboard: view
- Clientes: view
- Créditos: view:all
- Cierres: view, create
- Calculadora: use
- Reportes: view, view:saldos, view:operativos, view:financieros

#### 1.3 OPERATIVO
**Descripción:** Rol de oficina para crear clientes y solicitudes de crédito.

**Permisos:**
- Dashboard: view
- Clientes: view, create, edit
- Créditos: view:all, create, edit, pay
- Cierres: view, create
- Calculadora: use
- Reportes: view, view:saldos, view:operativos
- Aprobaciones: view
- Desembolsos: view

#### 1.4 GERENTE
**Descripción:** Gestor de sucursal con acceso a reportes y aprobaciones.

**Permisos:**
- Dashboard: view
- Clientes: view, create, edit
- Créditos: view:all, create, edit, pay
- Pagos: void_request
- Cierres: view, create
- Calculadora: use
- Reportes: view, view:saldos, view:operativos, view:financieros
- Aprobaciones: view, level2
- Desembolsos: view

#### 1.5 GESTOR
**Descripción:** Rol de campo. Gestiona su cartera de clientes.

**Permisos:**
- Dashboard: view
- Clientes: view, create, edit
- Créditos: create, pay
- Pagos: void_request
- Calculadora: use
- Reportes: view

### Matriz de Permisos

| Permiso | Admin | Finanzas | Operativo | Gerente | Gestor |
|---------|-------|----------|-----------|---------|--------|
| dashboard:view | ✓ | ✓ | ✓ | ✓ | ✓ |
| client:view | ✓ | ✓ | ✓ | ✓ | ✓ |
| client:create | ✓ | ✗ | ✓ | ✓ | ✓ |
| client:edit | ✓ | ✗ | ✓ | ✓ | ✓ |
| client:delete | ✓ | ✗ | ✗ | ✗ | ✗ |
| credit:view:all | ✓ | ✓ | ✓ | ✓ | ✗ |
| credit:create | ✓ | ✗ | ✓ | ✓ | ✓ |
| credit:edit | ✓ | ✗ | ✓ | ✓ | ✗ |
| credit:delete | ✓ | ✗ | ✗ | ✗ | ✗ |
| credit:pay | ✓ | ✗ | ✓ | ✓ | ✓ |
| payment:void_request | ✓ | ✗ | ✗ | ✓ | ✓ |
| void:approve | ✓ | ✗ | ✗ | ✗ | ✗ |
| closure:view | ✓ | ✓ | ✓ | ✓ | ✗ |
| closure:create | ✓ | ✓ | ✓ | ✓ | ✗ |
| calculator:use | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports:view | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports:view:saldos | ✓ | ✓ | ✓ | ✓ | ✗ |
| reports:view:operativos | ✓ | ✓ | ✓ | ✓ | ✗ |
| reports:view:financieros | ✓ | ✓ | ✗ | ✓ | ✗ |
| audit:view | ✓ | ✗ | ✗ | ✗ | ✗ |
| settings:view | ✓ | ✗ | ✗ | ✗ | ✗ |
| settings:seed_data | ✓ | ✗ | ✗ | ✗ | ✗ |
| user:* | ✓ | ✗ | ✗ | ✗ | ✗ |
| branch:* | ✓ | ✗ | ✗ | ✗ | ✗ |
| approval:view | ✓ | ✗ | ✓ | ✓ | ✗ |
| approval:level2 | ✓ | ✗ | ✗ | ✓ | ✗ |
| disbursement:view | ✓ | ✗ | ✓ | ✓ | ✗ |
| payment_plan:edit_dates | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 2. REGLAS DE NEGOCIO DEL SISTEMA

### 2.1 Estados de Crédito

Un crédito puede estar en los siguientes estados:

- **Pending:** Solicitud creada, esperando aprobación
- **Approved:** Aprobado, listo para desembolso
- **Active:** Desembolsado, en proceso de cobro
- **Paid:** Completamente pagado
- **Rejected:** Solicitud rechazada
- **Expired:** Vencido sin pagar completamente
- **Fallecido:** Cliente fallecido

### 2.2 Flujo de Vida de un Crédito

1. **Creación:** Usuario crea solicitud (estado: Pending)
2. **Aprobación:** Gerente/Admin aprueba (estado: Approved)
3. **Desembolso:** Se entrega el dinero (estado: Active)
4. **Cobro:** Se registran pagos del cliente
5. **Finalización:** Crédito completamente pagado (estado: Paid) o vencido (estado: Expired)

### 2.3 Cálculo de Intereses

- **Fórmula:** Interés Total = Monto Principal × (Tasa Mensual / 100) × Plazo en Meses
- **Distribución:** El interés se distribuye equitativamente entre todas las cuotas
- **Cuota Periódica:** (Monto Principal + Interés Total) / Número de Cuotas

### 2.4 Clasificación de Riesgo (CONAMI)

Basada en días de atraso:

| Categoría | Rango de Días | Descripción |
|-----------|---------------|-------------|
| A | 1-15 | Riesgo Normal |
| B | 16-30 | Riesgo Potencial |
| C | 31-60 | Riesgo Real |
| D | 61-90 | Dudosa Recuperación |
| E | 91+ | Irrecuperable |

### 2.5 Provisiones

Cada categoría de riesgo tiene una tasa de provisión:

- **Categoría A:** 1% del saldo
- **Categoría B:** 5% del saldo
- **Categoría C:** 20% del saldo
- **Categoría D:** 60% del saldo
- **Categoría E:** 100% del saldo

---

## 3. LÓGICA DE CRÉDITOS POR PERIODICIDAD

### 3.1 Periodicidades Soportadas

El sistema soporta 4 tipos de periodicidad de pago:

#### 3.1.1 DIARIO
- **Cuotas por mes:** 20 (asumiendo 20 días laborables)
- **Cuotas por plazo:** plazo_meses × 20
- **Regla de fin de semana:** NO permite sábados
- **Regla de feriado:** Feriado → siguiente día hábil

#### 3.1.2 SEMANAL
- **Cuotas por mes:** 4
- **Cuotas por plazo:** plazo_meses × 4
- **Regla de fin de semana:** SÍ permite sábados
- **Regla de feriado:** Feriado viernes → sábado; Feriado sábado → lunes

#### 3.1.3 CATORCENAL
- **Cuotas por mes:** 2
- **Cuotas por plazo:** plazo_meses × 2
- **Regla de fin de semana:** NO permite sábados
- **Regla de feriado:** Feriado viernes → sábado; Feriado sábado → lunes

#### 3.1.4 QUINCENAL
- **Cuotas por mes:** 2
- **Cuotas por plazo:** plazo_meses × 2
- **Regla de fin de semana:** SÍ permite sábados
- **Regla de feriado:** Feriado viernes → sábado; Feriado sábado → lunes
- **Nota especial:** Usa anclajes de día 1-15 y 16-30 para evitar deriva de fechas

### 3.2 Algoritmo de Ajuste de Fechas

Cuando se genera una cuota, la fecha se ajusta siguiendo este algoritmo:

```
1. Si la fecha es domingo → mover a lunes
2. Si la fecha es sábado:
   - Si es DIARIO o CATORCENAL → mover a lunes
   - Si es SEMANAL o QUINCENAL → permitir sábado
3. Si la fecha es feriado:
   - Si es DIARIO → mover al siguiente día hábil
   - Si es SEMANAL/CATORCENAL/QUINCENAL:
     - Si es viernes → mover a sábado
     - Si es sábado → mover a lunes
     - Otros días → mover al siguiente día
4. Repetir hasta que la fecha sea válida
```

### 3.3 Ejemplo de Generación de Plan

**Datos de entrada:**
- Monto: C$10,000
- Tasa: 5% mensual
- Plazo: 3 meses
- Frecuencia: Semanal
- Fecha inicio: 2024-01-08 (lunes)
- Feriados: [2024-01-15]

**Cálculo:**
- Número de cuotas: 3 × 4 = 12
- Interés total: 10,000 × (5/100) × 3 = C$1,500
- Total a pagar: C$11,500
- Cuota periódica: C$11,500 / 12 = C$958.33

**Plan generado:**
| Cuota | Fecha Teórica | Fecha Ajustada | Monto | Principal | Interés |
|-------|---------------|----------------|-------|-----------|---------|
| 1 | 2024-01-08 | 2024-01-08 | 958.33 | 833.33 | 125.00 |
| 2 | 2024-01-15 | 2024-01-16 | 958.33 | 833.33 | 125.00 |
| 3 | 2024-01-22 | 2024-01-22 | 958.33 | 833.33 | 125.00 |
| ... | ... | ... | ... | ... | ... |

---

## 4. MANEJO DE DÍAS FERIADOS

### 4.1 Gestión de Feriados

Los feriados se almacenan en la tabla `holidays` con:
- `id`: Identificador único
- `date`: Fecha del feriado (YYYY-MM-DD)
- `name`: Nombre del feriado

### 4.2 Sincronización de Planes

Cuando se agrega o elimina un feriado:

1. El sistema identifica todos los créditos ACTIVOS
2. Para cada crédito, regenera el plan de pagos con los feriados actualizados
3. Actualiza las fechas de pago en la base de datos
4. Registra la acción en auditoría

### 4.3 Corrección de Fechas por Feriados

**Reglas por tipo de crédito:**

- **DIARIO:** Feriado → siguiente día hábil (lunes si es viernes)
- **SEMANAL:** Feriado viernes → sábado; Feriado sábado → lunes
- **CATORCENAL:** Feriado viernes → sábado; Feriado sábado → lunes
- **QUINCENAL:** Feriado viernes → sábado; Feriado sábado → lunes

### 4.4 Ejemplo de Corrección

**Escenario:** Crédito semanal con cuota el viernes 15 de enero (feriado)

```
Fecha teórica: 2024-01-15 (viernes, feriado)
Paso 1: ¿Es domingo? No
Paso 2: ¿Es sábado? No (es viernes)
Paso 3: ¿Es feriado? Sí
  - Tipo: Semanal
  - Día: Viernes
  - Acción: Mover a sábado
Fecha ajustada: 2024-01-16 (sábado)
```

---

## 5. FUNCIONALIDADES POR MÓDULO

### 5.1 MÓDULO DE CLIENTES

**Funcionalidades:**
- Crear cliente con validación de cédula
- Editar información del cliente
- Registrar referencias personales
- Información laboral (asalariado o comerciante)
- Geolocalización (departamento/municipio)
- Historial de interacciones
- Tags/etiquetas personalizadas

**Validaciones:**
- Cédula: Formato 000-000000-0000A
- Teléfono: 8 dígitos
- Nombre: Mínimo 2 caracteres
- Dirección: Mínimo 10 caracteres

### 5.2 MÓDULO DE CRÉDITOS

**Funcionalidades:**
- Crear solicitud de crédito
- Generar plan de pagos automático
- Aprobar/rechazar solicitudes
- Desembolsar créditos
- Registrar pagos
- Anular pagos (con aprobación)
- Editar fechas del plan (solo Admin)
- Calcular estado actual del crédito

**Validaciones:**
- Monto: C$1,000 - C$1,000,000
- Tasa: 1% - 50% mensual
- Plazo: 0.5 - 60 meses
- Cliente debe existir
- Gestor debe existir

### 5.3 MÓDULO DE PAGOS

**Funcionalidades:**
- Registrar abono de cliente
- Generar recibo (impresión térmica)
- Reimprimir recibos
- Solicitar anulación de pago
- Aprobar anulación de pago
- Historial de pagos

**Cálculos:**
- Saldo anterior
- Monto pagado
- Nuevo saldo
- Aplicación de pagos (capital, interés, mora)

### 5.4 MÓDULO DE REPORTES

**Reportes disponibles:**

1. **Saldos de Cartera:** Saldo pendiente por cliente/gestor
2. **Porcentaje Pagado:** % de pago de cada crédito
3. **Cancelados y No Renovados:** Créditos pagados sin renovación
4. **Proyección de Cuotas Futuras:** Cuotas próximas a vencer
5. **Análisis de Rechazos:** Solicitudes rechazadas
6. **Reporte de Vencimiento:** Créditos vencidos
7. **Estado de Cuenta:** Detalle de cuotas y pagos por cliente
8. **Estado Consolidado:** Resumen de múltiples créditos
9. **Cobros Diario:** Cartera en mora del día
10. **Colocación vs Recuperación:** Desembolsos vs cobros por gestor
11. **Desembolsos:** Créditos desembolsados
12. **Recuperación:** Detalle de pagos recibidos
13. **Meta Cobranza:** Cumplimiento de metas
14. **Provisiones:** Cálculo de provisiones por categoría
15. **Historial de Arqueos:** Cierres de caja realizados

### 5.5 MÓDULO DE CONFIGURACIÓN

**Funcionalidades:**
- Gestión de usuarios (crear, editar, eliminar)
- Gestión de sucursales
- Gestión de feriados
- Control de acceso por sucursal/horario
- Diagnóstico de planes de pago

### 5.6 MÓDULO DE AUDITORÍA

**Funcionalidades:**
- Registro de todas las operaciones
- Filtrado por usuario, acción, fecha
- Detalles de cambios realizados
- Trazabilidad completa

### 5.7 MÓDULO DE ARQUEO

**Funcionalidades:**
- Cierre de caja diario
- Registro de denominaciones (NIO y USD)
- Cálculo de diferencias
- Historial de arqueos

---

## 6. AUTENTICACIÓN Y SEGURIDAD

### 6.1 Flujo de Autenticación

1. Usuario ingresa username y contraseña
2. Sistema valida credenciales contra base de datos
3. Contraseña se compara con hash bcrypt
4. Si es válida, se genera JWT con expiración de 24 horas
5. JWT se almacena en cookie httpOnly
6. En cada solicitud, se valida el JWT

### 6.2 Validaciones de Acceso

- **Verificación de sesión:** Cada ruta protegida valida la cookie de sesión
- **Verificación de rol:** Se valida que el usuario tenga el permiso requerido
- **Verificación de sucursal:** Usuarios no-admin solo ven datos de su sucursal
- **Control de horario:** Se puede bloquear acceso por horario (futuro)

### 6.3 Encriptación

- **Contraseñas:** bcryptjs con 10 rounds
- **Cédulas:** Base64 encoding (protección básica)
- **JWT:** HS256 con secret key de 24+ caracteres

---

## 7. ESTRUCTURA DE DATOS

### 7.1 Tabla: users

```sql
- id: VARCHAR(20) PRIMARY KEY
- username: VARCHAR(50) UNIQUE
- fullName: VARCHAR(100)
- email: VARCHAR(100)
- phone: VARCHAR(8)
- hashed_password: VARCHAR(255)
- role: ENUM('ADMINISTRADOR', 'GERENTE', 'GESTOR', 'OPERATIVO', 'FINANZAS')
- sucursal_id: VARCHAR(20) FK
- sucursal_name: VARCHAR(100)
- active: BOOLEAN
- mustChangePassword: BOOLEAN
- createdAt: DATETIME
- updatedAt: DATETIME
```

### 7.2 Tabla: clients

```sql
- id: VARCHAR(20) PRIMARY KEY
- clientNumber: VARCHAR(20) UNIQUE
- name: VARCHAR(100)
- firstName: VARCHAR(50)
- lastName: VARCHAR(50)
- cedula: VARCHAR(255) (encoded)
- phone: VARCHAR(8)
- sex: ENUM('masculino', 'femenino')
- civilStatus: ENUM('soltero', 'casado', 'divorciado', 'viudo', 'union_libre')
- employmentType: ENUM('asalariado', 'comerciante')
- sucursal_id: VARCHAR(20) FK
- sucursal_name: VARCHAR(100)
- department: VARCHAR(50)
- municipality: VARCHAR(50)
- departmentId: VARCHAR(20) FK
- municipalityId: VARCHAR(20) FK
- neighborhood: VARCHAR(100)
- address: VARCHAR(200)
- tags: JSON
- createdAt: DATETIME
- updatedAt: DATETIME
```

### 7.3 Tabla: credits

```sql
- id: VARCHAR(20) PRIMARY KEY
- creditNumber: VARCHAR(20) UNIQUE
- clientId: VARCHAR(20) FK
- clientName: VARCHAR(100)
- status: ENUM('Pending', 'Approved', 'Active', 'Paid', 'Rejected', 'Expired', 'Fallecido')
- applicationDate: DATETIME
- approvalDate: DATETIME
- approvedBy: VARCHAR(100)
- amount: DECIMAL(12,2)
- principalAmount: DECIMAL(12,2)
- interestRate: DECIMAL(5,2)
- termMonths: DECIMAL(5,2)
- paymentFrequency: ENUM('Diario', 'Semanal', 'Catorcenal', 'Quincenal')
- currencyType: ENUM('CÓRDOBAS', 'DÓLARES')
- totalAmount: DECIMAL(12,2)
- totalInterest: DECIMAL(12,2)
- totalInstallmentAmount: DECIMAL(12,2)
- firstPaymentDate: DATETIME
- deliveryDate: DATETIME
- dueDate: DATETIME
- collectionsManager: VARCHAR(100)
- createdBy: VARCHAR(100)
- branch: VARCHAR(20) FK
- branchName: VARCHAR(100)
- productType: VARCHAR(50)
- subProduct: VARCHAR(50)
- productDestination: VARCHAR(200)
- createdAt: DATETIME
- updatedAt: DATETIME
```

### 7.4 Tabla: payment_plan

```sql
- id: VARCHAR(20) PRIMARY KEY
- creditId: VARCHAR(20) FK
- paymentNumber: INT
- paymentDate: DATETIME
- amount: DECIMAL(12,2)
- principal: DECIMAL(12,2)
- interest: DECIMAL(12,2)
- balance: DECIMAL(12,2)
```

### 7.5 Tabla: payments_registered

```sql
- id: VARCHAR(20) PRIMARY KEY
- creditId: VARCHAR(20) FK
- paymentDate: DATETIME
- amount: DECIMAL(12,2)
- managedBy: VARCHAR(100)
- transactionNumber: VARCHAR(50)
- status: ENUM('VALIDO', 'ANULACION_PENDIENTE', 'ANULADO')
- voidReason: TEXT
- voidRequestedBy: VARCHAR(100)
- createdAt: DATETIME
```

### 7.6 Tabla: holidays

```sql
- id: VARCHAR(20) PRIMARY KEY
- date: DATETIME
- name: VARCHAR(100)
```

---

## 8. APIs Y RUTAS

### 8.1 Autenticación

- `POST /api/login` - Iniciar sesión
- `POST /api/logout` - Cerrar sesión
- `GET /api/me` - Obtener perfil actual

### 8.2 Clientes

- `GET /api/clients` - Listar clientes
- `POST /api/clients` - Crear cliente
- `GET /api/clients/[id]` - Obtener cliente
- `PUT /api/clients/[id]` - Actualizar cliente

### 8.3 Créditos

- `GET /api/credits` - Listar créditos
- `POST /api/credits` - Crear crédito
- `GET /api/credits/[id]` - Obtener crédito
- `PUT /api/credits/[id]` - Actualizar crédito
- `POST /api/credits/[id]/payments` - Registrar pago

### 8.4 Reportes

- `GET /api/reports/account-statement` - Estado de cuenta
- `GET /api/reports/payments-detail` - Detalle de pagos
- `GET /api/reports/receipt` - Generar recibo

### 8.5 Móvil

- `GET /api/mobile/sync` - Sincronizar cartera
- `GET /api/mobile/status` - Estado de sincronización
- `POST /api/mobile/payments` - Registrar pagos offline
- `POST /api/mobile/receipt` - Generar recibo

### 8.6 Salud

- `GET /api/health` - Verificar conectividad
- `GET /api/version` - Versión de API

---

## 9. FLUJOS DE TRABAJO PRINCIPALES

### 9.1 Crear y Desembolsar un Crédito

```
1. OPERATIVO crea solicitud (estado: Pending)
   ↓
2. GERENTE/ADMIN aprueba (estado: Approved)
   ↓
3. OPERATIVO prepara desembolso
   ↓
4. ADMIN/GERENTE confirma desembolso (estado: Active)
   ↓
5. Plan de pagos se genera automáticamente
   ↓
6. GESTOR comienza a cobrar
```

### 9.2 Registrar un Pago

```
1. GESTOR registra pago en campo o en oficina
   ↓
2. Sistema calcula nuevo saldo
   ↓
3. Se genera recibo (impresión térmica)
   ↓
4. Pago se registra en auditoría
   ↓
5. Dashboard se actualiza en tiempo real
```

### 9.3 Anular un Pago

```
1. GESTOR/GERENTE solicita anulación
   ↓
2. ADMIN aprueba anulación
   ↓
3. Pago se marca como ANULADO
   ↓
4. Saldo se recalcula
   ↓
5. Se registra en auditoría
```

### 9.4 Agregar Feriado

```
1. ADMIN agrega feriado
   ↓
2. Sistema identifica créditos ACTIVOS
   ↓
3. Para cada crédito, regenera plan de pagos
   ↓
4. Fechas se actualizan en base de datos
   ↓
5. Se registra en auditoría
```

---

## 10. TECNOLOGÍAS Y ARQUITECTURA

### 10.1 Stack Tecnológico

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Shadcn/ui
- React Hook Form
- Zustand (estado global)

**Backend:**
- Next.js API Routes
- Node.js
- MySQL 8.0
- JWT (autenticación)
- bcryptjs (encriptación)

**Herramientas:**
- date-fns (manejo de fechas)
- date-fns-tz (zonas horarias)
- Zod (validación)
- xlsx (exportación Excel)
- pdf-lib (generación PDF)

### 10.2 Arquitectura

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación
│   ├── api/               # API Routes
│   ├── clients/           # Módulo de clientes
│   ├── credits/           # Módulo de créditos
│   ├── dashboard/         # Panel principal
│   ├── reports/           # Reportería
│   └── settings/          # Configuración
├── components/            # Componentes React
├── lib/                   # Utilidades y configuraciones
├── services/              # Lógica de negocio
└── types/                 # Definiciones de tipos
```

### 10.3 Patrones de Diseño

- **Server Actions:** Para operaciones del servidor
- **Service Layer:** Lógica de negocio centralizada
- **Type Safety:** TypeScript en todo el proyecto
- **Validation:** Zod para validación de datos
- **Error Handling:** Respuestas estructuradas con códigos de error

---

## 11. CONSIDERACIONES IMPORTANTES

### 11.1 Zona Horaria

- **Zona:** America/Managua (UTC-6)
- **Conversión:** Las fechas se almacenan en UTC en MySQL
- **Visualización:** Se convierten a hora local para mostrar al usuario
- **Entrada:** Las fechas del usuario se asumen como hora local

### 11.2 Cédulas

- **Formato:** 000-000000-0000A
- **Almacenamiento:** Codificadas en Base64
- **Validación:** Regex en frontend y backend

### 11.3 Moneda

- **Moneda principal:** Córdobas (C$)
- **Moneda secundaria:** Dólares (USD)
- **Tipo de cambio:** Configurable en arqueos

### 11.4 Límites

- **Monto mínimo de crédito:** C$1,000
- **Monto máximo de crédito:** C$1,000,000
- **Tasa mínima:** 1% mensual
- **Tasa máxima:** 50% mensual
- **Plazo mínimo:** 0.5 meses
- **Plazo máximo:** 60 meses

---

## 12. PRÓXIMAS MEJORAS

- [ ] Notificaciones push
- [ ] Integración con SMS
- [ ] Reportes avanzados con gráficos
- [ ] Sincronización en tiempo real
- [ ] Integración con sistemas bancarios
- [ ] Análisis predictivo de mora
- [ ] Automatización de cobranza

