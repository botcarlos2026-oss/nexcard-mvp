import { useEffect, useState } from 'react';
import { getStoredAuth, setStoredAuth } from '../services/api';
import { hasSupabase, supabase } from '../services/supabaseClient';

export function useAuthSessionSync() {
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      setSessionReady(true);
      return undefined;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      }
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      } else {
        setUser(null);
        setStoredAuth(null);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  return {
    user,
    setUser,
    sessionReady,
  };
}
