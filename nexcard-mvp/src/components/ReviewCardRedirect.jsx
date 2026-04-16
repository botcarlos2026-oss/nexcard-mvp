import { useEffect, useState } from 'react';
import { supabase, hasSupabase } from '../services/supabaseClient';

export default function ReviewCardRedirect({ slug }) {
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      setNotFound(true);
      return;
    }

    supabase
      .from('review_cards')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
          return;
        }
        // Incrementar scan_count sin bloquear el redirect
        supabase
          .from('review_cards')
          .update({ scan_count: (data.scan_count || 0) + 1 })
          .eq('id', data.id)
          .then(() => {});
        window.location.href = data.google_review_url;
      });
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-2xl font-black">Link no encontrado</p>
        <p className="text-zinc-400">Este link de Google Reviews no existe o está inactivo.</p>
        <a href="/" className="text-emerald-400 underline text-sm">Volver a nexcard.cl</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-lg font-semibold">Redirigiendo a Google Reviews…</p>
    </div>
  );
}
