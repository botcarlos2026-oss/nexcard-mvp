import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseDisabled = process.env.REACT_APP_DISABLE_SUPABASE === 'true';

export const supabase = (!supabaseDisabled && supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const hasSupabase = !!supabase;

const readStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const auth = JSON.parse(window.localStorage.getItem('nexcard_auth') || 'null');
    return auth?.user || null;
  } catch {
    return null;
  }
};

// Compatibilidad temporal post-rollback de Clerk.
// Conservamos el nombre para evitar refactors masivos, pero ahora resuelve
// contra la sesión/estado local de Supabase.
export const getClerkUserId = () => readStoredUser()?.id || null;
export const getCurrentUserEmail = () => readStoredUser()?.email?.toLowerCase?.().trim?.() || null;
export const setClerkTokenGetter = () => {};
export const setClerkUserId = () => {};
