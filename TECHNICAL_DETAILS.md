# Detalles Técnicos del Sistema CrediNica

## 1. SERVICIOS PRINCIPALES

### 1.1 credit-service-server.ts

**Funciones principales:**

- `addCredit()` - Crear nuevo crédito
  - Valida datos de entrada
  - Verifica existencia de cliente y gestor
  - Genera número de crédito secuencial
  - Obtiene feriados para ajustar fechas
  - Genera plan de pagos automático
  - Inserta crédito, garantías y fiadores
  - Registra en auditoría

- `getCredit()` - Obtener detalles de un crédito
  - Recupera datos del crédito
  - Obtiene plan de pagos
  - Obtiene pagos registrados
  - Calcula estado actual

- `getCreditsAdmin()` - Listar créditos (admin)
  - Acceso a todos los créditos
  - Filtrado por estado, cliente, gestor
  - Paginación

- `getCreditsForGestor()` - Listar créditos del gestor
  - Solo créditos asignados al gestor
  - Cálculo de estado para cada uno

- `registerPayment()` - Registrar pago
  - Valida monto y fecha
  - Inserta pago en tabla payments_registered
  - Recalcula estado del crédito
  - Genera recibo

- `voidPaymentRequest()` - Solicitar anulación
  - Marca pago como ANULACION_PENDIENTE
  - Registra razón de anulación
  - Notifica a administrador

- `approveVoidPayment()` - Aprobar anulación
  - Marca pago como ANULADO
  - Recalcula estado del crédito
  - Registra en auditoría

### 1.2 client-service-server.ts

**Funciones principales:**

- `createClient()` - Crear cliente
  - Genera número de cliente secuencial
  - Codifica cédula en Base64
  - Inserta datos principales
  - Inserta información laboral (asalariado/comerciante)
  - Inserta referencias personales
  - Registra en auditoría

- `updateClient()` - Actualizar cliente
  - Valida permisos (solo su sucursal si no es admin)
  - Actualiza datos principales
  - Actualiza información laboral
  - Actualiza referencias
  - Registra cambios en auditoría

- `getClient()` - Obtener cliente
  - Recupera datos del cliente
  - Decodifica cédula
  - Obtiene referencias
  - Obtiene información laboral

- `getClients()` - Listar clientes
  - Filtrado por sucursal (si no es admin)
  - Búsqueda por nombre/cédula
  - Paginación

### 1.3 payment-plan-service.ts

**Funciones principales:**

- `updatePaymentPlanDates()` - Editar fechas del plan
  - Solo administradores
  - Actualiza fechas de cuotas
  - Registra cambios en auditoría

- `getPaymentPlan()` - Obtener plan de pagos
  - Recupera todas las cuotas
  - Convierte fechas a ISO

### 1.4 holiday-service.ts

**Funciones principales:**

- `getHolidays()` - Listar feriados
  - Retorna todos los feriados ordenados

- `addHoliday()` - Agregar feriado
  - Inserta nuevo feriado
  - Sincroniza planes de pago
  - Registra en auditoría

- `deleteHoliday()` - Eliminar feriado
  - Elimina feriado
  - Sincroniza planes de pago
  - Registra en auditoría

- `synchronizeAllPaymentPlans()` - Sincronizar planes
  - Obtiene todos los créditos activos
  - Regenera plan de pagos para cada uno
  - Actualiza fechas en base de datos
  - Registra en auditoría

- `ensurePaymentPlanExists()` - Asegurar que existe plan
  - Verifica si crédito tiene plan
  - Si no existe, lo genera
  - Útil para créditos antiguos

### 1.5 report-service.ts

**Funciones principales:**

- `generateSaldosCarteraReport()` - Saldos de cartera
  - Agrupa por sucursal y gestor
  - Calcula saldo pendiente
  - Filtra por rango de fechas

- `generateColocacionVsRecuperacionReport()` - Colocación vs Recuperación
  - Suma desembolsos por gestor
  - Suma cobros por gestor
  - Calcula diferencia

- `generatePercentPaidReport()` - Porcentaje pagado
  - Calcula % de pago para cada crédito
  - Agrupa por cliente/gestor

- `generateNonRenewedReport()` - Cancelados y no renovados
  - Identifica créditos pagados
  - Verifica si hay renovación
  - Filtra no renovados

