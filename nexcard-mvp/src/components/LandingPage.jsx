import React, { useState, useEffect } from 'react';
import { Zap, Share2, BarChart2, Shield, CheckCircle, ArrowRight, Smartphone, Linkedin, Mail, ChevronDown, MessageCircle } from 'lucide-react';
import { api } from '../services/api';
import DiscountWheel from './DiscountWheel';

const FEATURES = [
  { icon: <Zap size={22} className="text-emerald-400" />, title: 'Comparte al instante', description: 'Un toque con tu tarjeta NFC y tu contacto completo aparece en el teléfono de tu cliente. Sin apps, sin fricción.' },
  { icon: <Share2 size={22} className="text-emerald-400" />, title: 'Perfil digital completo', description: 'Nombre, cargo, empresa, redes sociales, WhatsApp y más — todo en una página personalizada con tu marca.' },
  { icon: <BarChart2 size={22} className="text-emerald-400" />, title: 'Actualizable siempre', description: 'Cambias de cargo, número o empresa? Actualiza tu perfil en segundos. La tarjeta física nunca queda obsoleta.' },
  { icon: <Shield size={22} className="text-emerald-400" />, title: 'Compatible con todos', description: 'Funciona con iPhone y Android sin necesidad de instalar nada. Solo acercar y compartir.' },
];

// Metadata estático por SKU — precios vienen de Supabase (price_cents)
// SKUs activos: BASIC-5 ($89.990), PREMIUM-5 ($79.990), PREMIUM-10 ($149.990), PREMIUM-20 ($269.990)
const PRICING_META = {
  'NEXCARD-1':  { name: 'Solo',       cards: 1,  description: 'Para empezar a probar el formato', highlight: false, features: ['1 tarjeta NFC', 'Perfil digital', 'Activación guiada', 'Soporte por email'] },
  'BASIC-5':    { name: 'Starter',    cards: 5,  description: 'Ideal para profesionales independientes', highlight: false, features: ['5 tarjetas NFC', 'Perfil digital por tarjeta', 'Activación guiada', 'Soporte por email'] },
  'PREMIUM-5':  { name: 'Plus',       cards: 5,  description: 'El más popular para emprendedores',       highlight: false, features: ['5 tarjetas NFC premium', 'Perfil personalizado', 'Analítica básica', 'Soporte prioritario'] },
  'PREMIUM-10': { name: 'Business',   cards: 10, description: 'Para equipos de ventas en crecimiento',   highlight: true,  badge: 'Más popular', features: ['10 tarjetas NFC premium', 'Perfiles personalizados', 'Analítica avanzada', 'Soporte prioritario', 'Dashboard de equipo'] },
  'PREMIUM-20': { name: 'Enterprise', cards: 20, description: 'La mejor relación precio-volumen',        highlight: false, features: ['20 tarjetas NFC premium', 'Perfiles personalizados', 'Analítica avanzada', 'Soporte dedicado', 'Dashboard de equipo', 'Onboarding asistido'] },
};

// Fallback si Supabase no responde
const PRICING_FALLBACK = [
  { sku: 'NEXCARD-1',  price: 19990 },
  { sku: 'BASIC-5',    price: 79990 },
  { sku: 'PREMIUM-5',  price: 79990 },
  { sku: 'PREMIUM-10', price: 149990 },
  { sku: 'PREMIUM-20', price: 269990 },
];

const STEPS = [
  { num: '01', title: 'Elige tu pack', desc: 'Selecciona la cantidad de tarjetas que necesitas según el tamaño de tu equipo.' },
  { num: '02', title: 'Recíbelas en casa', desc: 'Despachamos a todo Chile. Recibes tus tarjetas NFC listas para activar.' },
  { num: '03', title: 'Activa y personaliza', desc: 'Configura tu perfil digital en minutos desde cualquier dispositivo.' },
  { num: '04', title: 'Comparte al instante', desc: 'Acerca tu tarjeta a cualquier smartphone y comparte tu contacto al toque.' },
];

