
'use server';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { AppUser } from '@/lib/types';
import { query } from '@/lib/mysql';
import * as bcrypt from 'bcryptjs';

const secretKey = process.env.JWT_SECRET || 'fallback-secret-key-debe-ser-larga-y-segura';
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Sesión de 1 día
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function loginUser(credentials: { username: string; password: string; }): Promise<{ success: boolean; error?: string; user?: AppUser }> {
  const { username, password } = credentials;

  try {
    const rows: any = await query('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);

    if (rows.length === 0) {
      console.error(`[Login Fallido] Usuario no encontrado con username: ${username.toLowerCase()}`);
      return { success: false, error: 'Credenciales incorrectas.' };
    }

    const user = rows[0];

    if (!user.active) {
      console.error(`[Login Fallido] La cuenta de usuario ${username.toLowerCase()} está inactiva.`);
      return { success: false, error: 'La cuenta de usuario está inactiva.' };
    }

    if (!user.hashed_password) {
      console.error(`[Login Fallido] El usuario ${username.toLowerCase()} no tiene una contraseña (hashed_password) en la base de datos.`);
      return { success: false, error: 'Cuenta de usuario corrupta. Contacte al administrador.' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.hashed_password);

    if (!passwordsMatch) {
      console.error(`[Login Fallido] La contraseña proporcionada para ${username.toLowerCase()} no coincide con el hash almacenado.`);
      return { success: false, error: 'Credenciales incorrectas.' };
    }

    const { checkAccess } = await import('@/services/settings-service');
    const accessCheck = await checkAccess(user.role, user.sucursal_id);

    if (!accessCheck.allowed) {
      console.warn(`[Login Denegado] Usuario ${username} bloqueado por control de acceso: ${accessCheck.reason}`);
      return { success: false, error: accessCheck.reason };
    }

    console.log(`[Login Exitoso] Usuario autenticado: ${username.toLowerCase()}`);

    const sessionPayload = {
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword
    };

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    const session = await encrypt(sessionPayload);

    (await cookies()).set('session', session, { expires, httpOnly: true });

    const appUser: AppUser = {
      ...user,
      username: user.username,
      sucursal: user.sucursal_id,
      sucursalName: user.sucursal_name
    };

    return { success: true, user: appUser };

  } catch (error) {
    console.error('[Login Action Error] Error inesperado en el servidor:', error);
    return { success: false, error: 'Error del servidor al intentar iniciar sesión.' };
  }
}

export async function logoutUser() {
  (await cookies()).set('session', '', { expires: new Date(0) });
}

export async function getSession(): Promise<AppUser | null> {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) return null;

  const decryptedSession = await decrypt(sessionCookie);
  if (!decryptedSession?.userId) return null;

  try {
    const userProfile = await getUserProfileFromDatabase(decryptedSession.userId);

    if (userProfile) {
      const { checkAccess } = await import('@/services/settings-service');
      const accessCheck = await checkAccess(userProfile.role, userProfile.sucursal);

      if (!accessCheck.allowed) {
        console.warn(`[Acceso Denegado] Usuario ${userProfile.username} bloqueado en tiempo real: ${accessCheck.reason}`);
        return null;
      }
    }

    return userProfile;
  } catch (error) {
    console.error('Error obteniendo perfil de usuario:', error);
    return {
      id: decryptedSession.userId,
      fullName: decryptedSession.fullName || 'Usuario',
      email: decryptedSession.email || '',
      username: decryptedSession.username || '',
      role: decryptedSession.role || 'OPERATIVO',
      mustChangePassword: decryptedSession.mustChangePassword || false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as AppUser;
  }
}

async function getUserProfileFromDatabase(userId: string): Promise<AppUser | null> {
  const sql = `
        SELECT id, fullName, email, username, phone, role, sucursal_id, sucursal_name, 
               active, mustChangePassword, createdAt, updatedAt 
        FROM users 
        WHERE id = ? AND active = 1 
        LIMIT 1
    `;

  const rows: any = await query(sql, [userId]);
  if (rows.length > 0) {
    const user = rows[0];
    return {
      ...user,
      username: user.username,
      sucursal: user.sucursal_id,
      sucursalName: user.sucursal_name
    } as AppUser;
  }
  return null;
}