- `generateProvisioningReport()` - Provisiones
  - Calcula categoría de riesgo
  - Aplica tasa de provisión
  - Suma por categoría

- `generateOverdueCreditsReport()` - Cartera en mora
  - Identifica créditos con atraso
  - Calcula días de atraso
  - Agrupa por gestor

- `generateExpiredCreditsReport()` - Créditos vencidos
  - Identifica créditos vencidos
  - Calcula saldo pendiente
  - Filtra por rango de fechas

- `generateConsolidatedStatement()` - Estado consolidado
  - Agrupa múltiples créditos de un cliente
  - Calcula totales
  - Genera resumen

- `generateDisbursementsReport()` - Desembolsos
  - Lista créditos desembolsados
  - Agrupa por gestor/sucursal
  - Filtra por rango de fechas

- `generatePaymentsDetailReport()` - Detalle de pagos
  - Lista todos los pagos registrados
  - Agrupa por gestor/sucursal
  - Filtra por rango de fechas

- `generateRecoveryReport()` - Meta cobranza
  - Calcula cobros vs meta
  - Agrupa por gestor
  - Filtra por rango de fechas

- `generateFutureInstallmentsReport()` - Cuotas futuras
  - Identifica cuotas próximas a vencer
  - Agrupa por cliente/gestor
  - Filtra por rango de fechas

- `generateRejectionAnalysisReport()` - Análisis de rechazos
  - Lista solicitudes rechazadas
  - Agrupa por razón de rechazo
  - Filtra por rango de fechas

### 1.6 user-service-server.ts

**Funciones principales:**

- `createUserService()` - Crear usuario
  - Valida datos de entrada
  - Genera username único
  - Encripta contraseña con bcrypt
  - Inserta en base de datos
  - Registra en auditoría

- `updateUserService()` - Actualizar usuario
  - Actualiza datos del usuario
  - Puede cambiar rol y sucursal
  - Registra cambios en auditoría

- `updateUserPassword()` - Cambiar contraseña
  - Encripta nueva contraseña
  - Actualiza en base de datos
  - Registra en auditoría

- `resetUserPassword()` - Resetear contraseña
  - Marca usuario para cambiar contraseña
  - Genera contraseña temporal
  - Registra en auditoría

- `getUsers()` - Listar usuarios
  - Filtra por rol si es necesario
  - Retorna usuarios activos

- `getUser()` - Obtener usuario
  - Recupera datos del usuario
  - Incluye información de sucursal

- `getUserByName()` - Buscar por nombre
  - Búsqueda exacta por nombre completo

### 1.7 audit-log-service.ts

**Funciones principales:**

- `createLog()` - Crear registro de auditoría
  - Registra acción realizada
  - Incluye usuario, timestamp, detalles
  - Almacena cambios realizados

- `getLogs()` - Obtener registros
  - Filtra por usuario, acción, fecha
  - Paginación
  - Ordenamiento por fecha descendente

---

## 2. UTILIDADES PRINCIPALES (lib/utils.ts)

### 2.1 Funciones de Formato

- `formatCedula()` - Formatea cédula a 000-000000-0000A
- `formatPhone()` - Formatea teléfono a 0000-0000
- `formatCurrency()` - Formatea moneda a C$0.00
- `formatDateForUser()` - Formatea fecha para mostrar
- `formatDateTimeForUser()` - Formatea fecha y hora

### 2.2 Funciones de Codificación

- `encodeData()` - Codifica en Base64
- `decodeData()` - Decodifica Base64
- `normalizeString()` - Normaliza string (sin acentos, minúsculas)

### 2.3 Funciones de Cálculo

- `generatePaymentSchedule()` - Genera plan de pagos
  - Calcula número de cuotas según frecuencia
  - Calcula interés total
  - Genera cada cuota con fecha ajustada
  - Retorna plan completo

- `adjustToNextBusinessDay()` - Ajusta fecha a día hábil
  - Evita domingos
  - Evita sábados según frecuencia
  - Evita feriados
  - Aplica reglas específicas por tipo de crédito

- `calculateCreditStatusDetails()` - Calcula estado del crédito
  - Calcula saldo pendiente
  - Calcula monto en mora
  - Calcula días de atraso
  - Determina categoría de riesgo
  - Retorna estado completo

