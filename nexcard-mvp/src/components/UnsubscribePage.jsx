import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function UnsubscribePage() {
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email') || '';

  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnsubscribe = async () => {
    if (!emailParam) {
      setError('No se encontró un email válido en el enlace.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: dbError } = await supabase
        .from('email_unsubscribe')
        .insert({ email: emailParam.toLowerCase().trim() });
      // 23505 = unique_violation: email ya estaba dado de baja → éxito igual
      if (dbError && dbError.code !== '23505') throw dbError;
      setConfirmed(true);
    } catch (err) {
      setError('Ocurrió un error al procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-900 rounded-3xl p-10 text-center">
        <h1 className="text-2xl font-black text-white mb-2">
          Nex<span className="text-emerald-400">Card</span>
        </h1>

        {confirmed ? (
          <>
            <div className="mt-8 mb-4 text-5xl">✅</div>
            <h2 className="text-xl font-black text-white mb-3">Listo, te dimos de baja</h2>
            <p className="text-zinc-400 text-sm mb-6">
              El email <span className="text-white font-semibold">{emailParam}</span> ya no recibirá comunicaciones de NexCard.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl text-sm transition-colors"
            >
              Volver al inicio
            </a>
          </>
        ) : (
          <>
            <div className="mt-8 mb-4 text-5xl">📭</div>
            <h2 className="text-xl font-black text-white mb-3">¿Deseas darte de baja?</h2>
            <p className="text-zinc-400 text-sm mb-2">
              El siguiente email dejará de recibir comunicaciones de NexCard:
            </p>
            <p className="text-emerald-400 font-semibold text-sm mb-8 break-all">{emailParam || '(email no especificado)'}</p>

            {error && (
              <p className="text-red-400 text-sm mb-4 bg-red-950 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              onClick={handleUnsubscribe}
              disabled={loading || !emailParam}
              className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-sm transition-colors"
            >
              {loading ? 'Procesando...' : 'Confirmar baja'}
            </button>
            <a
              href="/"
              className="block mt-3 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
            >
              Cancelar — quiero seguir recibiendo emails
            </a>
          </>
        )}

        <div className="mt-10 pt-6 border-t border-zinc-800">
          <p className="text-zinc-600 text-xs">
            NexCard · nexcard.cl · hola@nexcard.cl
          </p>
          <p className="text-zinc-700 text-xs mt-1">
            Ley 19.628 — Protección de datos personales
          </p>
        </div>
      </div>
    </div>
  );
}
