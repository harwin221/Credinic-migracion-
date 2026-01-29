# Script de Migración de Base de Datos

Este script está diseñado para migrar datos desde una estructura de base de datos MySQL antigua a una nueva, manejando la limpieza, transformación y validación de los datos en el proceso.

## Características y Avances Implementados

Este no es un script básico. Ha sido fortalecido con varias capas de seguridad y lógica para garantizar una migración exitosa y segura.

1.  **Migración por Fases y Ordenada**: El script respeta el orden de dependencia de los datos. Migra primero las entidades maestras y luego las que dependen de ellas (`Users` → `Clients` → `Credits` → `Payments`), evitando así errores de claves foráneas.

2.  **Proceso Reutilizable (Idempotente)**: ¡Esta es una característica clave! El script se puede ejecutar múltiples veces sin riesgo. Al inicio de cada ejecución real, activa una **Fase 0 de Limpieza** que vacía (`TRUNCATE`) todas las tablas de destino. Esto garantiza que cada migración sea una copia fresca y completa desde el origen, eliminando el riesgo de duplicar datos en ejecuciones repetidas.

3.  **Transacciones Atómicas (A prueba de fallos)**: Toda la operación de migración está envuelta en una única transacción. Esto funciona como una red de seguridad. Si ocurre CUALQUIER error en medio del proceso, la transacción se cancela por completo (`ROLLBACK`). **El resultado es que la base de datos de destino queda intacta**, como si el script nunca se hubiera ejecutado. Esto previene migraciones a medias y corrupción de datos.

4.  **Manejo Inteligente de Datos Inválidos**: El script está ahora "blindado" contra datos de mala calidad en la base de datos de origen. Si encuentra un registro (cliente, crédito, etc.) que no tiene una llave primaria válida (nula o vacía), hará lo siguiente:
    *   Imprimirá un mensaje de `[AVISO]` en la consola para notificar sobre el registro omitido.
    *   Saltará ese registro y **continuará con el resto de la migración**, sin detenerse.
    *   Al final de cada fase, informará cuántos registros se omitieron.

5.  **Transformación y Mapeo de Datos**: El script no solo copia datos, sino que los transforma. Mapea valores antiguos (ej: `estado_civil = 1`) a valores nuevos y legibles (ej: `civilStatus = 'Casado'`), adaptando la información al nuevo esquema de la base de datos.

6.  **Modo de Simulación**: Incluye una variable de seguridad `SIMULATION_MODE`. Cuando está en `true`, el script se conecta a las bases de datos y recorre todos los datos, pero solo *imprime* lo que haría, sin ejecutar ningún cambio. Esto permite verificar todo el proceso de forma segura antes de la ejecución real.

## Instrucciones de Uso

1.  **Instalar Dependencias**:
    ```bash
    npm install
    ```

2.  **Configurar Variables de Entorno**:
    Cree un archivo `.env` en la raíz del proyecto con las credenciales de ambas bases de datos:
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

3.  **Paso 3: Ejecutar en Modo Simulación (Recomendado)**:
    Asegúrese de que la variable `SIMULATION_MODE` en `migration.js` esté en `true`. Luego, ejecute:
    ```bash
    node migration.js
    ```
    Revise la salida en la consola para confirmar que los datos se están leyendo y preparando correctamente. No se realizará ningún cambio en la base de datos.

4.  **Paso 4: Ejecución Real**:
    Una vez verificada la simulación, edite `migration.js` y cambie `SIMULATION_MODE` a `false`.
    Ejecute el script. Esta vez, se limpiarán las tablas de destino y se insertarán los datos.
    ```bash
    node migration.js
    ```
