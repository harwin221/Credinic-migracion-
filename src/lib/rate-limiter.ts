/**
 * Rate limiter mejorado para controlar el número de consultas concurrentes
 * y prevenir ataques de fuerza bruta
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private activeQueries = 0;
  private maxConcurrent: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeQuery = async () => {
        this.activeQueries++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeQueries--;
          this.processQueue();
        }
      };

      if (this.activeQueries < this.maxConcurrent) {
        executeQuery();
      } else {
        this.queue.push(executeQuery);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeQueries < this.maxConcurrent) {
      const nextQuery = this.queue.shift();
      if (nextQuery) {
        nextQuery();
      }
    }
  }

  getStats() {
    return {
      activeQueries: this.activeQueries,
      queuedQueries: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

/**
 * Rate limiter específico para prevenir ataques de fuerza bruta
 */
class LoginRateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private maxAttempts: number;
  private windowMs: number;
  private blockDurationMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000, blockDurationMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockDurationMs = blockDurationMs;
  }

  /**
   * Verifica si una IP/usuario puede intentar login
   */
  canAttempt(identifier: string): { allowed: boolean; resetTime?: number; attemptsLeft?: number } {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      return { allowed: true, attemptsLeft: this.maxAttempts };
    }

    // Si el tiempo de reset ha pasado, limpiar el contador
    if (now > entry.resetTime) {
      this.attempts.delete(identifier);
      return { allowed: true, attemptsLeft: this.maxAttempts };
    }

    // Si ha excedido el límite, bloquear
    if (entry.count >= this.maxAttempts) {
      return { 
        allowed: false, 
        resetTime: entry.resetTime 
      };
    }

    return { 
      allowed: true, 
      attemptsLeft: this.maxAttempts - entry.count 
    };
  }

  /**
   * Registra un intento de login fallido
   */
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Primer intento o ventana expirada
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
    } else {
      // Incrementar contador
      entry.count++;
      if (entry.count >= this.maxAttempts) {
        // Extender el bloqueo
        entry.resetTime = now + this.blockDurationMs;
      }
    }
  }

  /**
   * Limpia el contador para un identificador (login exitoso)
   */
  clearAttempts(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Limpia entradas expiradas (mantenimiento)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now > entry.resetTime) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Obtiene estadísticas del rate limiter
   */
  getStats() {
    return {
      totalBlocked: this.attempts.size,
      activeBlocks: Array.from(this.attempts.entries()).filter(
        ([_, entry]) => Date.now() <= entry.resetTime
      ).length
    };
  }
}

// Instancias globales
export const queryLimiter = new RateLimiter(3);
export const loginLimiter = new LoginRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  loginLimiter.cleanup();
}, 5 * 60 * 1000);