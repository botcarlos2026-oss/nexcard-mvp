import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const hasSupabase = !!supabase;
// Stubs de compatibilidad post-rollback de Clerk
// Estas funciones no hacen nada — devuelven null para que el código existente no rompa
export const getClerkUserId = () => null;
export const setClerkTokenGetter = () => {};
export const setClerkUserId = () => {};
