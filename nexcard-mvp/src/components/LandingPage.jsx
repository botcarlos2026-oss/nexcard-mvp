import React from 'react';
import {
  Smartphone,
  Zap,
  ChevronRight,
  ShieldCheck,
  Globe,
  Phone
} from 'lucide-react';
import { defaultLandingContent } from '../utils/defaultData';

const LandingPage = ({ content = defaultLandingContent }) => {
  const primaryColor = '#10B981';
  const title = content.heroTitle || defaultLandingContent.heroTitle;
  const accent = content.heroAccent || defaultLandingContent.heroAccent;
  const titleBase = title.replace(accent, '').trim();

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="font-black text-xl tracking-tight">NexCard</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-bold text-zinc-500">
            <a href="#ventajas" className="hover:text-emerald-500 transition-colors">Ventajas</a>
            <a href="#planes" className="hover:text-emerald-500 transition-colors">Planes</a>
            <a href="#faq" className="hover:text-emerald-500 transition-colors">FAQ</a>
          </div>
          <button
            onClick={() => { window.location.href = '/login'; }}
            className="px-6 py-2.5 rounded-full text-white font-bold text-sm transition-all hover:scale-105 shadow-xl shadow-emerald-200"
            style={{ backgroundColor: primaryColor }}
          >
            Ingresar al Panel
          </button>
        </div>
      </nav>

      <section className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {content.heroBadge}
            </div>
            <h1 className="text-6xl md:text-7xl font-black leading-[1.05] tracking-tighter text-zinc-950">
              {titleBase} <span className="text-emerald-500">{accent}</span>
            </h1>
            <p className="mt-8 text-xl text-zinc-500 leading-relaxed max-w-lg font-medium">
              {content.heroDescription}
            </p>
            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => { window.location.href = '/setup'; }}
                className="px-8 py-5 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 transition-all hover:shadow-2xl hover:shadow-emerald-200 active:scale-95"
                style={{ backgroundColor: primaryColor }}
              >
                {content.primaryCta}
                <ChevronRight size={20} />
              </button>
              <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-zinc-200"></div>
                  ))}
                </div>
                <div className="text-xs font-bold">
                  <span className="text-zinc-950">{content.socialProof}</span>
                  <br />
                  <span className="text-zinc-400 font-medium tracking-tight">Landing editable, panel y operación centralizada</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/10 blur-[100px] rounded-full"></div>
            <div className="relative bg-zinc-900 aspect-[4/5] md:aspect-[3/4] rounded-[40px] shadow-2xl p-8 border border-white/10 overflow-hidden transform rotate-2">
              <div className="bg-zinc-800/50 rounded-2xl p-6 text-white h-full border border-white/5">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto mb-6"></div>
                <div className="h-6 w-32 bg-white/20 rounded-full mx-auto mb-2"></div>
                <div className="h-4 w-48 bg-white/10 rounded-full mx-auto mb-10"></div>
                <div className="space-y-3">
                  <div className="h-14 bg-emerald-500 rounded-xl"></div>
                  <div className="h-14 bg-white/5 rounded-xl"></div>
                  <div className="h-14 bg-white/5 rounded-xl"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ventajas" className="py-24 px-6 bg-zinc-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-zinc-950 tracking-tight">Diseñada para vender y operar.</h2>
            <p className="mt-4 text-zinc-500 font-medium">No solo una tarjeta bonita: una plataforma escalable para personas, pymes y empresas.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Smartphone size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Perfil Editable</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Cada cliente puede editar nombre, foto, color, WhatsApp, agenda y datos clave sin rehacer la tarjeta física.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Operación Centralizada</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Administra perfiles, pedidos e inventario desde un solo panel. Menos fricción operativa, más control del margen.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Escalable</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Base lista para checkout, CMS, analytics y activación de tarjetas sin botar el código en la siguiente etapa.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto p-12 rounded-[40px] bg-zinc-950 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[80px] rounded-full"></div>
          <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">{content.finalCtaTitle}</h2>
          <button
            onClick={() => { window.location.href = '/login'; }}
            className="px-10 py-5 rounded-2xl text-white font-black text-xl transition-all hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            {content.finalCtaButton}
          </button>
          <p className="mt-8 text-zinc-500 text-sm font-bold flex items-center justify-center gap-2">
            <ShieldCheck size={16} /> Checkout futuro con Webpay y Mercado Pago
          </p>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-zinc-100 text-center text-zinc-400 text-xs font-bold tracking-widest uppercase">
        © 2026 NexCard Chile - Una marca de Grupo Alvarez SpA
      </footer>

      <a
        href="https://wa.me/56912345678?text=Hola!%20Quiero%20mi%20NexCard"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-[100] active:scale-95"
      >
        <Phone size={32} fill="currentColor" />
      </a>
    </div>
  );
};

export default LandingPage;