- `generateFullStatement()` - Genera estado de cuenta
  - Procesa cada cuota
  - Procesa cada pago
  - Calcula totales
  - Retorna estado detallado

- `getProvisionCategory()` - Obtiene categoría de provisión
  - Basada en días de atraso
  - Retorna categoría A-E

### 2.4 Funciones de Recibos

- `generateReceiptText()` - Genera texto de recibo
  - Formatea para impresora térmica
  - Incluye datos del crédito y pago
  - Calcula saldos
  - Retorna texto formateado

---

## 3. FUNCIONES DE FECHA (lib/date-utils.ts)

### 3.1 Conversiones

- `toISOString()` - Convierte cualquier fecha a ISO
- `toNicaraguaTime()` - Convierte UTC a hora Nicaragua
- `fromNicaraguaTime()` - Convierte hora Nicaragua a UTC
- `userInputToISO()` - Convierte entrada del usuario a ISO
- `isoToMySQLDateTime()` - Convierte ISO a formato MySQL
- `isoToMySQLDate()` - Convierte ISO a fecha MySQL
- `isoToMySQLDateTimeNoon()` - Convierte ISO a MySQL con mediodía

### 3.2 Obtención de Fechas

- `nowInNicaragua()` - Obtiene hora actual en Nicaragua
- `todayInNicaragua()` - Obtiene fecha actual en Nicaragua
- `nowInNicaraguaFormatted()` - Obtiene fecha/hora formateada

### 3.3 Validación

- `isValidISODate()` - Valida si es fecha ISO válida
- `formatDateForUser()` - Formatea para mostrar al usuario

---

## 4. VALIDACIÓN (lib/validation-schemas.ts)

### 4.1 Esquemas Base

- `EmailSchema` - Valida email
- `PhoneSchema` - Valida teléfono (8 dígitos)
- `CedulaSchema` - Valida cédula (000-000000-0000A)
- `PositiveNumberSchema` - Valida número positivo
- `NonEmptyStringSchema` - Valida string no vacío

### 4.2 Esquemas de Usuario

- `CreateUserSchema` - Validación para crear usuario
- `UpdateUserSchema` - Validación para actualizar usuario
- `ChangePasswordSchema` - Validación para cambiar contraseña
- `LoginSchema` - Validación para login

### 4.3 Esquemas de Cliente

- `PersonalReferenceSchema` - Validación de referencia
- `AsalariadoInfoSchema` - Validación de info laboral
- `ComercianteInfoSchema` - Validación de info comercial
- `CreateClientSchema` - Validación para crear cliente
- `UpdateClientSchema` - Validación para actualizar cliente

### 4.4 Esquemas de Crédito

- `GuaranteeSchema` - Validación de garantía
- `GuarantorSchema` - Validación de fiador
- `CreateCreditSchema` - Validación para crear crédito
- `UpdateCreditSchema` - Validación para actualizar crédito

### 4.5 Esquemas de Pago

- `CreatePaymentSchema` - Validación para registrar pago

### 4.6 Esquemas de Configuración

- `CreateSucursalSchema` - Validación para crear sucursal
- `UpdateSucursalSchema` - Validación para actualizar sucursal
- `CreateClosureSchema` - Validación para cierre de caja

---

## 5. CONSTANTES (lib/constants.ts)

### 5.1 Configuración

- `TIMEZONE` - Zona horaria (America/Managua)
- `MANAGEMENT_ROLES` - Roles de gestión (GESTOR, GERENTE)

### 5.2 Navegación

- `NAV_ITEMS` - Items del menú principal
- `reportList` - Lista de reportes disponibles

### 5.3 Permisos

- `rolePermissions` - Matriz de permisos por rol
- `USER_ROLES` - Lista de roles disponibles

---

## 6. TIPOS (lib/types.ts)

### 6.1 Enumeraciones

- `USER_ROLES` - Roles de usuario
- `PaymentFrequency` - Periodicidades de pago
- `CreditStatus` - Estados de crédito

### 6.2 Interfaces Principales

