# Mapeo de tablas — Migración de `base antigua.sql` → `base nueva.sql`

Resumen: este documento define correspondencias entre tablas y columnas, reglas de transformación y orden de migración para evitar romper claves foráneas.

**Estrategia de IDs**:
- Generar nuevos IDs tipo string para `clients`, `credits`, `payments_registered`, etc., con prefijo claro para evitar colisiones: por ejemplo `cli_old_<oldId>`, `cred_old_<oldId>`, `pay_old_<oldId>`.
- Mantener un archivo/tabla de correspondencia (`id_map`) que guarde: `{table, old_id, new_id}`.

**Orden de migración (recomendado)**:
1. `sucursales` (si aplica)
2. `users` (usuarios del sistema / staff)
3. `clients` (clientes / borrowers)
4. `personal_references`, `comerciante_info`, `asalariado_info` (info dependiente de clients)
5. `credits` (préstamos)
6. `payment_plan`
7. `payments_registered` (abonos / pagos)
8. `audit_logs`, `closures`, `interactions`, `holidays`, etc.

--

## Mapeo por tabla (prioritarias)

**1) Clients**
- Tabla origen (antigua): posible `clientes` / `clients` (schema Laravel). Buscar columnas: `id`, `name`, `first_name`, `last_name`, `cedula`, `phone`, `address`, `department`, `municipality`, `neighborhood`, `sucursal_id`.
- Tabla destino (nueva): `clients`.

Column mapping / transformaciones:
- `id` (numérico) -> `id` = `cli_old_<oldId>` (string)
- `clientNumber` -> si existe, mapear directamente; si no, generar formato `CLI-<secuencia>` y registrar en `id_map`.
- `name` <- concatenar `first_name` + `last_name` si `name` no existe.
- `firstName` <- `first_name`
- `lastName` <- `last_name`
- `cedula` -> mantener valor; en `base nueva.sql` las cédulas están base64-encoded (ej: 'Mjgx...'). Decidir: conservar texto original o aplicar base64. Recomendación: conservar original y opcionalmente crear encoded version si la app lo espera; si la app ya exige base64, almacenar `TO_BASE64(cedula)`.
- `phone` <- normalizar formato (eliminar espacios y caracteres no numéricos salvo guiones necesarios).
- `sex`, `civilStatus`, `employmentType` -> mapear valores literales (ej. 'masculino'/'femenino'), normalizar nombres.
- `sucursal_id` -> si existen sucursales en nueva BD, mapear a `suc_<oldId>` o a IDs actuales; si no, asignar `suc_1761721008127` (SUCURSAL PRINCIPAL) por defecto y documentar.
- `address`, `department`, `municipality`, `neighborhood` -> mapear directamente, limpiando saltos de línea.
- `tags` -> si existen etiquetas en la antigua (csv), convertir a JSON array.
- `createdAt`, `updatedAt` -> usar `created_at`/`updated_at` originales; si faltan, usar timestamp de migración.

Ejemplo SQL/transformación (pseudocódigo):
INSERT INTO clients (id, clientNumber, name, firstName, lastName, cedula, phone, sex, civilStatus, employmentType, sucursal_id, sucursal_name, department, municipality, neighborhood, address, tags, createdAt, updatedAt)
VALUES ('cli_old_123', 'CLI-0001', 'Juan Perez', 'Juan', 'Perez', '001-...-X', '8888-8888', 'masculino', 'soltero', 'comerciante', 'suc_1761721008127', 'SUCURSAL PRINCIPAL', 'LEON', 'LEON', 'LA CEIBA', 'direccion...', '[]', '2025-01-01 00:00:00', '2025-01-01 00:00:00');


**2) Users (usuarios del sistema)**
- Origen: `users` en la BD antigua (Laravel).
- Destino: `users` (nueva).

Column mapping / transformaciones:
- `id` (numérico) -> `id` = `user_old_<oldId>`
- `fullName` <- concatenar `name` y `last_name` según origen.
- `email` <- mapear directo.
- `hashed_password` <- si la antigua usaba bcrypt, conservar hash; si usaba otro algoritmo, rehashear o forzar `mustChangePassword` = true.
- `phone`, `role`, `sucursal_id`, `sucursal_name` -> mapear.
- `active` -> mapear 1/0 → true/false.
- `createdAt`, `updatedAt` -> mapear a `createdAt`/`updatedAt`.

Notas: Si no se puede reutilizar el hash, forzar restablecimiento y notificar.


**3) Credits / Prestamos**
- Origen: `prestamos`, `solicitudes` (Laravel) — revisar campos: `id`, `cliente_id`(FK numérica), `monto`, `interes`, `plazo`, `frecuencia`, `estado`, `fecha_solicitud`, `fecha_desembolso`, `monto_desembolsado`, etc.
- Destino: `credits` (nueva) con IDs tipo `cred_old_<oldId>`.

