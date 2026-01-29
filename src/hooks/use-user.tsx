
'use client';

import * as React from 'react';
import type { AppUser } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
}

const UserContext = React.createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastFetch, setLastFetch] = React.useState<number>(0);
  const router = useRouter();

  React.useEffect(() => {
    let isMounted = true;

    async function getUserSession() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
        
        const response = await fetch('/api/me', {
          signal: controller.signal,
          cache: 'no-store' // Evitar caché del navegador para datos de sesión
        });
        
        clearTimeout(timeoutId);
        
        if (!isMounted) return; // Evitar actualizar estado si el componente se desmontó
        
        if (response.ok) {
          const userData: AppUser = await response.json();
          if (userData && userData.id) {
            setUser(userData);
            setLastFetch(Date.now());
          } else {
            setUser(null);
          }
        } else {
          // If the API call fails, we assume no user is logged in.
          setUser(null);
        }
      } catch (error) {
        if (!isMounted) return;
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn("Timeout al obtener sesión de usuario");
        } else {
          console.error("Error fetching user session:", error);
        }
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // Ejecutar inmediatamente al montar
    getUserSession();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Solo ejecutar una vez al montar
  
  const handleSetUser = (updatedUser: AppUser | null) => {
    setUser(updatedUser);
  };

  const contextValue = {
    user,
    loading,
    setUser: handleSetUser,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