- `AppUser` - Usuario de la aplicación
- `Client` - Cliente
- `CreditDetail` - Detalle de crédito
- `Payment` - Cuota del plan
- `RegisteredPayment` - Pago registrado
- `CreditStatusDetails` - Estado del crédito
- `Holiday` - Feriado
- `Sucursal` - Sucursal
- `AuditLog` - Registro de auditoría
- `CashClosure` - Cierre de caja

### 6.3 Interfaces de Reportes

- `SaldosCarteraItem` - Item de saldos
- `PercentPaidItem` - Item de porcentaje pagado
- `ExpiredCreditItem` - Item de crédito vencido
- `ProvisionCredit` - Item de provisión
- `RejectionAnalysisItem` - Item de análisis de rechazo

---

## 7. MIDDLEWARE Y AUTENTICACIÓN

### 7.1 Middleware (src/middleware.ts)

- Valida sesión en rutas protegidas
- Redirige a login si no hay sesión
- Permite acceso a rutas públicas (/login, /setup)
- Excluye rutas de API y archivos estáticos

### 7.2 Autenticación (src/app/(auth)/login/actions.ts)

- `loginUser()` - Autentica usuario
  - Valida credenciales
  - Compara contraseña con hash bcrypt
  - Verifica control de acceso
  - Genera JWT
  - Almacena en cookie httpOnly

- `getSession()` - Obtiene sesión actual
  - Lee cookie de sesión
  - Desencripta JWT
  - Valida usuario en base de datos
  - Verifica control de acceso

- `logoutUser()` - Cierra sesión
  - Invalida cookie de sesión

- `encrypt()` - Encripta JWT
  - Usa HS256
  - Expiración de 24 horas

- `decrypt()` - Desencripta JWT
  - Valida firma
  - Retorna payload

---

## 8. MANEJO DE ERRORES

### 8.1 Clases de Error (lib/service-response.ts)

- `ServiceError` - Error genérico de servicio
- `NotFoundError` - Recurso no encontrado
- `AuthorizationError` - Acceso denegado
- `BusinessLogicError` - Violación de regla de negocio
- `ValidationError` - Error de validación

### 8.2 Respuestas de Servicio

- `ServiceResponse<T>` - Respuesta genérica
  - `success: boolean`
  - `data?: T`
  - `error?: string`
  - `code?: string`

- `createSuccessResponse()` - Crea respuesta exitosa
- `createErrorResponse()` - Crea respuesta de error
- `withErrorHandling()` - Wrapper para manejo de errores

---

## 9. GENERACIÓN DE IDs

### 9.1 Funciones (lib/id-generator.ts)

- `generateId()` - Genera ID con prefijo
  - Formato: `{prefijo}_{timestamp}_{random}`
  - Ejemplos: `usr_1234567890_abc123`, `crd_1234567890_def456`

- `generateClientId()` - Genera ID de cliente
- `generateCreditId()` - Genera ID de crédito
- `generateGuaranteeId()` - Genera ID de garantía
- `generateGuarantorId()` - Genera ID de fiador
- `generatePaymentId()` - Genera ID de pago

### 9.2 Secuencias

- `getNextSequenceValue()` - Obtiene siguiente valor secuencial
  - Usado para números de cliente, crédito, etc.
  - Almacenado en tabla `sequences`

---

## 10. COMPONENTES PRINCIPALES

### 10.1 Componentes de UI (src/components/ui/)

- `button.tsx` - Botón
- `input.tsx` - Input de texto
- `select.tsx` - Select/dropdown
- `dialog.tsx` - Modal
- `table.tsx` - Tabla
- `form.tsx` - Formulario
- `card.tsx` - Tarjeta
- `tabs.tsx` - Pestañas
- `date-input.tsx` - Input de fecha
- `geography-select.tsx` - Select de geografía

### 10.2 Componentes de Negocio

- `ClientForm.tsx` - Formulario de cliente
- `ClientDetailView.tsx` - Vista de detalle de cliente
- `CreditForm.tsx` - Formulario de crédito
- `PaymentForm.tsx` - Formulario de pago
- `ReportTable.tsx` - Tabla de reportes

### 10.3 Componentes de Layout

- `SidebarLayout.tsx` - Layout con sidebar
- `AppNavigation.tsx` - Navegación principal
- `PageHeader.tsx` - Encabezado de página
- `UserProfile.tsx` - Perfil de usuario

