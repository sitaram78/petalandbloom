import { supabase } from '@/lib/supabaseClient';

/**
 * Authenticated fetch helper for client-to-API communication.
 * Automatically extracts the active Supabase session JWT and attaches
 * it as a Bearer token in the Authorization header.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn('[apiClient] Failed to retrieve session token:', err);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
