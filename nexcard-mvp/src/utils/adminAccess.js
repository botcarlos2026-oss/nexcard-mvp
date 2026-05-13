import { hasSupabase, supabase } from '../services/supabaseClient';
import { isAdminEmail } from '../config/admin';

const AUTH_TIMEOUT_MS = 4000;

function withTimeout(promise, label, timeoutMs = AUTH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs)),
  ]);
}

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('nexcard_auth') || 'null')?.user || null;
  } catch {
    return null;
  }
}

async function resolveAdminRoleFromSupabase() {
  if (!hasSupabase || !supabase) {
    return { isAdmin: false, source: 'disabled' };
  }

  let session = null;
  let email = null;

  try {
    const { data: sessionData, error: sessionError } = await withTimeout(supabase.auth.getSession(), 'admin_session');
    if (sessionError) {
      throw sessionError;
    }
    session = sessionData?.session || null;
    email = session?.user?.email || null;
  } catch (error) {
    const storedUser = readStoredUser();
    const storedEmail = storedUser?.email || null;
    return {
      isAdmin: isAdminEmail(storedEmail),
      source: storedEmail ? 'stored_auth_fallback' : 'session_error',
      session: null,
      email: storedEmail,
      error,
    };
  }

  if (!session?.user?.id) {
    return { isAdmin: false, source: 'anonymous', session, email };
  }

  try {
    const { data, error } = await withTimeout(supabase.rpc('has_role', { required_role: 'admin' }), 'has_role');
    if (error) {
      return {
        isAdmin: isAdminEmail(email),
        source: 'email_fallback_rpc_error',
        session,
        email,
        error,
      };
    }

    if (data) {
      return { isAdmin: true, source: 'memberships', session, email };
    }
  } catch (error) {
    return {
      isAdmin: isAdminEmail(email),
      source: 'email_fallback_rpc_timeout',
      session,
      email,
      error,
    };
  }

  return {
    isAdmin: isAdminEmail(email),
    source: isAdminEmail(email) ? 'email_fallback' : 'memberships',
    session,
    email,
  };
}

export async function getCurrentAdminAccess() {
  return resolveAdminRoleFromSupabase();
}
