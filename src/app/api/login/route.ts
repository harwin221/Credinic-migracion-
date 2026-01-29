
'use server';

import { NextResponse } from 'next/server';
import { loginUser } from '@/app/(auth)/login/actions';
import { loginLimiter } from '@/lib/rate-limiter';
import { LoginSchema } from '@/lib/validation-schemas';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/service-response';

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIP || cfIP || 'unknown';
}

export async function POST(request: Request) {
  try {
    const clientIP = getClientIP(request);
    
    // Verificar rate limiting
    const rateLimitCheck = loginLimiter.canAttempt(clientIP);
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetTime!;
      const waitMinutes = Math.ceil((resetTime - Date.now()) / (1000 * 60));
      
      return NextResponse.json(
        createErrorResponse(
          `Demasiados intentos fallidos. Intente nuevamente en ${waitMinutes} minutos.`,
          'RATE_LIMITED',
          { resetTime, waitMinutes }
        ),
        { status: 429 }
      );
    }

    // Validar datos de entrada
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);
    
    if (!validation.success) {
      // Registrar intento fallido por datos inválidos
      loginLimiter.recordFailedAttempt(clientIP);
      
      return NextResponse.json(
        createValidationErrorResponse(validation.error),
        { status: 400 }
      );
    }

    const { username, password } = validation.data;

    // Intentar login
    const result = await loginUser({ username, password });

    if (result.success) {
      // Limpiar intentos fallidos en login exitoso
      loginLimiter.clearAttempts(clientIP);
      
      return NextResponse.json({
        success: true,
        message: 'Inicio de sesión exitoso.',
        data: { user: result.user }
      });
    } else {
      // Registrar intento fallido
      loginLimiter.recordFailedAttempt(clientIP);
      
      const attemptsLeft = loginLimiter.canAttempt(clientIP).attemptsLeft || 0;
      
      return NextResponse.json(
        createErrorResponse(
          result.error || 'Credenciales incorrectas.',
          'INVALID_CREDENTIALS',
          { attemptsLeft }
        ),
        { status: 401 }
      );
    }

  } catch (error: any) {
    console.error('[API Login Error] Error inesperado en el servidor:', error);
    
    return NextResponse.json(
      createErrorResponse(
        'Error interno del servidor.',
        'INTERNAL_ERROR'
      ),
      { status: 500 }
    );
  }
}
