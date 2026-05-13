import { useEffect, useState } from 'react';
import { getStoredAuth, setStoredAuth } from '../services/api';
import { hasSupabase, supabase } from '../services/supabaseClient';

export function useAuthSessionSync() {
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!hasSupabase || !supabase) {
      setSessionReady(true);
      return undefined;
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setUser(session.user);
          setStoredAuth({ user: session.user });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Supabase auth init failed:', error);
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      } else {
        setUser(null);
        setStoredAuth(null);
      }
      if (!cancelled) {
        setSessionReady(true);
      }
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return {
    user,
    setUser,
    sessionReady,
  };
}
