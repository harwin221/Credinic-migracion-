# Requirements Document

## Introduction

Este documento especifica los requerimientos para corregir la lógica de categorización de créditos en el dashboard del gestor de microcréditos. El sistema actual tiene un error crítico en el orden de prioridades que causa que créditos con mora aparezcan incorrectamente en la pestaña "Al Día" cuando deberían estar en "En Mora" o "Cuota del Día".

## Glossary

- **Credit**: Un microcrédito otorgado a un cliente
- **Gestor_Dashboard**: Dashboard principal del gestor de cobros
- **Credit_Categorizer**: Componente que clasifica créditos en categorías
- **Credit_Status_Calculator**: Función que calcula el estado detallado de un crédito
- **Mora**: Cantidad de dinero vencida que el cliente debe
- **Cuota_del_Día**: Pago programado para el día actual
- **Vencido**: Crédito que pasó su fecha de vencimiento final

## Requirements

### Requirement 1: Categorización Correcta de Créditos con Mora y Cuota del Día

**User Story:** Como gestor de cobros, quiero que los créditos con mora que tienen cuota programada para hoy aparezcan en la pestaña "Cuota del Día", para poder priorizar correctamente mis cobros diarios.

#### Acceptance Criteria

1. WHEN a credit has overdueAmount > 0 AND isDueToday = true, THE Credit_Categorizer SHALL place it in the "Cuota del Día" category
2. WHEN a credit has overdueAmount > 0 AND isDueToday = false, THE Credit_Categorizer SHALL place it in the "En Mora" category
3. WHEN a credit has overdueAmount = 0 AND isDueToday = true, THE Credit_Categorizer SHALL place it in the "Cuota del Día" category

### Requirement 2: Prioridad de Categorización de Pagos Realizados

**User Story:** Como gestor de cobros, quiero que los créditos que ya recibieron pago hoy aparezcan en "Cobrado Hoy" independientemente de otros estados, para tener visibilidad clara de mis cobros exitosos.

#### Acceptance Criteria

1. WHEN a credit has paidToday > 0, THE Credit_Categorizer SHALL place it in the "Cobrado Hoy" category regardless of other status flags
2. WHEN a credit has paidToday > 0, THE Credit_Categorizer SHALL NOT place it in any other category

### Requirement 3: Categorización de Créditos Vencidos

**User Story:** Como gestor de cobros, quiero que los créditos que pasaron su fecha de vencimiento final aparezcan en "Vencidos", para gestionar casos que requieren acciones especiales.

#### Acceptance Criteria

1. WHEN a credit has isExpired = true AND paidToday = 0, THE Credit_Categorizer SHALL place it in the "Vencidos" category
2. WHEN a credit has isExpired = true AND paidToday > 0, THE Credit_Categorizer SHALL place it in the "Cobrado Hoy" category

### Requirement 4: Categorización de Créditos Al Día

**User Story:** Como gestor de cobros, quiero que los créditos sin mora, sin cuota hoy y no vencidos aparezcan en "Al Día", para tener una vista clara de la cartera saludable.

#### Acceptance Criteria

1. WHEN a credit has overdueAmount = 0 AND isDueToday = false AND isExpired = false AND paidToday = 0, THE Credit_Categorizer SHALL place it in the "Al Día" category
2. THE Credit_Categorizer SHALL NOT place credits with any active status flags in the "Al Día" category

### Requirement 5: Orden de Prioridad en la Lógica de Categorización

**User Story:** Como gestor de cobros, quiero que la lógica de categorización siga un orden de prioridad específico, para asegurar que cada crédito aparezca en la categoría más apropiada.

#### Acceptance Criteria

1. THE Credit_Categorizer SHALL evaluate categories in this exact order: Cobrado Hoy, Cuota del Día, Vencidos, En Mora, Al Día
2. WHEN a credit matches multiple category criteria, THE Credit_Categorizer SHALL place it in the highest priority category only
3. THE Credit_Categorizer SHALL ensure each credit appears in exactly one category

### Requirement 6: Validación de Estados de Crédito

**User Story:** Como desarrollador, quiero que el sistema valide que los estados de crédito sean calculados correctamente, para asegurar que la categorización funcione con datos precisos.

#### Acceptance Criteria

1. WHEN calculating credit status, THE Credit_Status_Calculator SHALL correctly determine isDueToday based on payment schedule
2. WHEN calculating credit status, THE Credit_Status_Calculator SHALL correctly calculate overdueAmount based on missed payments
3. WHEN calculating credit status, THE Credit_Status_Calculator SHALL correctly determine isExpired based on final due date
4. THE Credit_Status_Calculator SHALL return consistent status objects for identical credit data