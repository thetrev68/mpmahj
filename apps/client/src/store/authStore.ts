import { create } from 'zustand';
import { supabase } from '@/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  jwt: string | null;
  loading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  jwt: null,
  loading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    if (!supabase) {
      set({ error: 'Supabase not configured' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({
        user: data.user,
        jwt: data.session?.access_token || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sign in failed',
        loading: false,
      });
    }
  },

  signUp: async (email: string, password: string) => {
    if (!supabase) {
      set({ error: 'Supabase not configured' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({
        user: data.user,
        jwt: data.session?.access_token || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sign up failed',
        loading: false,
      });
    }
  },

  signOut: async () => {
    if (!supabase) {
      set({ user: null, jwt: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ user: null, jwt: null, loading: false, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sign out failed',
        loading: false,
      });
    }
  },

  checkSession: async () => {
    if (!supabase) {
      return;
    }

    set({ loading: true });

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({
        user: data.session?.user || null,
        jwt: data.session?.access_token || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Session check failed',
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
