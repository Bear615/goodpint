import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, login as loginRequest, logout as logoutRequest, signup as signupRequest } from '../services/api';
import { clearToken, getToken, setToken } from '../utils/authToken';
import type { User } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // On launch, restore any stored token and validate it against the server.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await getToken();
      if (!token) {
        if (mounted) setStatus('unauthenticated');
        return;
      }
      try {
        const { user: me } = await getMe();
        if (!mounted) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        // Token invalid/expired — drop it and require sign-in.
        await clearToken();
        if (mounted) setStatus('unauthenticated');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async signIn(email, password) {
        const { token, user: me } = await loginRequest({ email, password });
        await setToken(token);
        setUser(me);
        setStatus('authenticated');
      },
      async signUp(email, password, name) {
        const { token, user: me } = await signupRequest({ email, password, name });
        await setToken(token);
        setUser(me);
        setStatus('authenticated');
      },
      async signOut() {
        try {
          await logoutRequest();
        } catch {
          // Best-effort server logout; clear locally regardless.
        }
        await clearToken();
        setUser(null);
        setStatus('unauthenticated');
      },
      setUser,
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
