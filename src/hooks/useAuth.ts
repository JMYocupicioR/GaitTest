import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.ts';

interface AuthState {
  user: User | null;
  loading: boolean;
}

export const useAuth = () => {
  const [{ user, loading }, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading auth session:', error);
        }
        if (!mounted) {
          return;
        }
        setAuthState({
          user: data.session?.user ?? null,
          loading: false,
        });
      })
      .catch((error) => {
        console.error('Error loading auth session:', error);
        if (!mounted) {
          return;
        }
        setAuthState({ user: null, loading: false });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      setAuthState({
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
