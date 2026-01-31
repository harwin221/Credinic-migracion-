# 🚀 MIGRACIÓN DE BASE DE DATOS - CREDINICA

Este directorio contiene los scripts para migrar la base de datos antigua a la nueva estructura con IDs bonitos y mejoras inteligentes.

## � ARCHIVOS INCLUIDOS

- `migration-fase1.js` - Migra usuarios y clientes con sucursales inteligentes
- `migration-fase2.js` - Migra créditos con decimales corregidos
- `migration-fase3.js` - Migra pagos en lotes para evitar timeouts
- `verificar-migracion.js` - Verifica el estado de la migración
- `README.md` - Este archivo de instrucciones

## ⚙️ CONFIGURACIÓN PREVIA

1. **Verificar archivo .env** en la raíz del proyecto con:
   ```
   OLD_DB_HOST=mysql.freehostia.com
   OLD_DB_USER=harrue0_baseantigua
   OLD_DB_PASSWORD=Hmrh.020790
   OLD_DB_DATABASE=harrue0_baseantigua

   NEW_DB_HOST=mysql.freehostia.com
   NEW_DB_USER=harrue9_credinica
   NEW_DB_PASSWORD=Hmrh.020790
   NEW_DB_DATABASE=harrue9_credinica
   ```

2. **Instalar dependencias** (si no están instaladas):
   ```bash
   npm install mysql2 dotenv
   ```

## 🎯 INSTRUCCIONES DE MIGRACIÓN

### IMPORTANTE: Ejecutar en orden estricto

```bash
# Navegar al directorio
cd migration-scripts

# FASE 1: Usuarios y Clientes
node migration-fase1.js

# FASE 2: Créditos
node migration-fase2.js

# FASE 3: Pagos
node migration-fase3.js

# Verificar resultado final
node verificar-migracion.js
```

## 📊 QUÉ HACE CADA FASE

### FASE 1: USUARIOS Y CLIENTES
- ✅ Limpia todas las tablas de destino
- ✅ Resetea contadores
- ✅ Crea sucursales: "Sucursal León" y "Sucursal Jinotepe"
- ✅ Migra usuarios del sistema (ADMINISTRADOR, FINANZAS, GESTOR)
- ✅ Migra clientes con **lógica inteligente de sucursales**:
  - Si dirección/departamento/municipio contiene "León" → Sucursal León
  - Todos los demás → Sucursal Jinotepe
- ✅ Genera IDs bonitos: `user_001`, `cli_001`, `CLI-0001`
- ✅ Guarda mapa de traducción para siguientes fases

### FASE 2: CRÉDITOS
- ✅ Migra créditos con IDs bonitos: `cred_001`, `CRE-00001`
- ✅ **Corrige decimales innecesarios**:
  - `3.00` → `3` (elimina .00)
  - `2.50` → `2.50` (preserva decimales reales)
- ✅ **FECHAS CORREGIDAS**: Fechas de día completo (primera cuota, vencimiento, entrega) se guardan con `12:00:00` para evitar problemas de zona horaria
- ✅ Asigna gestores correctamente
- ✅ Hereda sucursal del cliente
- ✅ Guarda mapa de créditos para Fase 3

### FASE 3: PAGOS
- ✅ Migra pagos en **lotes de 50** para evitar timeouts
- ✅ **FECHAS CON HORA EXACTA**: Los pagos mantienen su fecha y hora original precisa para mostrar en historial
- ✅ **Reconexión automática** entre lotes
- ✅ IDs bonitos: `pay_001`, `pay_002`, etc.
- ✅ Manejo robusto de errores

## � MANEJO DE FECHAS (IMPORTANTE)

### **Fechas de "Día Completo" → `12:00:00`**
- `firstPaymentDate` (fecha primera cuota)
- `dueDate` (fecha vencimiento)
- `deliveryDate` (fecha entrega)
- **Razón**: Evita problemas de conversión de zona horaria al mostrar fechas

### **Fechas con Hora Exacta → Hora Original**
- `paymentDate` en pagos (fecha y hora exacta del abono)
- `created_at`, `updated_at` (timestamps de auditoría)
- **Razón**: Necesario para mostrar hora precisa en historial de pagos

## �🔍 VERIFICACINÓ

El script `verificar-migracion.js` muestra:
- Conteo de registros migrados
- Ejemplos de IDs bonitos
- Distribución por sucursales
- Estado general de la migración

## ⚠️ NOTAS IMPORTANTES

1. **ORDEN OBLIGATORIO**: Las fases deben ejecutarse en orden (1→2→3)
2. **DEPENDENCIAS**: Cada fase necesita los archivos de la anterior
3. **ARCHIVOS TEMPORALES**: Se crean `translation-map.json` y `credit-map.json`
4. **MODO SIMULACIÓN**: Cambiar `SIMULATION_MODE = true` para probar sin cambios
5. **BACKUP**: Siempre hacer backup antes de migrar

## 🎯 RESULTADOS ESPERADOS

Después de la migración completa:
- **214 clientes** con IDs bonitos y sucursales asignadas
- **435 créditos** con decimales corregidos y fechas con zona horaria correcta
- **3,112 pagos** con fechas y horas exactas preservadas
- **Contadores** reseteados correctamente
- **Dashboard** funcionando con lógica corregida
- **Planes de pago** sincronizados correctamente

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "No se encontró translation-map.json"
- **Solución**: Ejecutar primero `migration-fase1.js`

### Error: "Can't add new command when connection is in closed state"
- **Solución**: La Fase 3 maneja esto automáticamente con reconexión

### Error de conexión a BD
- **Verificar**: Credenciales en archivo `.env`
- **Verificar**: Conectividad a `mysql.freehostia.com`

### Verificar progreso
```bash
node verificar-migracion.js
```

## � SOPORTE

Si hay problemas durante la migración:
1. Verificar logs de error en consola
2. Ejecutar `verificar-migracion.js` para ver estado actual
3. Los archivos `translation-map.json` y `credit-map.json` contienen mapeos importantes

---

**¡IMPORTANTE!** Siempre hacer backup de la base de datos antes de ejecutar la migración.