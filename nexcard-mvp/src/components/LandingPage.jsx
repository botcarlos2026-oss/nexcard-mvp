import React, { useState } from 'react';
import { Zap, Share2, BarChart2, Shield, CheckCircle, ArrowRight, Smartphone } from 'lucide-react';

const FEATURES = [
  { icon: <Zap size={22} className="text-emerald-400" />, title: 'Comparte al instante', description: 'Un toque con tu tarjeta NFC y tu contacto completo aparece en el teléfono de tu cliente. Sin apps, sin fricción.' },
  { icon: <Share2 size={22} className="text-emerald-400" />, title: 'Perfil digital completo', description: 'Nombre, cargo, empresa, redes sociales, WhatsApp y más — todo en una página personalizada con tu marca.' },
  { icon: <BarChart2 size={22} className="text-emerald-400" />, title: 'Actualizable siempre', description: 'Cambias de cargo, número o empresa? Actualiza tu perfil en segundos. La tarjeta física nunca queda obsoleta.' },
  { icon: <Shield size={22} className="text-emerald-400" />, title: 'Compatible con todos', description: 'Funciona con iPhone y Android sin necesidad de instalar nada. Solo acercar y compartir.' },
];

const PRICING = [
  { sku: 'BASIC-5', name: 'Básico', cards: 5, price: 89990, perUnit: 17998, description: 'Ideal para equipos pequeños o para empezar', highlight: false, features: ['5 tarjetas NFC', 'Perfil digital por tarjeta', 'Soporte por email'] },
  { sku: 'PREMIUM-5', name: 'Premium 5', cards: 5, price: 79990, perUnit: 15998, description: 'El más popular para emprendedores', highlight: false, features: ['5 tarjetas NFC premium', 'Perfil personalizado', 'Analítica básica', 'Soporte prioritario'] },
  { sku: 'PREMIUM-10', name: 'Premium 10', cards: 10, price: 149990, perUnit: 14999, description: 'Para equipos de ventas en crecimiento', highlight: true, badge: 'Más popular', features: ['10 tarjetas NFC premium', 'Perfiles personalizados', 'Analítica avanzada', 'Soporte prioritario', 'Dashboard de equipo'] },
  { sku: 'PREMIUM-20', name: 'Premium 20', cards: 20, price: 269990, perUnit: 13499, description: 'La mejor relación precio-volumen', highlight: false, features: ['20 tarjetas NFC premium', 'Perfiles personalizados', 'Analítica avanzada', 'Soporte dedicado', 'Dashboard de equipo', 'Onboarding asistido'] },
];

const STEPS = [
  { num: '01', title: 'Elige tu pack', desc: 'Selecciona la cantidad de tarjetas que necesitas según el tamaño de tu equipo.' },
  { num: '02', title: 'Recíbelas en casa', desc: 'Despachamos a todo Chile. Recibes tus tarjetas NFC listas para activar.' },
  { num: '03', title: 'Activa y personaliza', desc: 'Configura tu perfil digital en minutos desde cualquier dispositivo.' },
  { num: '04', title: 'Comparte al instante', desc: 'Acerca tu tarjeta a cualquier smartphone y comparte tu contacto al toque.' },
];

