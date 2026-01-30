# Implementation Plan: Credit Categorization Fix

## Overview

Este plan implementa la corrección de la lógica de categorización de créditos en el dashboard del gestor, corrigiendo el error crítico en el orden de prioridades que causa que créditos con mora aparezcan incorrectamente en la pestaña "Al Día".

## Tasks

- [ ] 1. Set up testing framework and types
  - Install and configure fast-check for property-based testing
  - Define TypeScript interfaces for credit categorization
  - Set up test utilities for generating random credit data
  - _Requirements: 6.4_

- [ ] 2. Fix credit categorization logic in GestorDashboard.tsx
  - [ ] 2.1 Implement corrected categorizeCredits function with proper priority order
    - Replace existing buggy categorization logic
    - Implement priority-based categorization: Cobrado Hoy → Cuota del Día → Vencidos → En Mora → Al Día
    - Ensure credits with mora + cuota hoy go to "Cuota del Día"
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3_

  - [ ]* 2.2 Write property test for payment today priority
    - **Property 1: Payment Today Takes Highest Priority**
    - **Validates: Requirements 2.1, 2.2, 3.2**

  - [ ]* 2.3 Write property test for due today categorization
    - **Property 2: Due Today Categorization Logic**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 2.4 Write property test for overdue without due today
    - **Property 3: Overdue Without Due Today**
    - **Validates: Requirements 1.2**

- [ ] 3. Validate and enhance credit status calculation
  - [ ] 3.1 Review and validate calculateCreditStatusDetails function in utils.ts
    - Ensure consistent status calculation for isDueToday, overdueAmount, isExpired
    - Add input validation and error handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 Write property test for status calculation consistency
    - **Property 8: Status Calculation Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 4. Implement remaining categorization rules
  - [ ] 4.1 Implement expired credits categorization logic
    - Ensure expired credits go to "Vencidos" when not paid today
    - _Requirements: 3.1_

  - [ ]* 4.2 Write property test for expired credits
    - **Property 4: Expired Credits Categorization**
    - **Validates: Requirements 3.1**

  - [ ] 4.3 Implement up-to-date default categorization
    - Ensure credits with no active flags go to "Al Día"
    - _Requirements: 4.1_

  - [ ]* 4.4 Write property test for up-to-date default case
    - **Property 5: Up To Date Default Case**
    - **Validates: Requirements 4.1**

- [ ] 5. Checkpoint - Ensure core categorization logic works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement priority resolution and validation
  - [ ] 6.1 Add priority order validation logic
    - Ensure credits matching multiple criteria go to highest priority category
    - _Requirements: 5.1, 5.2_

  - [ ]* 6.2 Write property test for priority order resolution
    - **Property 6: Priority Order Resolution**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 6.3 Add mutual exclusivity validation
    - Ensure each credit appears in exactly one category
    - _Requirements: 5.3_

  - [ ]* 6.4 Write property test for mutually exclusive categorization
    - **Property 7: Mutually Exclusive Categorization**
    - **Validates: Requirements 5.3**

- [ ] 7. Add error handling and edge cases
  - [ ] 7.1 Implement input validation for credit arrays
    - Handle null/undefined credits gracefully
    - Provide default values for missing status properties
    - Add logging for data inconsistencies
    - _Requirements: All requirements (error handling)_

  - [ ]* 7.2 Write unit tests for error handling
    - Test null/undefined inputs
    - Test credits with missing status properties
    - Test boundary conditions and edge cases
    - _Requirements: All requirements (error handling)_

- [ ] 8. Integration and verification
  - [ ] 8.1 Integrate fixed categorization logic with dashboard UI
    - Ensure UI correctly displays categorized credits
    - Verify tab counts and credit lists are accurate
    - _Requirements: All requirements_

  - [ ]* 8.2 Write integration tests for dashboard categorization
    - Test end-to-end categorization flow
    - Verify UI displays correct categories
    - _Requirements: All requirements_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The fix addresses the critical bug where credits with mora + cuota hoy appeared in "Al Día" instead of "Cuota del Día"