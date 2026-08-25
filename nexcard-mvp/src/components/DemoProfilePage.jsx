import React, { useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Save, Smartphone } from 'lucide-react';
import NexCardProfile from './NexCardProfile';
import { demoEditableFields, nexcardDemoProfile } from '../data/demoProfile';

export default function DemoProfilePage() {
  const [profile, setProfile] = useState(nexcardDemoProfile);
  const [savedAt, setSavedAt] = useState('');

  const publicUrl = useMemo(() => `${window.location.origin}/demo`, []);

  const updateField = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setSavedAt('');
  };

  const resetDemo = () => {
    setProfile(nexcardDemoProfile);
    setSavedAt('Demo restaurada');
  };

  const markSaved = () => {
    setSavedAt('Cambios aplicados en la vista demo');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl sticky top-0 z-30">
        <div className="w-[calc(100%_-_40px)] max-w-[1180px] mx-auto min-h-[68px] flex items-center justify-between gap-4">
          <a href="/preview" className="inline-flex items-center gap-2 text-sm font-black text-zinc-300 hover:text-white min-h-[44px]">
            <ArrowLeft size={16} />
            Volver a NexCard
          </a>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
            <Smartphone size={14} />
            Demo editable
          </div>
        </div>
      </header>

      <main className="w-[calc(100%_-_32px)] max-w-[1180px] mx-auto py-8 md:py-12 grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <aside className="rounded-[26px] border border-zinc-800 bg-zinc-900 p-5 md:p-6 lg:sticky lg:top-24">
          <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.18em] mb-3">Perfil demo NexCard</p>
          <h1 className="text-[clamp(2.1rem,4.8vw,4.2rem)] font-bold leading-none tracking-[-0.06em] mb-4">Edita los datos y mira el perfil al instante.</h1>
          <p className="text-zinc-400 leading-relaxed mb-5">Esta demo no guarda datos reales ni toca Supabase. Sirve para mostrar cómo un cliente puede ajustar su perfil antes de compartirlo por NFC, QR o link.</p>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 mb-5 break-all">
            URL demo: <span className="text-zinc-200 font-bold">{publicUrl}</span>
          </div>

          <div className="grid gap-3">
            {demoEditableFields.map((field) => (
              <label key={field.key} className="grid gap-1.5 text-sm font-bold text-zinc-300">
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea
                    value={profile[field.key] || ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    rows={4}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={profile[field.key] || ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button onClick={markSaved} className="btn-base btn-press inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl btn-primary">
              <Save size={16} />
              Aplicar demo
            </button>
            <button onClick={resetDemo} className="btn-press inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 font-black text-white hover:bg-zinc-700">
              <RotateCcw size={16} />
              Restaurar
            </button>
          </div>
          {savedAt && <p className="mt-3 text-sm font-bold text-emerald-300">{savedAt}</p>}
        </aside>

        <section aria-label="Vista previa del perfil demo" className="mx-auto w-full max-w-[460px] rounded-[34px] border border-zinc-800 bg-black p-2 shadow-2xl shadow-black/50">
          <div className="overflow-hidden rounded-[28px] border border-zinc-800">
            <NexCardProfile data={profile} />
          </div>
        </section>
      </main>
    </div>
  );
}