export default function LandingPage({ content = {}, onCheckoutStart }) {
  const [slug, setSlug] = useState('');
  const formatPrice = (n) => n.toLocaleString('es-CL');

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <nav className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <span className="text-xl font-black tracking-tight">Nex<span className="text-emerald-400">Card</span></span>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5">Iniciar sesión</a>
          <button onClick={onCheckoutStart} className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg transition-colors">Comprar</button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-3xl translate-x-1/2 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/6 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <Smartphone size={12} />
            Tarjeta NFC · Compatible con iPhone y Android
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
            Tu tarjeta de visita<br />
            <span className="text-emerald-400">del siglo XXI</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Comparte tu contacto completo con un solo toque. Sin apps, sin papel, sin quedarte sin tarjetas. Actualiza tu información cuando quieras.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onCheckoutStart} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 text-base">
              Ver precios y packs
              <ArrowRight size={18} />
            </button>
            <button onClick={onCheckoutStart} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-all border border-zinc-700 text-base">
              Ver precios
            </button>
          </div>
          <p className="mt-10 text-sm text-zinc-500">Despacho a todo Chile · Activación en minutos · Sin contratos</p>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Todo lo que necesitas para networking profesional</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Una sola tarjeta reemplaza cientos de tarjetas de papel y siempre está actualizada.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-6 transition-colors">
                <div className="w-10 h-10 bg-emerald-950 border border-emerald-900 rounded-lg flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-20 px-6 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Cómo funciona</h2>
            <p className="text-zinc-400">De tu pedido a compartir tu contacto en menos de 48 horas</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div key={step.num}>
                <div className="text-4xl font-black text-emerald-400/20 mb-3">{step.num}</div>
                <h3 className="font-bold mb-2 text-base">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-20 px-6" id="precios">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Planes y precios</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">A mayor volumen, mejor precio por unidad. Elige el pack que se adapta a tu equipo.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING.map((plan) => (
              <div key={plan.sku} className={`relative rounded-xl p-6 flex flex-col transition-all ${plan.highlight ? 'bg-emerald-950 border-2 border-emerald-500 shadow-lg shadow-emerald-900/30' : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-black text-lg mb-1">{plan.name}</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">{plan.description}</p>
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-black text-emerald-400">${formatPrice(plan.price)}</span>
                  <p className="text-zinc-500 text-xs mt-1">${formatPrice(plan.perUnit)} por tarjeta · {plan.cards} unidades</p>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button onClick={onCheckoutStart} className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${plan.highlight ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'}`}>
                  Comprar pack
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Listo para modernizar tu networking</h2>
          <p className="text-zinc-400 mb-8">Únete a los profesionales que ya dejaron las tarjetas de papel atrás.</p>
          <button onClick={onCheckoutStart} className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 text-base">
            Ver packs y precios
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ============ GOOGLE REVIEWS CARD SECTION ============ */}
      <section className="border-t border-zinc-800/60 py-24 px-6 bg-zinc-900/20" id="reviews-card">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span>★</span>
              Nuevo producto — Google Reviews Card · NexReview
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
              Más reseñas.<br />
              <span className="text-blue-400">Más clientes.</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Una tarjeta NFC que tus clientes tocan con el teléfono y en segundos están dejando una reseña en Google. Sin fricción, sin buscar, sin olvidar.
            </p>
          </div>

          {/* Beneficios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: '⭐',
                title: 'Más reseñas en Google',
                desc: 'El 90% de los clientes no deja reseñas porque el proceso es tedioso. Con un toque, el proceso dura 15 segundos.',
              },
              {
                icon: '👁️',
                title: 'Más visibilidad local',
                desc: 'Más reseñas = mejor posicionamiento en Google Maps. Tus clientes te encuentran antes que a la competencia.',
              },
              {
                icon: '💬',
                title: 'Más confianza, más ventas',
                desc: 'El 88% de los consumidores confía en reseñas online igual que en recomendaciones personales.',
              },
            ].map((b, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 hover:border-blue-500/40 rounded-xl p-6 transition-colors">
                <div className="text-3xl mb-4">{b.icon}</div>
                <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Cómo funciona */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-16">
            <h3 className="text-2xl font-black text-center mb-10">¿Cómo funciona?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              {[
                { num: '01', title: 'Cliente paga', desc: 'Selecciona tu pack y recibe tus tarjetas en casa.' },
                { num: '02', title: 'Tú envías tu link', desc: 'Nos mandas tu URL de reseñas de Google. La programamos en todas tus tarjetas.' },
                { num: '03', title: 'Ubica la tarjeta', desc: 'Pon la tarjeta en caja, mostrador o mesa. Con logo Google y QR impreso.' },
                { num: '04', title: 'Clientes reseñan', desc: 'Tocan con su teléfono → directo a tu página de reseñas. En 15 segundos.' },
              ].map((step) => (
                <div key={step.num} className="text-center">
                  <div className="text-3xl font-black text-blue-400/30 mb-2">{step.num}</div>
                  <h4 className="font-bold mb-1 text-sm">{step.title}</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Precios */}
          <div className="text-center mb-10">
            <h3 className="text-2xl font-black mb-2">Elige tu pack</h3>
            <p className="text-zinc-400 text-sm">A mayor volumen, mejor precio por unidad</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              { name: 'Starter', units: 1, price: 5990, perUnit: 5990, highlight: false, features: ['1 tarjeta NFC', 'Logo Google impreso', 'QR personalizado', 'Link programado'] },
              { name: 'Negocio', units: 3, price: 14990, perUnit: 4997, highlight: false, features: ['3 tarjetas NFC', 'Logo Google impreso', 'QR personalizado', 'Link programado', 'Ahorra $2.980'] },
              { name: 'Pro', units: 5, price: 22990, perUnit: 4598, highlight: true, badge: 'Más popular', features: ['5 tarjetas NFC', 'Logo Google impreso', 'QR personalizado', 'Link programado', 'Ahorra $6.960'] },
              { name: 'Equipo', units: 10, price: 39990, perUnit: 3999, highlight: false, features: ['10 tarjetas NFC', 'Logo Google impreso', 'QR personalizado', 'Link programado', 'Ahorra $19.910'] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl p-6 flex flex-col transition-all ${
                  plan.highlight
                    ? 'bg-blue-950 border-2 border-blue-500 shadow-lg shadow-blue-900/30'
                    : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
                  </div>
                )}
                <div className="mb-4">
                  <h4 className="font-black text-lg mb-1">{plan.name}</h4>
                  <p className="text-zinc-400 text-xs">{plan.units} {plan.units === 1 ? 'tarjeta' : 'tarjetas'} NFC</p>
                </div>
                <div className="mb-5">
                  <span className={`text-3xl font-black ${plan.highlight ? 'text-blue-400' : 'text-blue-400'}`}>
                    ${plan.price.toLocaleString('es-CL')}
                  </span>
                  <p className="text-zinc-500 text-xs mt-1">${plan.perUnit.toLocaleString('es-CL')} por tarjeta</p>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="text-blue-400 text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onCheckoutStart}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-blue-500 hover:bg-blue-400 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                >
                  Pedir pack
                </button>
              </div>
            ))}
          </div>

          {/* CTA reviews */}
          <div className="text-center bg-zinc-900 border border-zinc-800 rounded-2xl p-10">
            <p className="text-zinc-400 text-sm mb-2">¿Tienes preguntas sobre Google Reviews Card?</p>
            <p className="text-white font-bold text-lg mb-6">Escríbenos y te ayudamos a configurar tu primer tarjeta.</p>
            <a
              href="https://wa.me/56993183021"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors text-sm"
            >
              💬 Contactar por WhatsApp
            </a>
          </div>

        </div>
      </section>

      <footer className="border-t border-zinc-800/60 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <span className="text-lg font-black">Nex<span className="text-emerald-400">Card</span></span>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>© 2026 NexCard</span>
            <span>·</span>
            <a href="/privacidad" className="hover:text-zinc-300 transition-colors">Términos</a>
            <span>·</span>
            <a href="/privacidad" className="hover:text-zinc-300 transition-colors">Privacidad</a>
            <span>·</span>
            <a href="/privacidad" className="hover:text-zinc-300 transition-colors">Contacto</a>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && slug.trim() && (window.location.href = `/${slug.trim()}`)}
              placeholder="mi-perfil"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 w-32"
            />
            <button onClick={() => slug.trim() && (window.location.href = `/${slug.trim()}`)} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors whitespace-nowrap">
              Ver perfil
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
