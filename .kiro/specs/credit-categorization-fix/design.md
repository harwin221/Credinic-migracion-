# Design Document: Credit Categorization Fix

## Overview

Este diseño corrige la lógica de categorización de créditos en el dashboard del gestor, específicamente el error en el orden de prioridades que causa que créditos con mora aparezcan incorrectamente en la pestaña "Al Día" cuando deberían estar en "Cuota del Día" o "En Mora".

La solución implementa un orden de prioridad correcto y lógica de categorización que refleja las reglas de negocio del sistema de microcréditos.

## Architecture

### Current Architecture
```
GestorDashboard.tsx
├── categorizeCredits() [BUGGY]
├── Credit Status Calculation
└── UI Rendering by Category
```

### Fixed Architecture
```
GestorDashboard.tsx
├── categorizeCredits() [FIXED]
│   ├── Priority-based categorization
│   └── Correct business rule implementation
├── Credit Status Validation
└── UI Rendering by Category
```

### Key Changes
- **Fixed Priority Order**: Cobrado Hoy → Cuota del Día → Vencidos → En Mora → Al Día
- **Correct Business Logic**: Créditos con mora + cuota hoy van a "Cuota del Día"
- **Validation Layer**: Asegurar que estados de crédito sean consistentes

## Components and Interfaces

### Modified Components

#### 1. GestorDashboard.tsx
**Function: categorizeCredits()**
- **Input**: Array of credits with calculated status details
- **Output**: Categorized credits object with 5 categories
- **Responsibility**: Apply correct business rules for credit categorization

```typescript
interface CategorizedCredits {
  paidToday: Credit[];      // Cobrado Hoy
  dueToday: Credit[];       // Cuota del Día  
  overdue: Credit[];        // En Mora
  expired: Credit[];        // Vencidos
  upToDate: Credit[];       // Al Día
}

interface CreditStatusDetails {
  paidToday: number;
  isDueToday: boolean;
  overdueAmount: number;
  isExpired: boolean;
}
```

#### 2. Credit Status Calculator (utils.ts)
**Function: calculateCreditStatusDetails()**
- **Validation**: Ensure consistent status calculation
- **Enhancement**: Add validation for edge cases
- **Output**: Reliable status details for categorization

### Business Logic Implementation

#### Priority-Based Categorization Logic
```typescript
function categorizeCredits(credits: Credit[]): CategorizedCredits {
  const categories: CategorizedCredits = {
    paidToday: [],
    dueToday: [],
    overdue: [],
    expired: [],
    upToDate: []
  };

  credits.forEach(credit => {
    const details = credit.details;
    
    // Priority 1: Cobrado Hoy (highest priority)
    if (details.paidToday > 0) {
      categories.paidToday.push(credit);
    }
    // Priority 2: Cuota del Día (includes credits with mora)
    else if (details.isDueToday) {
      categories.dueToday.push(credit);
    }
    // Priority 3: Vencidos
    else if (details.isExpired) {
      categories.expired.push(credit);
    }
    // Priority 4: En Mora (only if no cuota today)
    else if (details.overdueAmount > 0) {
      categories.overdue.push(credit);
    }
    // Priority 5: Al Día (default case)
    else {
      categories.upToDate.push(credit);
    }
  });

  return categories;
}
```

## Data Models

### Credit Interface
```typescript
interface Credit {
  id: string;
  clientName: string;
  amount: number;
  details: CreditStatusDetails;
  // ... other credit properties
}
```

### CreditStatusDetails Interface
```typescript
interface CreditStatusDetails {
  paidToday: number;        // Amount paid today
  isDueToday: boolean;      // Has payment due today
  overdueAmount: number;    // Total overdue amount
  isExpired: boolean;       // Past final due date
  daysOverdue?: number;     // Optional: days in mora
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Payment Today Takes Highest Priority
*For any* credit with paidToday > 0, regardless of other status flags (overdueAmount, isDueToday, isExpired), the credit should be placed exclusively in the "Cobrado Hoy" category and not appear in any other category.
**Validates: Requirements 2.1, 2.2, 3.2**

### Property 2: Due Today Categorization Logic
*For any* credit with isDueToday = true and paidToday = 0, the credit should be placed in the "Cuota del Día" category regardless of overdueAmount value (whether it has mora or not).
**Validates: Requirements 1.1, 1.3**

### Property 3: Overdue Without Due Today
*For any* credit with overdueAmount > 0 and isDueToday = false and paidToday = 0 and isExpired = false, the credit should be placed in the "En Mora" category.
**Validates: Requirements 1.2**

### Property 4: Expired Credits Categorization
*For any* credit with isExpired = true and paidToday = 0, the credit should be placed in the "Vencidos" category.
**Validates: Requirements 3.1**

### Property 5: Up To Date Default Case
*For any* credit with overdueAmount = 0 and isDueToday = false and isExpired = false and paidToday = 0, the credit should be placed in the "Al Día" category.
**Validates: Requirements 4.1**

### Property 6: Priority Order Resolution
*For any* credit that matches multiple category criteria, the categorization should follow the priority order: Cobrado Hoy > Cuota del Día > Vencidos > En Mora > Al Día, placing the credit in the highest priority matching category only.
**Validates: Requirements 5.1, 5.2**

### Property 7: Mutually Exclusive Categorization
*For any* array of credits, after categorization the sum of all category lengths should equal the input array length, and no credit should appear in multiple categories.
**Validates: Requirements 5.3**

### Property 8: Status Calculation Consistency
*For any* identical credit data, calling calculateCreditStatusDetails multiple times should return identical status objects with consistent isDueToday, overdueAmount, and isExpired values.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Input Validation
- **Null/Undefined Credits**: Handle empty or invalid credit arrays gracefully
- **Missing Status Details**: Provide default values for missing credit status properties
- **Invalid Status Values**: Validate that numeric values (paidToday, overdueAmount) are non-negative

### Edge Cases
- **Zero Values**: Handle credits with all zero/false status values correctly
- **Boundary Conditions**: Handle credits exactly at due dates or expiration dates
- **Data Inconsistencies**: Log warnings for credits with inconsistent status combinations

### Error Recovery
- **Categorization Failures**: If a credit cannot be categorized, place it in a default category and log the issue
- **Status Calculation Errors**: Provide fallback status values to prevent categorization failures

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples demonstrating correct categorization behavior
- Edge cases like credits with zero values or boundary conditions  
- Integration between status calculation and categorization
- Error conditions and invalid input handling

**Property Tests** focus on:
- Universal properties that hold for all valid credit combinations
- Comprehensive input coverage through randomization of credit status values
- Verification that business rules apply consistently across all possible inputs

### Property-Based Testing Configuration

- **Testing Library**: Use fast-check for TypeScript property-based testing
- **Test Iterations**: Minimum 100 iterations per property test
- **Test Tagging**: Each property test must reference its design document property
- **Tag Format**: **Feature: credit-categorization-fix, Property {number}: {property_text}**

### Unit Testing Balance

- Unit tests complement property tests by testing specific scenarios
- Focus unit tests on integration points and error conditions
- Avoid excessive unit tests since property tests handle comprehensive input coverage
- Property tests verify universal correctness while unit tests catch concrete implementation bugs

### Test Coverage Requirements

- All 8 correctness properties must be implemented as property-based tests
- Each property test must run minimum 100 iterations due to randomization
- Unit tests should cover error handling and edge cases not covered by properties
- Integration tests should verify end-to-end categorization flow in the dashboard component