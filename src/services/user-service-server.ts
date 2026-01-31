
'use server';

import { query } from '@/lib/mysql';
import type { AppUser } from '@/lib/types';
import * as bcrypt from 'bcryptjs';
import { generateUserId } from '@/lib/id-generator';
import { generateUniqueUsername } from '@/lib/username-generator';
import { 
  CreateUserSchema, 
  type CreateUserInput
} from '@/lib/validation-schemas';
import { 
  withErrorHandling, 
  validateOrThrow, 
  ServiceError,
  NotFoundError,
  ServiceResponse
} from '@/lib/service-response';

// NOTE: This function is separate and used only for the initial setup.
async function createFirstUser(userData: { displayName: string; email: string; password: string }) {
  try {
    const { displayName, email, password } = userData;
    
    // Check if any users exist
    const existingUsers: any = await query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
      return { success: false, error: 'Ya existe un usuario en el sistema' };
    }
    
    // Create the first admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = generateUserId();
    const username = 'admin'; // Fixed username for first user
    
    await query(
      'INSERT INTO users (id, fullName, email, username, hashed_password, role, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newUserId, displayName, email, username, hashedPassword, 'ADMINISTRADOR', 1, new Date(), new Date()]
    );
    
    return { success: true, userId: newUserId };
  } catch (error) {
    console.error('Error creating first user:', error);
    return { success: false, error: 'Error al crear el usuario administrador' };
  }
}

export async function createUserService(input: CreateUserInput): Promise<ServiceResponse<string>> {
  return withErrorHandling(async () => {
    // 1. Validate the input against the schema (which no longer has email)
    const validatedData = validateOrThrow(CreateUserSchema, input) as CreateUserInput;
    
    // 2. Destructure the validated data. 'email' is no longer here.
    const { displayName, username, password, phone, role, branch, active } = validatedData;
    
    const existingUser: any = await query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      throw new ServiceError('El nombre de usuario ya está en uso.', 'DUPLICATE_ENTRY');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = generateUserId();
    
    // 3. Generate a placeholder email, as the database schema requires it.
    const generatedEmail = `${username}@credinic.com`;

    let branchId: string | null;
    let branchName: string | null;

    if (branch === 'TODAS') {
        branchId = null;
        branchName = 'TODAS';
    } else {
        const branchResult: any = await query('SELECT name FROM sucursales WHERE id = ?', [branch]);
        if (branchResult.length === 0) {
          throw new NotFoundError('Sucursal');
        }
        branchId = branch;
        branchName = branchResult[0].name;
    }

    const phoneValue = phone || null;

    const sql = `
        INSERT INTO users (id, fullName, email, username, hashed_password, phone, role, sucursal_id, sucursal_name, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // 4. Use the generatedEmail in the insert query.
    await query(sql, [
      newUserId, 
      displayName.toUpperCase(), 
      generatedEmail, 
      username,
      hashedPassword, 
      phoneValue, 
      role.toUpperCase(), 
      branchId, 
      branchName, 
      active
    ]);
    
    return newUserId;
  }, 'createUserService');
}

// The rest of the functions (update, delete, etc.) remain the same

export async function updateUserPassword(userId: string, newPassword: string): Promise<ServiceResponse<void>> {
  return withErrorHandling(async () => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET hashed_password = ?, mustChangePassword = ? WHERE id = ?', [hashedPassword, false, userId]);
  }, 'updateUserPassword');
}

export async function updateUserService(userId: string, userData: Partial<AppUser & { password?: string }>): Promise<{ success: boolean; error?: string }> {
    try {
        const updateFields: string[] = [];
        const values: any[] = [];

        const columnMap: { [key in keyof AppUser]?: string } = {
            fullName: 'fullName',
            username: 'username',
            email: 'email',
            phone: 'phone',
            role: 'role',
            sucursal: 'sucursal_id',
            sucursalName: 'sucursal_name',
            active: 'active'
        };

        // Handle password separately if provided
        if (userData.password && userData.password.trim().length > 0) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            updateFields.push('hashed_password = ?');
            values.push(hashedPassword);
            updateFields.push('mustChangePassword = ?');
            values.push(false);
        }

        for (const key in userData) {
            if (Object.prototype.hasOwnProperty.call(userData, key) && key !== 'password') {
                const typedKey = key as keyof AppUser;
                const column = columnMap[typedKey];
                if (column) {
                    let value = userData[typedKey];
                    
                    if (typedKey === 'sucursal' && value === 'TODAS') {
                        updateFields.push('sucursal_id = ?');
                        values.push(null);
                        updateFields.push('sucursal_name = ?');
                        values.push('TODAS');
                        continue;
                    }

                    if (value === undefined) {
                        value = null;
                    }

                    updateFields.push(`${column} = ?`);
                    values.push(value);
                }
            }
        }

        if (updateFields.length === 0) {
            return { success: true };
        }

        const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        values.push(userId);

        await query(sql, values);
        
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user:", error);
        return { success: false, error: 'No se pudo actualizar el usuario.' };
    }
}

export async function resetUserPassword(uid: string): Promise<{success: boolean, error?: string}> {
  try {
      await query('UPDATE users SET mustChangePassword = ? WHERE id = ?', [true, uid]);
      return { success: true };
  } catch (error: any) {
      return { success: false, error: 'No se pudo resetear la contraseña.' };
  }
}

export const getUsers = async (currentUser?: AppUser): Promise<AppUser[]> => {
  let sql = 'SELECT u.id, u.fullName, u.username, u.email, u.phone, u.role, u.sucursal_id, u.sucursal_name, u.active FROM users u';
  const params: any[] = [];

  if (currentUser) {
    const userRole = currentUser.role.toUpperCase();
    if (['GERENTE', 'OPERATIVO'].includes(userRole) && currentUser.sucursal) {
      sql += ' WHERE u.sucursal_id = ?';
      params.push(currentUser.sucursal);
    }
  }

  sql += ' ORDER BY u.fullName';

  const users: any = await query(sql, params);
  return users.map((u: any) => ({
      ...u,
      username: u.username, 
      sucursal: u.sucursal_id,
      sucursalName: u.sucursal_name
  })) as AppUser[];
};

export async function getUser(id: string): Promise<AppUser | null> {
  const users: any = await query('SELECT u.id, u.fullName, u.username, u.email, u.phone, u.role, u.sucursal_id, u.sucursal_name, u.active FROM users u WHERE u.id = ? LIMIT 1', [id]);
  if (users.length === 0) return null;
  const user = users[0];
  return {
      ...user,
      username: user.username,
      sucursal: user.sucursal_id,
      sucursalName: user.sucursal_name
  } as AppUser;
}

export async function getUserByName(name: string): Promise<AppUser | null> {
  const users: any = await query('SELECT * FROM users WHERE fullName = ? LIMIT 1', [name]);
  if (users.length === 0) return null;
  const user = users[0];
  return {
      ...user,
      sucursal: user.sucursal_id,
      sucursalName: user.sucursal_name
  } as AppUser;
}

export async function deleteUserFromAuthAndDb(uid: string): Promise<void> {
  await query('DELETE FROM users WHERE id = ?', [uid]);
}

// Only export the functions that are meant to be used as server actions
export { createFirstUser };
