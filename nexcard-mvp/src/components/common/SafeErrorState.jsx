import React from 'react';

export default function SafeErrorState({
  eyebrow = 'NexCard',
  title,
  message,
  actionLabel = 'Volver al inicio',
  actionHref = '/preview',
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white grid place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300 mb-4">{eyebrow}</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">{title}</h1>
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed mb-7">{message}</p>
        <a
          href={actionHref}
          className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 font-bold text-zinc-950 transition-colors hover:bg-emerald-300"
        >
          {actionLabel}
        </a>
      </section>
    </main>
  );
}
