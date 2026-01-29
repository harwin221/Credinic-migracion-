# 📁 SCRIPTS DE MIGRACIÓN Y GESTIÓN - CREDINICA

Esta carpeta contiene todos los scripts necesarios para la migración y gestión del sistema CrediNica, organizados y listos para usar.

## 🌟 SCRIPT PRINCIPAL

### `credinica-toolkit.js` - **SCRIPT MAESTRO** ⭐
**Este es el único script que necesitas usar en el 99% de los casos**

```bash
# Diagnóstico completo del sistema
node migration-scripts/credinica-toolkit.js diagnose

# Arreglar todos los problemas automáticamente
node migration-scripts/credinica-toolkit.js fix-all

# Arreglar solo el usuario administrador
node migration-scripts/credinica-toolkit.js fix-admin

# Crear nuevo usuario rápido
node migration-scripts/credinica-toolkit.js create-user "María García" maria GESTOR

# Ver todos los usuarios
node migration-scripts/credinica-toolkit.js list-users

# Ver ayuda completa
node migration-scripts/credinica-toolkit.js help
```

## 📋 SCRIPTS ADICIONALES

### 🔄 **MIGRACIÓN DE DATOS**
- `migration.js` - Script principal de migración de BD antigua a nueva
- `check-migration-status.js` - Verificar estado de la migración completa

### 👥 **GESTIÓN AVANZADA DE USUARIOS**
- `user-toolkit.js` - Toolkit completo con modo interactivo
- `manage-users.js` - Script avanzado para operaciones específicas
- `reset-admin-password.js` - Resetear contraseña del administrador

### 🗺️ **VERIFICACIÓN DE DATOS**
- `check-addresses.js` - Verificar migración de direcciones y geografía
- `database-health-check.js` - Verificar salud general de la base de datos
- `populate-geo-data.js` - Poblar datos de geografía (departamentos/municipios)

## 🚀 COMANDOS MÁS USADOS

### ⚡ Comandos Rápidos (90% de los casos):
```bash
# Ver qué está mal
node migration-scripts/credinica-toolkit.js diagnose

# Arreglar todo
node migration-scripts/credinica-toolkit.js fix-all

# Crear usuario
node migration-scripts/credinica-toolkit.js create-user "Juan Pérez" juan OPERATIVO
```

### 🔍 Verificaciones Específicas:
```bash
# Estado de migración completa
node migration-scripts/check-migration-status.js

# Salud de la base de datos
node migration-scripts/database-health-check.js

# Verificar direcciones
node migration-scripts/check-addresses.js
```

### 🔧 Operaciones Avanzadas:
```bash
# Toolkit interactivo completo
node migration-scripts/user-toolkit.js

# Gestión específica de usuarios
node migration-scripts/manage-users.js list

# Migración completa desde cero
node migration-scripts/migration.js
```

## 📋 CREDENCIALES PRINCIPALES
- **Usuario:** `administrador`
- **Contraseña:** `password123`

## 💡 FLUJO RECOMENDADO

### 🆘 Para Problemas de Login:
```bash
node migration-scripts/credinica-toolkit.js fix-admin
```

### 🔧 Para Problemas Generales:
```bash
# 1. Ver qué está mal
node migration-scripts/credinica-toolkit.js diagnose

# 2. Arreglar todo
node migration-scripts/credinica-toolkit.js fix-all
```

### 👤 Para Crear Usuarios:
```bash
node migration-scripts/credinica-toolkit.js create-user "Nombre" username ROL
```

### 📊 Para Verificar Sistema:
```bash
node migration-scripts/check-migration-status.js
node migration-scripts/database-health-check.js
```

## 🎯 ROLES DISPONIBLES
- **ADMINISTRADOR** - Acceso total al sistema
- **FINANZAS** - Gestión financiera y reportes
- **GESTOR** - Gestión de cartera de clientes
- **OPERATIVO** - Operaciones básicas

## 🆘 COMANDOS DE EMERGENCIA

Si nada funciona, ejecutar en este orden:

```bash
# 1. Diagnóstico
node migration-scripts/credinica-toolkit.js diagnose

# 2. Reparación completa
node migration-scripts/credinica-toolkit.js fix-all

# 3. Verificar administrador
node migration-scripts/credinica-toolkit.js fix-admin

# 4. Verificar estado final
node migration-scripts/check-migration-status.js
```

---

## 📁 ORGANIZACIÓN DE ARCHIVOS

```
migration-scripts/
├── credinica-toolkit.js          ⭐ SCRIPT PRINCIPAL
├── migration.js                  🔄 Migración completa
├── user-toolkit.js               👥 Gestión de usuarios
├── manage-users.js               🔧 Operaciones avanzadas
├── check-migration-status.js     📊 Estado de migración
├── database-health-check.js      🏥 Salud de BD
├── check-addresses.js            🗺️ Verificar geografía
├── reset-admin-password.js       🔑 Reset admin
├── populate-geo-data.js          🌍 Datos de geografía
└── README.md                     📖 Esta documentación
```

**¡Todo organizado y listo para usar!** 🎉

**Recuerda:** En el 99% de los casos, solo necesitas `credinica-toolkit.js`