---

## 11. HOOKS PERSONALIZADOS

### 11.1 Hooks (src/hooks/)

- `use-user.tsx` - Obtiene usuario actual
- `use-toast.ts` - Notificaciones toast
- `use-mobile.tsx` - Detecta dispositivo móvil
- `use-online-status.tsx` - Detecta estado online
- `use-date-input.ts` - Manejo de input de fecha
- `use-is-client.ts` - Detecta si está en cliente

---

## 12. OFFLINE Y PWA

### 12.1 Funcionalidades Offline

- `offline-db.ts` - Base de datos local (IndexedDB)
- `offline-sync.ts` - Sincronización de datos
- `hybrid-data.ts` - Datos híbridos (local + servidor)

### 12.2 PWA

- `manifest.json` - Configuración de PWA
- `sw.js` - Service Worker
- `PWAInstallPrompt.tsx` - Prompt de instalación
- `PWAStatus.tsx` - Estado de PWA

---

## 13. IMPRESIÓN Y REPORTES

### 13.1 Servicios de Impresión

- `printer-service.ts` - Servicio de impresión
  - Soporte para impresoras térmicas
  - Generación de recibos
  - Generación de pagarés

### 13.2 Servicios de PDF

- `receipt-html.ts` - HTML de recibo
- `promissory-note-pdf.ts` - PDF de pagaré

### 13.3 Exportación

- Exportación a Excel
- Exportación a PDF
- Generación de reportes

---

## 14. CONFIGURACIÓN DEL PROYECTO

### 14.1 next.config.js

- Configuración de Next.js
- PWA habilitado
- Optimizaciones de imagen

### 14.2 tailwind.config.ts

- Configuración de Tailwind CSS
- Temas personalizados
- Extensiones de colores

### 14.3 tsconfig.json

- Configuración de TypeScript
- Paths alias
- Strict mode habilitado

### 14.4 .env

```
# Base de Datos
NEW_DB_HOST=localhost
NEW_DB_USER=root
NEW_DB_PASSWORD=contraseña
NEW_DB_DATABASE=credinica

# JWT
JWT_SECRET=clave_secreta_muy_larga_y_segura

# Aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 15. SCRIPTS DISPONIBLES

```bash
npm run dev              # Inicia servidor de desarrollo
npm run build            # Compila para producción
npm start                # Inicia servidor de producción
npm run lint             # Ejecuta linter
npm run create-admin     # Crea usuario administrador
npm run update-admin-username  # Actualiza username de admin
npm run inspect-users-table    # Inspecciona tabla de usuarios
npm run update-db-schema       # Ejecuta scripts SQL
```

---

## 16. ESTRUCTURA DE CARPETAS

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   └── layout.tsx
│   ├── api/
│   │   ├── clients/
│   │   ├── credits/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── me/
│   │   ├── reports/
│   │   └── ...
│   ├── clients/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   ├── new/
│   │   ├── components/
│   │   └── actions.ts
│   ├── credits/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   ├── new/
│   │   ├── components/
│   │   └── actions.ts
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/
│   ├── reports/
│   │   ├── page.tsx
│   │   ├── saldos-cartera/
│   │   ├── account-statement/
│   │   └── ...
│   ├── settings/
│   │   ├── page.tsx
│   │   ├── users/
│   │   ├── holidays/
│   │   ├── sucursales/
│   │   └── access-control/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── clients/
│   ├── dashboard/
│   ├── settings/
│   └── ...
├── lib/
│   ├── constants.ts
│   ├── types.ts
│   ├── utils.ts
│   ├── date-utils.ts
│   ├── validation-schemas.ts
│   ├── mysql.ts
│   ├── id-generator.ts
│   └── ...
├── services/
│   ├── credit-service-server.ts
│   ├── client-service-server.ts
│   ├── user-service-server.ts
│   ├── payment-plan-service.ts
│   ├── holiday-service.ts
│   ├── report-service.ts
│   ├── audit-log-service.ts
│   └── ...
├── types/
│   └── pdf.d.ts
├── hooks/
│   ├── use-user.tsx
│   ├── use-toast.ts
│   └── ...
├── docs/
│   └── logic-summary.ts
└── middleware.ts
```

