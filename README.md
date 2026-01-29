# CrediNica - Sistema de Gestión de Microcréditos

<div align="center">
  <img src="public/CrediNica.png" alt="CrediNica Logo" width="200"/>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
  [![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?style=flat-square&logo=mysql)](https://www.mysql.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
</div>

## 📋 Descripción

CrediNica es un sistema integral de gestión de microcréditos desarrollado específicamente para instituciones financieras en Nicaragua. Permite la administración completa del ciclo de vida de los créditos, desde la solicitud hasta el pago final, con funcionalidades avanzadas de reportería y control.

## ✨ Características Principales

### 🏦 Gestión de Créditos
- **Solicitud y Aprobación**: Flujo completo de solicitud de créditos con validaciones automáticas
- **Planes de Pago**: Generación automática de cronogramas de pago (diario, semanal, quincenal, catorcenal)
- **Cálculo de Intereses**: Sistema avanzado de cálculo de intereses y mora
- **Estados de Crédito**: Seguimiento completo del estado de cada crédito (Activo, Pagado, Vencido, Rechazado)

### 👥 Gestión de Clientes
- **Registro Completo**: Información personal, contacto, ubicación geográfica y garantías
- **Historial Crediticio**: Seguimiento completo del historial de cada cliente
- **Validaciones**: Sistema de validación de cédulas y datos personales
- **Geolocalización**: Integración con departamentos y municipios de Nicaragua

### 💰 Gestión de Pagos
- **Registro de Pagos**: Sistema completo de registro y validación de pagos
- **Recibos**: Generación automática de recibos para impresoras térmicas
- **Control de Mora**: Cálculo automático de días de atraso y montos en mora
- **Historial**: Seguimiento detallado de todos los pagos realizados

### 📊 Reportería Avanzada
- **Estados de Cuenta**: Reportes detallados por cliente y crédito
- **Cartera**: Análisis completo de la cartera de créditos
- **Cobranza**: Reportes de gestión de cobranza y recuperación
- **Arqueos**: Control de cierres de caja y billetaje
- **Provisiones**: Cálculos de provisiones según normativas

### 🔐 Seguridad y Control
- **Roles de Usuario**: Sistema de roles (Administrador, Finanzas, Gestor, Operativo)
- **Auditoría**: Registro completo de todas las operaciones del sistema
- **Control de Acceso**: Restricciones por sucursal y horarios
- **Autenticación**: Sistema seguro de login con encriptación

### 📱 Funcionalidades Móviles
- **PWA**: Aplicación web progresiva para uso móvil
- **Modo Offline**: Funcionalidad limitada sin conexión a internet
- **Sincronización**: Sincronización automática cuando se recupera la conexión
- **Impresión Bluetooth**: Soporte para impresoras térmicas portátiles

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Next.js 14**: Framework de React con App Router
- **TypeScript**: Tipado estático para mayor seguridad
- **Tailwind CSS**: Framework de CSS utilitario
- **Shadcn/ui**: Componentes de UI modernos y accesibles
- **React Hook Form**: Manejo eficiente de formularios
- **Zustand**: Gestión de estado global

### Backend
- **Next.js API Routes**: API RESTful integrada
- **MySQL**: Base de datos relacional
- **JWT**: Autenticación basada en tokens
- **bcryptjs**: Encriptación de contraseñas
- **Node.js**: Runtime de JavaScript

### Herramientas de Desarrollo
- **ESLint**: Linting de código
- **Prettier**: Formateo de código
- **Vercel**: Plataforma de despliegue

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- MySQL 8.0+
- npm o yarn

### 1. Clonar el Repositorio
```bash
git clone https://github.com/harwin221/Credinic-migracion-.git
cd Credinic-migracion-
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crear archivo `.env.local`:
```env
# Base de Datos
NEW_DB_HOST=localhost
NEW_DB_USER=root
NEW_DB_PASSWORD=tu_contraseña
NEW_DB_DATABASE=credinica

# JWT Secret
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura

# Configuración de la Aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Configurar Base de Datos
```bash
# Crear la base de datos
mysql -u root -p -e "CREATE DATABASE credinica;"

# Importar esquema (si tienes un archivo SQL)
mysql -u root -p credinica < database/schema.sql
```

### 5. Ejecutar Migración (si vienes de sistema anterior)
```bash
# Configurar variables de migración en .env
OLD_DB_HOST=host_sistema_anterior
OLD_DB_USER=usuario_anterior
OLD_DB_PASSWORD=contraseña_anterior
OLD_DB_DATABASE=base_datos_anterior

# Ejecutar migración completa
node migration-scripts/complete-system-migration.js
```

### 6. Iniciar Aplicación
```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 📁 Estructura del Proyecto

```
credinica/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── (auth)/            # Rutas de autenticación
│   │   ├── api/               # API Routes
│   │   ├── clients/           # Gestión de clientes
│   │   ├── credits/           # Gestión de créditos
│   │   ├── dashboard/         # Panel principal
│   │   ├── reports/           # Reportería
│   │   └── settings/          # Configuraciones
│   ├── components/            # Componentes reutilizables
│   │   ├── ui/               # Componentes base de UI
│   │   └── clients/          # Componentes específicos
│   ├── lib/                  # Utilidades y configuraciones
│   ├── services/             # Servicios de negocio
│   └── types/                # Definiciones de tipos
├── migration-scripts/         # Scripts de migración
├── public/                   # Archivos estáticos
└── docs/                     # Documentación
```

## 🔧 Scripts de Migración

El sistema incluye un script maestro de migración que permite migrar desde sistemas anteriores:

### Script Principal
- `complete-system-migration.js`: Migración completa del sistema

### Características de la Migración
- **Migración por Fases**: Usuarios → Clientes → Créditos → Pagos
- **Generación de Planes**: Crea automáticamente planes de pago
- **Corrección de Datos**: Mapea gestores reales en pagos
- **Verificación de Salud**: Valida integridad de datos
- **Modo Simulación**: Permite probar antes de ejecutar

## 📊 Funcionalidades del Sistema

### Dashboard
- Resumen ejecutivo de la cartera
- Métricas de desempeño
- Alertas y notificaciones
- Búsqueda rápida de créditos

### Gestión de Clientes
- Registro con validación de cédula
- Información de garantías
- Historial crediticio completo
- Geolocalización por departamento/municipio

### Gestión de Créditos
- Calculadora de créditos
- Aprobación con flujo de trabajo
- Planes de pago automáticos
- Seguimiento de estado y mora

### Reportería
- Estados de cuenta individuales
- Reportes de cartera consolidada
- Análisis de cobranza
- Reportes de provisiones
- Exportación a PDF/Excel

### Configuraciones
- Gestión de usuarios y roles
- Configuración de sucursales
- Días feriados
- Control de acceso

## 🔐 Seguridad

- **Autenticación JWT**: Tokens seguros con expiración
- **Encriptación**: Contraseñas encriptadas con bcrypt
- **Roles y Permisos**: Control granular de acceso
- **Auditoría**: Registro de todas las operaciones
- **Validaciones**: Validación de datos en frontend y backend

## 📱 PWA (Progressive Web App)

- **Instalable**: Se puede instalar como app nativa
- **Offline**: Funcionalidad básica sin conexión
- **Responsive**: Adaptado para móviles y tablets
- **Push Notifications**: Notificaciones push (futuro)

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto es propiedad de CrediNica. Todos los derechos reservados.

## 📞 Soporte

Para soporte técnico o consultas:
- Email: harwinrueda221@gmail.com
- Teléfono: +505 5756-7451

## 🔄 Changelog

### v1.0.0 (2026-01-29)
- ✅ Sistema completo de gestión de microcréditos
- ✅ Migración desde sistema anterior
- ✅ Reportería avanzada
- ✅ PWA con funcionalidad offline
- ✅ Sistema de roles y permisos
- ✅ Integración con impresoras térmicas

---

<div align="center">
  <p>Desarrollado con ❤️ por Harwin Rueda Herrera para CrediNica</p>
  <p>© 2026 CrediNica. Todos los derechos reservados.</p>
</div>