function TeamMemberCard({ member }) {
  const [imgError, setImgError] = useState(false);
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center text-center p-6 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors">
      {member.photo_url && !imgError ? (
        <img src={member.photo_url} alt={member.name} onError={() => setImgError(true)} className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-zinc-800" />
      ) : (
        <div className="w-24 h-24 rounded-full bg-emerald-900 border-2 border-emerald-800 flex items-center justify-center mb-4">
          <span className="text-emerald-300 text-2xl font-bold">{initials}</span>
        </div>
      )}
      <p className="font-bold text-lg mb-0.5">{member.name}</p>
      <p className="text-zinc-400 text-sm mb-3">{member.role}</p>
      {member.bio && <p className="text-zinc-500 text-xs mb-4 leading-relaxed">{member.bio}</p>}
      <div className="flex items-center gap-3 mt-auto">
        {member.linkedin_url && (
          <a href={member.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" aria-label="LinkedIn">
            <Linkedin size={18} />
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} className="text-zinc-400 hover:text-white transition-colors" aria-label="Email">
            <Mail size={18} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function LandingPage({ content = {}, onCheckoutStart }) {
  const [slug, setSlug] = useState('');
  const [pricing, setPricing] = useState(() =>
    PRICING_FALLBACK.map((p) => ({ ...p, ...PRICING_META[p.sku], perUnit: Math.round(p.price / (PRICING_META[p.sku]?.cards || 1)) }))
  );
  const [teamMembers, setTeamMembers] = useState([]);
  const [showWheel, setShowWheel] = useState(false);
  const [wheelData, setWheelData] = useState(null);
  const formatPrice = (n) => n.toLocaleString('es-CL');

  useEffect(() => {
    api.getProducts().then((products) => {
      if (!products?.length) return;
      const sorted = [...products].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const merged = sorted.map((dbProduct) => {
        const meta = PRICING_META[dbProduct.sku] || {};
        const isPopular = dbProduct.popular ?? meta.highlight ?? false;
        return {
          sku: dbProduct.sku,
          price: dbProduct.price_cents,
          perUnit: Math.round(dbProduct.price_cents / (meta.cards || 1)),
          ...meta,
          highlight: isPopular,
          badge: isPopular ? (meta.badge || 'Más popular') : undefined,
        };
      });
      setPricing(merged);
    }).catch(() => { /* mantener fallback */ });
  }, []);

  useEffect(() => {
    api.getTeamMembers().then(({ members }) => setTeamMembers(members)).catch(() => {});
  }, []);

  useEffect(() => {
    const hasSpun = localStorage.getItem('nx_wheel_spun');
    if (hasSpun) return;
    api.getActiveWheel().then(({ wheel }) => {
      if (wheel?.show_on_first_visit && (wheel?.wheel_prizes || []).filter(p => p.active).length >= 2) {
        setWheelData(wheel);
        setTimeout(() => setShowWheel(true), 2000);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll('.pricing-reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.1 }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <nav className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-logo)' }}>Nex<span className="text-emerald-400">Card</span></span>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-3 min-h-[44px] inline-flex items-center">Iniciar sesión</a>
          <button onClick={onCheckoutStart} className="btn-press text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 min-h-[44px] rounded-lg transition-colors">Comprar</button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-3xl translate-x-1/2 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
        </div>
        <div className="hero-content relative max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <Smartphone size={12} />
            Tarjeta NFC · Compatible con iPhone y Android
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05] tracking-tight">
            Tu tarjeta de visita<br />
            <span className="text-emerald-400">del siglo XXI</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Comparte tu contacto completo con un solo toque. Sin apps, sin papel, sin quedarte sin tarjetas. Actualiza tu información cuando quieras.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onCheckoutStart} className="btn-press inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/40 text-base">
              Ver precios y packs
              <ArrowRight size={18} />
            </button>
            <button onClick={() => window.location.href = '/carlos'} className="btn-press inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors border border-zinc-700 text-base">
              Ver perfil demo
            </button>
          </div>
          <p className="mt-10 text-sm text-zinc-500">Despacho a todo Chile · Activación en minutos · Sin contratos</p>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas para networking profesional</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Una sola tarjeta reemplaza cientos de tarjetas de papel y siempre está actualizada.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-7 transition-colors flex gap-5 items-start">
                <div className="w-10 h-10 bg-emerald-950 border border-emerald-900 rounded-lg flex items-center justify-center shrink-0">{f.icon}</div>
                <div>
                  <h3 className="font-bold mb-1.5">{f.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-semibold mb-3">¿Ya eres cliente NexCard? Accede a tu perfil</h2>
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && slug.trim() && (window.location.href = `/${slug.trim()}`)}
              placeholder="tu-slug"
              aria-label="Buscar perfil por slug"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 w-48 transition-colors min-h-[44px]"
            />
            <button
              onClick={() => slug.trim() && (window.location.href = `/${slug.trim()}`)}
              className="btn-press text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 rounded-lg border border-zinc-700 transition-colors whitespace-nowrap min-h-[44px] inline-flex items-center"
            >
              Ver perfil →
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-24 px-6 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Cómo funciona</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">De tu pedido a compartir tu contacto en menos de 48 horas</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {STEPS.map((step) => (
              <div key={step.num}>
                <div className="text-5xl font-black text-emerald-400/15 mb-4 leading-none">{step.num}</div>
                <p className="font-bold mb-2 text-base">{step.title}</p>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-zinc-800/60 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-zinc-600 text-xs uppercase tracking-widest mb-12">Profesionales que ya dejaron el papel atrás</p>
          <div className="grid grid-cols-3 gap-6 mb-14 max-w-lg mx-auto">
            <div>
              <p className="text-3xl font-bold text-emerald-400">+500</p>
              <p className="text-zinc-500 text-xs mt-1.5 leading-snug">tarjetas activadas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">48h</p>
              <p className="text-zinc-500 text-xs mt-1.5 leading-snug">tiempo de entrega</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">100%</p>
              <p className="text-zinc-500 text-xs mt-1.5 leading-snug">compatible iPhone y Android</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { quote: 'Lo instalé en 5 minutos y mis clientes quedaron impresionados. Nunca más olvidé repartir tarjetas.', name: 'Rodrigo M.', role: 'Consultor independiente' },
              { quote: 'Equipamos a todo el equipo de ventas. Profesional, moderno y nada de papel desechable.', name: 'Valentina S.', role: 'Gerenta comercial' },
              { quote: 'La instalé en el mesón y ahora cada cliente que paga me pide el contacto. Increíble herramienta.', name: 'Felipe A.', role: 'Dueño de café' },
            ].map((t, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left">
                <p className="text-zinc-300 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <p className="text-white font-bold text-sm">{t.name}</p>
                <p className="text-zinc-500 text-xs">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TEAM SECTION ============ */}
      {teamMembers.length > 0 && (
        <section className="border-t border-zinc-800/60 py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Quiénes trabajan con nosotros</h2>
              <p className="text-zinc-400">El equipo detrás de NexCard</p>
            </div>
            <div className={`grid gap-6 ${
              teamMembers.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' :
              teamMembers.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-md mx-auto' :
              teamMembers.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
              'grid-cols-2 lg:grid-cols-4'
            }`}>
              {teamMembers.map(member => <TeamMemberCard key={member.id} member={member} />)}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-zinc-800/60 py-24 px-6" id="precios">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes y precios</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">A mayor volumen, mejor precio por unidad. Elige el pack que se adapta a tu equipo.</p>
          </div>
          <div className="pricing-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pricing.map((plan) => (
              <div key={plan.sku} className={`pricing-card pricing-reveal relative rounded-xl p-7 flex flex-col ${plan.highlight ? 'bg-emerald-950 border-2 border-emerald-500 shadow-lg shadow-emerald-900/30' : 'bg-zinc-900 border border-zinc-800'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-emerald-400">${formatPrice(plan.price)}</span>
                  <p className="text-zinc-500 text-xs mt-1.5">${formatPrice(plan.perUnit)} por tarjeta · {plan.cards} unidades</p>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button onClick={onCheckoutStart} className={`btn-press w-full py-3 rounded-lg font-bold text-sm transition-colors ${plan.highlight ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'}`}>
                  Comprar pack
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="border-t border-zinc-800/60 py-20 sm:py-24 px-6 bg-zinc-950">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Preguntas frecuentes</h2>
            <p className="text-zinc-400">Todo lo que necesitas saber antes de comprar</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {[
              { q: '¿Cómo funciona la tarjeta NFC?', a: 'La tarjeta NFC contiene un chip que, al acercarla a un smartphone con NFC activado, abre automáticamente tu perfil digital en el navegador. No necesitas instalar nada.' },
              { q: '¿Es compatible con iPhone y Android?', a: 'Sí, funciona con todos los iPhones desde el iPhone XS (2018) en adelante con iOS 13+ y prácticamente todos los Android con NFC activado. Si el dispositivo no tiene NFC, también incluye un código QR de respaldo.' },
              { q: '¿Necesito una app para usarla?', a: 'No. Tu cliente solo acerca su teléfono a la tarjeta y ve tu perfil al instante en su navegador. Tú tampoco necesitas app: gestionas tu perfil desde nexcard.cl en cualquier navegador.' },
              { q: '¿Qué pasa si pierdo mi tarjeta?', a: 'Tu perfil digital sigue activo. Puedes pedir una tarjeta de reemplazo desde nexcard.cl con un descuento del 50%. Solo escríbenos a hola@nexcard.cl con tu número de orden.' },
              { q: '¿Puedo actualizar mi información después?', a: 'Sí. Puedes editar tu perfil cuantas veces quieras desde tu cuenta NexCard. Los cambios son inmediatos — la próxima persona que toque tu tarjeta verá la información actualizada.' },
              { q: '¿Cuánto demora el despacho?', a: 'Entre 5 y 7 días hábiles a todo Chile. Despachamos vía Starken o Chilexpress y recibirás un email con el número de seguimiento cuando salga tu pedido.' },
              { q: '¿Hacen factura para empresas?', a: 'Sí. En el checkout puedes activar "Necesito factura" e ingresar el RUT y razón social de tu empresa. La factura electrónica te llegará por email después de la compra.' },
              { q: '¿Qué métodos de pago aceptan?', a: 'Aceptamos pagos vía Mercado Pago: tarjetas de crédito, débito, transferencia bancaria y cuotas sin interés según promociones de tu banco. Próximamente también WebPay.' },
              { q: '¿Tiene devolución?', a: 'Sí, tienes 10 días hábiles desde la recepción para solicitar devolución según la Ley del Consumidor 19.496. La tarjeta debe estar en buen estado y sin programar.' },
              { q: '¿La tarjeta tiene QR de respaldo?', a: 'Sí. Cada tarjeta incluye un QR impreso al reverso que apunta al mismo perfil digital, en caso de que el smartphone del receptor no tenga NFC.' },
            ].map((item, i) => (
              <details key={i} className="group py-1">
                <summary className="cursor-pointer flex items-center justify-between py-5 px-4 text-base font-semibold text-white list-none">
                  {item.q}
                  <ChevronDown size={18} className="text-zinc-400 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="text-sm text-zinc-400 leading-relaxed pb-5 px-4 pt-0">{item.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="https://wa.me/56993183021?text=Hola,%20tengo%20una%20pregunta%20sobre%20NexCard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium"
            >
              <MessageCircle size={16} />
              ¿Tienes otra pregunta? Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Listo para modernizar tu networking</h2>
          <p className="text-zinc-400 mb-8">Únete a los profesionales que ya dejaron las tarjetas de papel atrás.</p>
          <button onClick={onCheckoutStart} className="btn-press inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/40 text-base">
            Ver packs y precios
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="border-t border-zinc-800/60 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-zinc-400">
          {['✓ Empresa chilena','✓ Despacho a todo Chile','✓ Devolución en 10 días','✓ Pago 100% seguro'].map(item => (
            <span key={item} className="flex items-center gap-1">{item}</span>
          ))}
          <a href="https://wa.me/56993183021" className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
            💬 +56 9 9318 3021
          </a>
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-logo)' }}>Nex<span className="text-emerald-400">Card</span></span>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>© 2026 NexCard</span>
            <span>·</span>
            <a href="/terminos" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Términos</a>
            <span>·</span>
            <a href="/privacidad" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Privacidad</a>
            <span>·</span>
            <a href="https://wa.me/56993183021" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Contacto</a>
          </div>
          <a href="https://wa.me/56993183021" target="_blank" rel="noreferrer" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">
            💬 WhatsApp
          </a>
        </div>
      </footer>

      {/* Wheel modal */}
      {showWheel && wheelData && (
        <DiscountWheel wheel={wheelData} onClose={() => setShowWheel(false)} />
      )}

      {/* Floating gift button */}
      {wheelData?.show_floating_button && !showWheel && (
        <button
          onClick={() => setShowWheel(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
          aria-label="Abrir ruleta de descuentos"
        >
          🎁
        </button>
      )}

    </div>
  );
}
