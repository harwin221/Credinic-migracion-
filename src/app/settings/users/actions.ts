
'use server';

import { 
    createUserService, 
    resetUserPassword as resetUserPasswordService, 
    updateUserService, 
    deleteUserFromAuthAndDb, 
    getUser,
} from '@/services/user-service-server';
import type { AppUser as User } from '@/lib/types';
import type { CreateUserInput } from '@/lib/validation-schemas';
import { revalidatePath } from 'next/cache';
import { createLog } from '@/services/audit-log-service';
import { diff } from 'deep-object-diff';

/**
 * Acción de Servidor para crear un nuevo usuario. Llama a la función de servicio subyacente.
 */
export async function createUser(
  userData: CreateUserInput,
  actor: User,
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const result = await createUserService(userData);
  if (result.success && result.data) {
    await createLog(actor, 'user:create', `Se creó el usuario ${userData.displayName} (${userData.username}).`, {targetId: result.data});
    revalidatePath('/settings/users');
    revalidatePath('/audit');
  }
  return { success: result.success, userId: result.data, error: result.success ? undefined : result.error || 'Error creando usuario' };
}

export async function updateUserAction(
  userId: string,
  newData: Partial<User & { password?: string }>,
  actor: User
): Promise<{ success: boolean; error?: string }> {
    const oldData = await getUser(userId);
    const result = await updateUserService(userId, newData);

    if(result.success && oldData) {
        const changes = diff(oldData, { ...oldData, ...newData });
        const changeDetails = Object.keys(changes).map(key => {
            const oldValue = (oldData as any)[key];
            const newValue = (newData as any)[key];
            if (oldValue === undefined || oldValue === null || oldValue === '') {
                return `el ${key} se estableció en '${newValue}'`;
            }
            return `el ${key} cambió de '${oldValue}' a '${newValue}'`;
        }).join(', ');
        
        await createLog(actor, 'user:update', `Se actualizó el usuario ${newData.fullName || oldData.fullName}. Cambios: ${changeDetails}.`, {targetId: userId, details: changes});
        revalidatePath('/settings/users');
        revalidatePath('/audit');
    }
    return result;
}

/**
 * Acción de servidor para restablecer la contraseña de un usuario. Llama a la función de servicio subyacente.
 */
export async function resetUserPassword(uid: string, actor: User): Promise<{success: boolean, error?: string}> {
    const result = await resetUserPasswordService(uid);
     if (result.success) {
        const targetUser = await getUser(uid);
        if (targetUser) {
           await createLog(actor, 'user:reset_password', `Se forzó el reseteo de contraseña para ${targetUser.fullName}.`, {targetId: uid});
        }
    }
    return result;
}

export async function deleteUser(uid: string, actor: User): Promise<{success: boolean, error?: string}> {
  try {
    const userToDelete = await getUser(uid);
    if (userToDelete) {
        await deleteUserFromAuthAndDb(uid);
        await createLog(actor, 'user:delete', `Se eliminó al usuario ${userToDelete.fullName}.`, {targetId: uid});
        revalidatePath('/settings/users');
        revalidatePath('/audit');
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteUser server action:', error);
    return { success: false, error: error.message };
  }
}
