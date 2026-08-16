import { createClient } from '../supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8005';

// Render free-tier services spin down after inactivity and take up to 60s to
// wake. We retry on network errors (not HTTP errors) up to MAX_RETRIES times
// with a short delay so callers don't need to handle this themselves.
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 4000;

async function withRetry(fn: () => Promise<Response>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // Only retry on network-level failures (TypeError: Failed to fetch).
      // HTTP errors (4xx/5xx) come back as resolved Responses, not thrown.
      const isNetworkError = err instanceof TypeError;
      if (!isNetworkError || attempt === MAX_RETRIES - 1) throw err;
      lastError = err;
      await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

import { useModelStore } from '../stores/modelStore';

async function buildHeaders(options: RequestInit): Promise<Headers> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Attach the selected model tier globally to all API requests
  const selectedTier = useModelStore.getState().selectedTier;
  headers.set('x-model-tier', selectedTier);
  
  return headers;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = await buildHeaders(options);
  const response = await withRetry(() =>
    fetch(`${BACKEND_URL}/api${endpoint}`, { ...options, headers })
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.message || `API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function apiFetchRaw(endpoint: string, options: RequestInit = {}) {
  const headers = await buildHeaders(options);
  const response = await withRetry(() =>
    fetch(`${BACKEND_URL}/api${endpoint}`, { ...options, headers })
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.message || `API Error: ${response.statusText}`);
  }

  return response;
}
