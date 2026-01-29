
'use server';

import { query } from '@/lib/mysql';
import type { AuditLog, AppUser as User } from '@/lib/types';

/**
 * Crea una nueva entrada de registro de auditoría en la tabla `audit_logs` de MySQL.
 * @param actor El usuario que realiza la acción.
 * @param action Un nombre de acción corto y legible por máquina (p. ej., 'user:create').
 * @param details Una descripción legible por humanos de la acción.
 * @param metadata Metadatos adicionales, incluyendo targetId y detalles de los cambios.
 */
export const createLog = async (
  actor: User,
  action: string,
  details: string,
  metadata: { targetId: string; details?: any }
): Promise<void> => {
  if (!actor || !actor.id || !actor.fullName) {
    console.warn('Registro de auditoría omitido: Actor no válido proporcionado.');
    return;
  }

  try {
    const [entityType] = action.split(':');
    const logSql = `
        INSERT INTO audit_logs (userId, userName, action, details, entityId, entityType, changes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await query(logSql, [
        actor.id,
        actor.fullName,
        action,
        details,
        metadata.targetId,
        entityType,
        metadata.details ? JSON.stringify(metadata.details) : null,
    ]);
  } catch (error) {
    console.error("Fallo al crear registro de auditoría en MySQL:", error);
    // No relanzamos el error aquí porque un fallo en el registro no debe bloquear la operación principal.
  }
};
