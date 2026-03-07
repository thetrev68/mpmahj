import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message || 'Invalid email or password.');
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Login succeeded, but no access token was returned.');
  }

  return token;
}

export async function signUpWithEmailPassword(
  email: string,
  password: string
): Promise<{ token: string | null; requiresEmailConfirmation: boolean }> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    throw new Error(error.message || 'Unable to create account.');
  }

  const token = data.session?.access_token ?? null;
  const requiresEmailConfirmation = token === null;
  return { token, requiresEmailConfirmation };
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = getSupabaseClient();
  const redirectTo = window.location.origin;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    throw new Error(error.message || 'Unable to send magic link.');
  }
}

export async function getAccessTokenFromSupabaseSession(): Promise<string | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(error.message || 'Unable to read Supabase session.');
  }
  return data.session?.access_token ?? null;
}
