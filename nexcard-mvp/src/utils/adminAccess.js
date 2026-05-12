import { hasSupabase, supabase } from '../services/supabaseClient';
import { isAdminEmail } from '../config/admin';

async function resolveAdminRoleFromSupabase() {
  if (!hasSupabase || !supabase) {
    return { isAdmin: false, source: 'disabled' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const session = sessionData?.session || null;
  const email = session?.user?.email || null;

  if (!session?.user?.id) {
    return { isAdmin: false, source: 'anonymous', session, email };
  }

  const { data, error } = await supabase.rpc('has_role', { required_role: 'admin' });
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
