
'use client';

import { toast } from '@/hooks/use-toast';

/**
 * Main print function that decides which printing method to use.
 * It opens a dedicated page for the document type which handles the final output (PDF/Print).
 * @param documentType Type of document.
 * @param entityId The ID of the credit or client.
 * @param paymentId Optional payment ID for receipts. If not provided, the service will find the latest payment.
 * @param isReprint Optional flag for receipts.
 */
export function printDocument(
  documentType: 'receipt' | 'payment-plan' | 'promissory-note' | 'account-statement',
  entityId: string,
  paymentId: string | null, // paymentId puede ser nulo en algunos casos
  isReprint: boolean
): void {
  const params = new URLSearchParams();
  
  if (documentType === 'receipt') {
    if (!paymentId) {
        toast({
            title: 'Error de Impresión',
            description: 'No se especificó un ID de pago para el recibo.',
            variant: 'destructive',
        });
        return;
    }
    params.set('creditId', entityId);
    params.set('paymentId', paymentId);
    if (isReprint) {
      params.set('isReprint', 'true');
    }
  } else if (documentType === 'account-statement') {
      params.set('clientId', entityId);
  } else {
      params.set('creditId', entityId);
  }

  const url = `/reports/${documentType}?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens a new window with a document to be printed using the browser's standard print dialog.
 * This is meant for desktop/office use for documents like promissory notes or payment plans.
 * @param documentType The type of document to generate.
 * @param creditId The ID of the associated credit.
 */
export function printDocumentForDesktop(
  documentType: 'payment-plan' | 'promissory-note',
  creditId: string
): void {
  const params = new URLSearchParams({ creditId });
  const url = `/reports/${documentType}?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
