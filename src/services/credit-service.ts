

'use client';

import type { CreditDetail, AppUser as User } from '@/lib/types';
import { getCredit as getCreditServer, updateCredit as updateCreditServer, getClientCredits as getClientCreditsServer } from '@/services/credit-service-server';

/**
 * Obtiene los detalles completos de un crédito, incluyendo los del cliente.
 * Llama a una Server Action que consulta la base de datos.
 */
export const getCredit = async (id: string): Promise<CreditDetail | null> => {
    try {
        const credit = await getCreditServer(id);
        return credit;
    } catch (error) {
        console.error("Error fetching credit (client-side service):", error);
        return null;
    }
};

/**
 * Obtiene todos los créditos asociados a un ID de cliente.
 * Llama a una Server Action.
 */
export async function getClientCredits(clientId: string): Promise<CreditDetail[]> {
    try {
        return await getClientCreditsServer(clientId);
    } catch (error) {
        console.error(`Error fetching credits for client ${clientId}:`, error);
        return [];
    }
}

/**
 * Actualiza un crédito. Llama a una Server Action.
 */
export async function updateCredit(id: string, creditData: Partial<CreditDetail>, actor: User): Promise<{ success: boolean; error?: string }> {
    return updateCreditServer(id, creditData, actor);
}

/**
 * Obtiene todos los créditos con filtros (función cliente que usa fetch)
 */
export async function getCreditsAdmin(filters: {
    status?: string;
    searchTerm?: string;
    gestorName?: string;
    sucursales?: string[];
}): Promise<{ credits: CreditDetail[] }> {
    try {
        const params = new URLSearchParams();
        
        if (filters.status && filters.status !== 'all') {
            params.append('status', filters.status);
        }
        if (filters.searchTerm) {
            params.append('search', filters.searchTerm);
        }
        
        const response = await fetch(`/api/credits?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const credits = await response.json();
        return { credits: Array.isArray(credits) ? credits : [] };
    } catch (error) {
        console.error('Error fetching credits:', error);
        throw error;
    }
}

    
