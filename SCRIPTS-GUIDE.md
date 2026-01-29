# 🛠️ GUÍA DE SCRIPTS - SISTEMA CREDINICA

## 🚀 ACCESO RÁPIDO

### Comando Principal (MÁS FÁCIL):
```bash
# Desde la raíz del proyecto
node credinica.js [comando]
```

### Ejemplos Rápidos:
```bash
# Ver estado del sistema
node credinica.js diagnose

# Arreglar todos los problemas
node credinica.js fix-all

# Crear nuevo usuario
node credinica.js create-user "Juan Pérez" juan OPERATIVO

# Ver ayuda completa
node credinica.js help
```

## 📁 ORGANIZACIÓN

```
📦 Proyecto CrediNica
├── 🚀 credinica.js                    ← ACCESO RÁPIDO (usar este)
├── 📁 migration-scripts/              ← Scripts organizados
│   ├── ⭐ credinica-toolkit.js        ← Script maestro
│   ├── 🔄 migration.js               ← Migración completa
│   ├── 👥 user-toolkit.js            ← Gestión de usuarios
│   ├── 📊 check-migration-status.js  ← Estado de migración
│   ├── 🏥 database-health-check.js   ← Salud de BD
│   └── 📖 README.md                  ← Documentación completa
└── 📁 src/                           ← Código de la aplicación
```

## 🎯 COMANDOS MÁS USADOS

### ⚡ Comandos Diarios:
```bash
# Diagnóstico rápido
node credinica.js diagnose

# Arreglar problemas
node credinica.js fix-all

# Crear usuario
node credinica.js create-user "Nombre" username ROL
```

### 🔧 Comandos de Mantenimiento:
```bash
# Estado completo de migración
node migration-scripts/check-migration-status.js

# Salud de la base de datos
node migration-scripts/database-health-check.js

# Verificar direcciones
node migration-scripts/check-addresses.js
```

## 📋 CREDENCIALES PRINCIPALES
- **Usuario:** `administrador`
- **Contraseña:** `password123`

## 🆘 SOLUCIÓN DE PROBLEMAS

### ❌ "Credenciales incorrectas" en login:
```bash
node credinica.js fix-admin
```

### ❌ Error al crear usuarios:
```bash
node credinica.js diagnose
node credinica.js fix-all
```

### ❌ Problemas generales:
```bash
# 1. Ver qué está mal
node credinica.js diagnose

# 2. Arreglar todo
node credinica.js fix-all

# 3. Verificar estado
node migration-scripts/check-migration-status.js
```

## 🎯 ROLES DE USUARIO
- **ADMINISTRADOR** - Acceso total
- **FINANZAS** - Gestión financiera
- **GESTOR** - Gestión de cartera
- **OPERATIVO** - Operaciones básicas

## 💡 CONSEJOS

1. **Siempre usar `node credinica.js diagnose` primero** para ver el estado
2. **Los scripts son seguros** - no borran datos, solo los arreglan
3. **Para acceso rápido** usar `node credinica.js` en lugar de rutas largas
4. **Documentación completa** en `migration-scripts/README.md`

---

**¡Sistema completamente organizado y listo para usar!** 🎉

**Recuerda:** `node credinica.js` es todo lo que necesitas recordar.