# Scripts de Migración CrediNica

Esta carpeta contiene el script maestro de migración y herramientas auxiliares para migrar desde sistemas anteriores al nuevo sistema CrediNica.

## 🚀 Script Principal

### `complete-system-migration.js`
**Script maestro que realiza la migración completa del sistema.**

**Funcionalidades:**
- ✅ Migración completa de usuarios, clientes, créditos y pagos
- ✅ Generación automática de planes de pago
- ✅ Creación de usuario administrador
- ✅ Corrección de nombres de gestores en pagos
- ✅ Verificación de salud del sistema
- ✅ Modo simulación para pruebas seguras

**Uso:**
```bash
# Configurar variables de entorno en .env
OLD_DB_HOST=host_sistema_anterior
OLD_DB_USER=usuario_anterior
OLD_DB_PASSWORD=contraseña_anterior
OLD_DB_DATABASE=base_datos_anterior

NEW_DB_HOST=localhost
NEW_DB_USER=root
NEW_DB_PASSWORD=tu_contraseña
NEW_DB_DATABASE=credinica

# Ejecutar migración completa
node migration-scripts/complete-system-migration.js
```

## 🔧 Herramientas Auxiliares

### `database-health-check.js`
Verificación completa de salud de la base de datos.

### `credinica-toolkit.js`
Herramientas de mantenimiento y utilidades del sistema.

## ⚙️ Configuración

### Variables de Entorno Requeridas
```env
# Base de Datos Antigua (Origen)
OLD_DB_HOST=tu_host_antiguo
OLD_DB_USER=tu_usuario_antiguo
OLD_DB_PASSWORD=tu_contraseña_antigua
OLD_DB_DATABASE=tu_base_de_datos_antigua

# Base de Datos Nueva (Destino)
NEW_DB_HOST=tu_host_nuevo
NEW_DB_USER=tu_usuario_nuevo
NEW_DB_PASSWORD=tu_contraseña_nueva
NEW_DB_DATABASE=tu_base_de_datos_nueva
```

## 🛡️ Modo Simulación

El script principal incluye un modo de simulación que permite probar la migración sin realizar cambios reales:

```javascript
// En complete-system-migration.js
const SIMULATION_MODE = true;  // true = solo simula, false = ejecuta cambios
```

## 📊 Proceso de Migración

### Fase 1: Preparación
- Verificación de esquema de base de datos
- Creación de columnas `legacyId` si no existen
- Limpieza de tablas de destino

### Fase 2: Migración de Datos
1. **Usuarios y Clientes**: Migra usuarios del sistema y clientes
2. **Créditos**: Migra créditos con generación automática de planes de pago
3. **Pagos**: Migra pagos con corrección de nombres de gestores
4. **Usuario Admin**: Crea/actualiza usuario administrador

### Fase 3: Verificación
- Verificación de integridad referencial
- Conteo de registros migrados
- Detección de problemas potenciales

## 🔍 Verificaciones de Salud

El script incluye verificaciones automáticas:
- ✅ Créditos huérfanos (sin cliente)
- ✅ Pagos huérfanos (sin crédito)
- ✅ Usuarios sin contraseña
- ✅ Existencia de administradores
- ✅ Integridad de datos geográficos

## 📋 Mapeo de Datos

### Roles de Usuario
- `1` → `ADMINISTRADOR`
- `2` → `FINANZAS`
- `4` → `GESTOR`

### Estados de Crédito
- `1` → `Active`
- `2` → `Paid`
- `3` → `Expired`
- `4` → `Rejected`

### Frecuencia de Pago
- `1` → `Diario`
- `2` → `Semanal`
- `3` → `Quincenal`
- `4` → `Catorcenal`

### Estado Civil
- `0` → `Soltero`
- `1` → `Casado`
- `2` → `Union Libre`
- `3` → `Viudo(a)`
- `4` → `Divorciado`

## 🚨 Características de Seguridad

### Transacciones Atómicas
- Toda la migración se ejecuta en una sola transacción
- Si hay error, se revierten todos los cambios automáticamente
- La base de datos queda intacta en caso de fallo

### Proceso Idempotente
- Se puede ejecutar múltiples veces sin duplicar datos
- Limpia tablas de destino antes de cada ejecución
- Garantiza migración fresca en cada ejecución

### Manejo de Errores
- Continúa la migración aunque encuentre datos inválidos
- Registra y reporta problemas encontrados
- No se detiene por registros individuales problemáticos

## 📈 Resultados Esperados

Después de una migración exitosa:
- ✅ Todos los usuarios migrados con username y email
- ✅ Todos los clientes con información geográfica
- ✅ Todos los créditos activos con planes de pago generados
- ✅ Todos los pagos con nombres reales de gestores
- ✅ Usuario administrador creado (username: admin, password: admin123)

## 🔧 Solución de Problemas

### Error de Conexión
```bash
Error: connect ECONNREFUSED
```
**Solución**: Verificar credenciales de base de datos en `.env`

### Error de Permisos
```bash
Error: Access denied for user
```
**Solución**: Verificar permisos de usuario en MySQL

### Datos Faltantes
```bash
[AVISO] Omitiendo registro...
```
**Solución**: Normal, el script omite registros inválidos y continúa

## 📞 Soporte

Para problemas con la migración:
1. Revisar logs de consola
2. Verificar variables de entorno
3. Ejecutar en modo simulación primero
4. Contactar soporte técnico si persisten problemas

---

**Nota**: Siempre hacer backup de la base de datos antes de ejecutar la migración en producción.