Column mapping:
- `id` -> `id` = `cred_old_<oldId>`
- `creditNumber` -> si existe en origen mapear; si no generar `CRE-000X` con contador.
- `clientId` -> buscar en `id_map` para `clients` y usar nuevo `cli_...`.
- `clientName` -> usar nombre del cliente al momento del préstamo.
- `status` -> mapear estados (`activo` -> `Active`, `anulado`->`Rejected` o `Deleted`) según reglas del negocio.
- `amount`, `principalAmount`, `interestRate`, `termMonths` -> convertir tipos numéricos (decimal).
- `paymentFrequency` -> normalizar ('Semanal','Quincenal','Mensual').
- `firstPaymentDate`, `deliveryDate`, `dueDate` -> mapear; cuidado con zonas horarias.
- `createdBy`, `lastModifiedBy` -> mapear usando `user_old_<id>` o `user_admin_01` si falta.


**4) Payment plan (plan de pagos)**
- Origen: tablas de cuotas (`cuotas`, `payment_schedule`) -> destino `payment_plan`.
- Mantener `paymentNumber`, `paymentDate`, `amount`, `principal`, `interest`, `balance`.
- `creditId` -> usar nuevo `cred_old_<oldId>`.


**5) Abonos / Payments -> `payments_registered`**
- Origen: `abonos` en `base antigua.sql`.
- Destino: `payments_registered`.

Mapping:
- `id` -> `pay_old_<oldId>`
- `creditId` -> requiere mapa `prestamo_id` -> `cred_old_<id>` (usar `id_map`).
- `paymentDate` <- `fecha_abono` / `created_at` si existe hora.
- `amount` <- sumar `total_efectivo + total_tarjeta + total_cheque + total_transferencia` o usar campo `total` si existe.
- `managedBy` <- mapear `created_user_id` a `user_old_<id>` o a nombre de usuario (buscar en `users` migrados).
- `transactionNumber` <- usar `referencia_transferencia` / `referencia_cheque` / generar `ABO-<oldId>` si vacío.
- `status`, `voidReason`, `voidRequestedBy` <- mapear `estado` y campos de anulado.


## Tablas auxiliares y transformaciones especiales

**`personal_references`**
- Origen: referencias guardadas en JSON o columnas relacionadas. Crear filas por cada referencia asociada a `clientId` (usar `cli_old_<id>`).

**`comerciante_info` / `asalariado_info`**
- Origen: campos adicionales en `clients` o tablas `comerciante_info`/`asalariado_info` de la antigua.
- Destino: tablas equivalentes en la nueva BD; crear registros con `clientId` = `cli_old_<id>`.

**`sucursales`**
- Mapear sucursales de la antigua a nuevas IDs; si la nueva ya tiene sucursales, usar esas; sino crear `suc_old_<id>`.

**`counters`**
- Actualizar contadores en la nueva DB (`clientNumber`, `creditNumber`, `reciboNumber`) según máximos migrados.


## Reglas de limpieza y validación
- Normalizar fechas a `YYYY-MM-DD HH:MM:SS`.
- Normalizar teléfonos (eliminar caracteres extra, mantener guiones si están normalizados en la app).
- Valores NULL: respetar NULLs, pero para campos NOT NULL establecer valores por defecto documentados.
- Duplicados: ejecutar chequeo por `cedula` y `email`; si conflicto, reportar y almacenar en `duplicates_report.csv`.
- Encoding de cédula: si la app espera base64, aplicar `TO_BASE64(cedula)`; documentar la decisión.


## Registro de correspondencias
- Crear tabla temporal `migration_id_map` con columnas: `table_name`, `old_id`, `new_id`, `notes`.
- Registrar cada inserción para facilitar rollback y trazabilidad.


## Ejemplo de script (Node.js) — idea general
- Leer dump SQL antiguo o exportar tablas a CSV.
- Por cada fila de `clientes`: construir nuevo objeto `clients` y ejecutar INSERT en la nueva DB; guardar mapeo.
- Repetir para `users`, `credits`, `payment_plan`, `payments_registered` usando la `migration_id_map` para FK.


## Riesgos y notas finales
- Contraseñas de `users`: si hashes incompatibles, forzar `mustChangePassword`.
- Campos calculados (saldos, balances): preferir recalcular desde `payment_plan` + `payments` en la nueva app en vez de confiar en valores antiguos.
- Probar con dataset reducido (100 clientes + sus créditos) antes de la migración completa.


---
Fecha: 2026-01-23
Autor: Equipo de migración
