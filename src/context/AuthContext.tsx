import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../utils/supabase/supabase';

interface AuthUser {
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      setUser({
        name: u.user_metadata?.name || u.email || '',
        email: u.email || '',
        isAdmin: u.user_metadata?.role === 'admin',
      });
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
