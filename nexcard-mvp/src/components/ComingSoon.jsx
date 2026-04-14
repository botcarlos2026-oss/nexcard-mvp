import React, { useState } from 'react';

export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!value) return 'Ingresa tu email';
    if (!regex.test(value)) return 'Email inválido — ej: nombre@gmail.com';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateEmail(email);
    if (error) { setEmailError(error); return; }
    setLoading(true);
    try {
      const { supabase } = await import('../services/supabaseClient');
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email: email.trim().toLowerCase() }]);
      if (error && error.code !== '23505') {
        throw error;
      }
      setSubmitted(true);
    } catch (err) {
      console.warn('Waitlist error:', err);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl translate-x-1/2 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center">

        {/* Logo */}
        <div className="mb-10">
          <span className="text-4xl font-black tracking-tight">
            Nex<span className="text-emerald-400">Card</span>
          </span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Próximamente · Abril 2026
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
          Tu tarjeta de visita<br />
          <span className="text-emerald-400">del siglo XXI</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
          Estamos trabajando para lanzar muy pronto. Deja tu email y te avisamos el día que abramos.
        </p>

        {/* Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                onBlur={(e) => setEmailError(validateEmail(e.target.value))}
                placeholder="tu@email.com"
                className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none text-sm transition-colors ${emailError ? 'border-red-500 focus:border-red-500' : 'border-zinc-700 focus:border-emerald-500'}`}
              />
              {emailError && <p className="text-red-400 text-xs px-1">{emailError}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              {loading ? 'Guardando...' : 'Notifícame'}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-emerald-950 border border-emerald-800 text-emerald-300 px-6 py-4 rounded-xl max-w-md mx-auto">
            <span className="text-xl">✅</span>
            <div className="text-left">
              <p className="font-bold text-sm">¡Listo! Te avisamos pronto.</p>
              <p className="text-xs text-emerald-400/70">{email}</p>
            </div>
          </div>
        )}

        {/* Features preview */}
        <div className="grid grid-cols-3 gap-4 mt-14">
          {[
            { icon: '📱', label: 'Tarjeta NFC' },
            { icon: '⭐', label: 'Google Reviews' },
            { icon: '🔗', label: 'Perfil digital' },
          ].map((f) => (
            <div key={f.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-xs font-semibold text-zinc-400">{f.label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-zinc-600 text-xs mt-12">
          © 2026 NexCard · nexcard.cl
        </p>

      </div>
    </div>
  );
}
