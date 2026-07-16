import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, ChevronDown, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { api } from '../services/api';
import DiscountWheel from './DiscountWheel';

// Metadata estático por SKU — precios vienen de Supabase (price_cents)
// SKUs activos: NEXCARD-1, BASIC-5, PREMIUM-10, PREMIUM-20
const PRICING_META = {
  'NEXCARD-1': {
    name: 'Individual',
    cards: 1,
    description: '1 tarjeta NexCard para empezar a compartir contacto sin fricción.',
    highlight: false,
    save: 'Pago único',
    cta: 'Comprar Individual',
    features: ['Tarjeta NFC', 'Perfil digital editable', 'Datos de banco y redes', 'QR dinámico'],
  },
  'BASIC-5': {
    name: 'Pack Emprendedor',
    cards: 5,
    description: 'Para socios, primeras ventas o un equipo pequeño.',
    highlight: false,
    save: 'Ideal para equipo inicial',
    cta: 'Comprar pack',
    features: ['5 tarjetas NFC', '5 perfiles editables', 'Activación guiada', 'Sin mensualidad'],
  },
  'PREMIUM-10': {
    name: 'Pack Socios',
    cards: 10,
    description: 'Para equipo fundador, ventas o atención comercial.',
    highlight: true,
    badge: 'Recomendado',
    save: 'Mejor equilibrio',
    cta: 'Comprar Pack Socios',
    features: ['10 tarjetas premium', 'Perfil por persona', 'Datos actualizables', 'Ideal para reuniones'],
  },
  'PREMIUM-20': {
    name: 'Pack Equipo',
    cards: 20,
    description: 'Para equipos comerciales que necesitan presencia consistente.',
    highlight: false,
    save: 'Mejor precio por unidad',
    cta: 'Comprar Equipo',
    features: ['20 tarjetas NFC + QR', 'Onboarding simple', 'Imagen consistente', 'Soporte dedicado'],
  },
};

// Fallback si Supabase no responde
const PRICING_FALLBACK = [
  { sku: 'NEXCARD-1', price: 19990 },
  { sku: 'BASIC-5', price: 79990 },
  { sku: 'PREMIUM-10', price: 149990 },
  { sku: 'PREMIUM-20', price: 269990 },
];

const FRICTION = [
  {
    label: 'El pasado',
    status: 'fricción',
    tone: 'neutral',
    items: [
      ['Dictar el RUT apurado', 'para una transferencia.'],
      ['Deletrear correos largos', 'en una reunión o feria.'],
      ['Tarjetas de papel', 'arrugadas, perdidas o desactualizadas.'],
    ],
  },
  {
    label: 'El efecto NexCard',
    status: 'un toque',
    tone: 'green',
    items: [
      ['Acercas la tarjeta', 'al celular del cliente.'],
      ['El perfil se abre', 'con contacto, redes y datos de banco.'],
      ['Editas online', 'y la tarjeta física sigue vigente.'],
    ],
  },
];

const STEPS = [
  { num: '01', title: 'Acerca', desc: 'Toca el teléfono de tu cliente con tu NexCard o muestra el QR de respaldo.' },
  { num: '02', title: 'Conecta', desc: 'Tu perfil digital personalizado se abre al instante, sin instalar aplicaciones.' },
  { num: '03', title: 'Actualiza', desc: 'Modifica banco, links, teléfono o redes desde nexcard.cl en tiempo real.' },
];

const FAQS = [
  { q: '¿Sirve para cualquier celular?', a: 'Sí. Funciona por NFC en equipos modernos iPhone y Android, y mediante código QR dinámico incorporado para celulares antiguos o con NFC desactivado.' },
  { q: '¿Tengo que pagar una mensualidad por usar la plataforma?', a: 'No. La plataforma nexcard.cl viene incluida con tu tarjeta física. Puedes actualizar tu perfil sin volver a imprimir.' },
  { q: '¿Cómo personalizo mis datos?', a: 'Al recibir tu tarjeta, escaneas un código de activación único para configurar tu perfil, contacto, redes y datos de banco en pocos minutos.' },
  { q: '¿Puedo pedir factura?', a: 'Sí. En el checkout puedes activar factura e ingresar RUT y razón social. La información queda asociada a tu pedido.' },
  { q: '¿Qué métodos de pago aceptan?', a: 'El checkout opera con Mercado Pago para tarjeta de crédito, débito y otros medios disponibles según tu cuenta/banco.' },
  { q: '¿La tarjeta tiene QR de respaldo?', a: 'Sí. Cada tarjeta puede incluir QR dinámico al reverso para que el contacto funcione incluso si el teléfono no lee NFC.' },
];

const BRAND_LOGO_STYLE = {
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

function TeamMemberCard({ member }) {
  const [imgError, setImgError] = useState(false);
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center text-center p-6 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors">
      {member.photo_url && !imgError ? (
        <img src={member.photo_url} alt={member.name} onError={() => setImgError(true)} className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-zinc-800" />
      ) : (
        <div className="w-24 h-24 rounded-3xl bg-emerald-950 border-2 border-emerald-800 flex items-center justify-center mb-4">
          <span className="text-emerald-300 text-2xl font-black">{initials}</span>
        </div>
      )}
      <p className="font-bold text-lg mb-0.5">{member.name}</p>
      <p className="text-zinc-400 text-sm mb-3">{member.role}</p>
      {member.bio && <p className="text-zinc-500 text-xs mb-4 leading-relaxed">{member.bio}</p>}
      <div className="flex items-center gap-3 mt-auto">
        {member.linkedin_url && (
          <a href={member.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" aria-label="LinkedIn">
            in
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

function SectionHead({ eyebrow, title, children }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr] lg:items-end mb-8 md:mb-10">
      <div>
        {eyebrow && <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.18em] mb-3">{eyebrow}</p>}
        <h2 className="text-[clamp(2.15rem,4.2vw,4rem)] font-bold tracking-[-0.06em] leading-none">{title}</h2>
      </div>
      {children && <p className="text-zinc-400 leading-relaxed">{children}</p>}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative min-h-[390px] sm:min-h-[440px]" aria-label="Tarjeta NexCard y teléfono mostrando perfil digital">
      <div className="absolute right-0 sm:right-5 top-0 w-[210px] sm:w-[238px] h-[420px] sm:h-[470px] rounded-[36px] bg-zinc-800 p-3 rotate-[4deg] shadow-2xl shadow-black/50">
        <div className="h-full rounded-[27px] bg-zinc-950 border border-zinc-700 overflow-hidden p-4 sm:p-5">
          <div className="h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-900" />
          <div className="w-16 h-16 -mt-7 ml-3 mb-3 rounded-2xl border-4 border-zinc-950 bg-zinc-900 grid place-items-center text-emerald-300 font-black">CA</div>
          <h3 className="font-black text-base leading-tight">Carlos Alvarez</h3>
          <p className="text-zinc-400 text-xs mb-4">Operaciones · Mas Medios</p>
          {['Guardar contacto', 'WhatsApp y redes', 'Datos de transferencia'].map((item) => (
            <div key={item} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 px-3 py-2.5 text-xs font-black mb-2">
              {item}
            </div>
          ))}
          <div className="grid gap-2 mt-5">
            <span className="h-2 rounded-full bg-zinc-800" />
            <span className="h-2 rounded-full bg-zinc-800 w-3/4" />
            <span className="h-2 rounded-full bg-zinc-800 w-1/2" />
          </div>
        </div>
      </div>
      <div className="absolute left-0 top-[118px] w-[min(360px,82vw)] sm:w-[390px] h-[218px] sm:h-[230px] rounded-[26px] p-6 bg-gradient-to-br from-zinc-800 to-black border border-zinc-700 -rotate-[8deg] shadow-2xl shadow-black/60">
        <div className="w-12 h-8 rounded-lg bg-yellow-700" />
        <div className="absolute top-6 right-6 text-emerald-300 text-xs font-black tracking-[0.18em]">NFC</div>
        <div className="absolute bottom-6 left-6 text-2xl font-black tracking-[-0.05em]">Nex<span className="text-emerald-300">Card</span></div>
        <div className="absolute right-6 bottom-7 text-zinc-500 text-xs text-right">negro mate<br />QR al reverso</div>
      </div>
    </div>
  );
}

function PricingCard({ plan, formatPrice, onCheckoutStart }) {
  return (
    <article className={`pricing-card relative rounded-[22px] p-[22px] flex flex-col min-h-[350px] ${plan.highlight ? 'bg-emerald-950/70 border border-emerald-500 shadow-2xl shadow-emerald-950/30' : 'bg-zinc-900 border border-zinc-800'}`}>
      {plan.badge && <span className="absolute -top-3 left-5 bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-black">{plan.badge}</span>}
      <h3 className="text-lg font-black mb-2">{plan.name}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed min-h-[42px] mb-[18px]">{plan.description}</p>
      <div className="text-3xl font-black tracking-[-0.05em] mb-1">${formatPrice(plan.price)}</div>
      <p className="text-emerald-300 text-sm font-black min-h-[20px]">{plan.save || `$${formatPrice(plan.perUnit)} por tarjeta · ${plan.cards} unidades`}</p>
      <ul className="grid gap-[10px] my-[22px] flex-1 text-sm text-zinc-300">
        {(plan.features || []).map((feat, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle size={15} className="text-emerald-300 shrink-0 mt-0.5" />
            {feat}
          </li>
        ))}
      </ul>
      <button
        onClick={onCheckoutStart}
        className={`btn-press w-full min-h-[46px] rounded-xl font-black transition-colors ${plan.highlight ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'}`}
      >
        {plan.cta || 'Comprar pack'}
      </button>
    </article>
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
  const formatPrice = (n) => Number(n || 0).toLocaleString('es-CL');

  useEffect(() => {
    api.getProducts().then((products) => {
      if (!products?.length) return;
      const sorted = [...products].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const merged = sorted.map((dbProduct) => {
        const meta = PRICING_META[dbProduct.sku] || {};
        const isPopular = dbProduct.popular ?? meta.highlight ?? false;
        const cards = meta.cards || Number(dbProduct.cards) || 1;
        return {
          sku: dbProduct.sku,
          price: dbProduct.price_cents,
          name: meta.name || dbProduct.name || 'NexCard',
          description: meta.description || dbProduct.description || 'Tarjeta NFC con perfil digital editable.',
          cards,
          features: meta.features || dbProduct.features || [],
          perUnit: Math.round((dbProduct.price_cents || 0) / cards),
          ...meta,
          highlight: isPopular,
          badge: isPopular ? (meta.badge || 'Recomendado') : undefined,
        };
      });
      setPricing(merged);
    }).catch(() => { /* mantener fallback */ });
  }, []);

  useEffect(() => {
    api.getTeamMembers().then(({ members }) => setTeamMembers(members || [])).catch(() => {});
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
  }, [pricing]);

  const heroTitle = content.hero_title || 'Tu última tarjeta de presentación. Elegante, eterna y digital.';
  const heroLead = content.hero_subtitle || 'Pasa tus datos de contacto, redes sociales y datos de transferencia a un solo toque (NFC). Cambia tu información en tiempo real cuando quieras, sin volver a imprimir jamás.';

  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      <nav className="sticky top-0 z-30 bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-xl">
        <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto min-h-[68px] flex items-center justify-between gap-4">
          <a href="#top" className="text-[1.35rem] font-black tracking-[-0.04em] leading-none" style={BRAND_LOGO_STYLE}>Nex<span className="text-emerald-300">Card</span></a>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <a href="#como" className="hidden md:inline hover:text-white transition-colors">Cómo funciona</a>
            <a href="#precios" className="hidden md:inline hover:text-white transition-colors">Precios</a>
            <a href="#faq" className="hidden md:inline hover:text-white transition-colors">FAQ</a>
            <button onClick={onCheckoutStart} className="btn-press min-h-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors">Comprar mi NexCard</button>
          </div>
        </div>
      </nav>

      <main id="top">
        <header className="border-b border-zinc-800 pt-[54px] pb-[72px] md:pt-[88px] md:pb-[72px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto grid gap-[58px] lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-3 py-1.5 text-xs font-black mb-5">
                <Smartphone size={13} />
                NFC + QR dinámico · sin apps
              </div>
              <h1 className="text-[3.05rem] md:text-[clamp(3rem,5.6vw,6.2rem)] font-bold leading-[0.94] tracking-[-0.07em] mb-[22px] max-w-[680px]">{heroTitle}</h1>
              <p className="text-lg md:text-[1.18rem] text-zinc-400 leading-[1.62] mb-[30px] max-w-[650px]">{heroLead}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={onCheckoutStart} className="btn-press inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors">
                  Comprar mi NexCard
                  <ArrowRight size={18} />
                </button>
                <a href="#friccion" className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black transition-colors">Ver la diferencia</a>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-sm text-zinc-500">
                <span>✓ Plataforma incluida</span>
                <span>✓ Pago seguro</span>
                <span>✓ iPhone, Android y QR</span>
              </div>
            </div>
            <HeroVisual />
          </div>
        </header>

        <section id="friccion" className="border-b border-zinc-800 py-16 md:py-[78px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <SectionHead title="Menos dictar datos. Más cerrar contactos.">
              La comparación es cotidiana: transferencia, correo, reunión y tarjeta de papel que deja de servir.
            </SectionHead>
            <div className="grid md:grid-cols-2 gap-4">
              {FRICTION.map((group) => (
                <article key={group.label} className={`rounded-[22px] border p-6 ${group.tone === 'green' ? 'border-emerald-500/40 bg-emerald-950/50' : 'border-zinc-800 bg-zinc-900'}`}>
                  <div className="flex items-center justify-between text-zinc-500 uppercase tracking-[0.14em] text-xs font-black mb-5">
                    <span>{group.label}</span>
                    <span>{group.status}</span>
                  </div>
                  <ul className="grid gap-4">
                    {group.items.map(([strong, rest]) => (
                      <li key={strong} className="text-zinc-300 leading-relaxed">
                        <span className="inline-grid place-items-center w-7 h-7 mr-2 rounded-lg bg-zinc-800 text-emerald-300 font-black">{group.tone === 'green' ? '✓' : '–'}</span>
                        <strong className="text-white">{strong}</strong> {rest}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como" className="border-b border-zinc-800 py-16 md:py-[78px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <SectionHead title="Cómo funciona.">Sin app, sin explicación larga, sin volver a imprimir cuando cambias tus datos.</SectionHead>
            <div className="grid md:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <article key={step.num} className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-6 min-h-[220px]">
                  <div className="text-6xl font-black leading-none text-emerald-300/15 mb-10">{step.num}</div>
                  <h3 className="text-2xl font-black mb-3">{step.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-800 py-12 md:py-14">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <SectionHead title="También para clientes actuales.">Si ya activaste tu tarjeta, entra directo a tu perfil público o inicia sesión para editarlo.</SectionHead>
            <div className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
              <div>
                <p className="font-black text-lg">Busca tu perfil digital</p>
                <p className="text-zinc-400 text-sm">Escribe tu slug público para abrirlo en este navegador.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && slug.trim() && (window.location.href = `/${slug.trim()}`)}
                  placeholder="tu-slug"
                  aria-label="Buscar perfil por slug"
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 w-44 min-h-[46px]"
                />
                <button onClick={() => slug.trim() && (window.location.href = `/${slug.trim()}`)} className="btn-press px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-black min-h-[46px]">Ver perfil</button>
              </div>
            </div>
          </div>
        </section>

        <section id="precios" className="border-b border-zinc-800 py-16 md:py-[78px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <SectionHead title="Precios simples.">Oferta directa con ahorro visible para empujar packs y facilitar la decisión.</SectionHead>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pricing.map((plan) => (
                <PricingCard key={plan.sku} plan={plan} formatPrice={formatPrice} onCheckoutStart={onCheckoutStart} />
              ))}
            </div>
            <div className="mt-4 rounded-[22px] border border-emerald-500/40 bg-emerald-950/50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <strong className="text-lg">¿Necesitas más tarjetas para tu empresa?</strong>
                <p className="text-zinc-400 mt-1">Diseñemos un plan a tu medida para ventas, atención o terreno.</p>
              </div>
              <a className="btn-press inline-flex items-center justify-center min-h-[46px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black" href="mailto:hola@nexcard.cl?subject=Cotizar%20Plan%20Corporativo%20NexCard">Cotizar Plan Corporativo</a>
            </div>
          </div>
        </section>

        {teamMembers.length > 0 && (
          <section className="border-b border-zinc-800 py-16 md:py-[78px]">
            <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
              <SectionHead title="Quiénes trabajan con nosotros.">Equipo y aliados detrás de la experiencia NexCard.</SectionHead>
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

        <section id="faq" className="border-b border-zinc-800 py-16 md:py-[78px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto grid gap-[30px] lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <aside className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-[clamp(2.15rem,4.2vw,4rem)] font-bold tracking-[-0.06em] leading-none mb-5">Antes de comprar.</h2>
              <p className="text-zinc-400 leading-relaxed">Respuestas cortas para eliminar dudas típicas: compatibilidad, mensualidad, activación y pago.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {['Mercado Pago', 'Pago seguro', 'QR respaldo'].map((item) => <span key={item} className="rounded-xl border border-zinc-800 px-3 py-2 text-sm font-black text-zinc-300">{item}</span>)}
              </div>
            </aside>
            <div>
              {FAQS.map((item, i) => (
                <details key={item.q} open={i === 0} className="group rounded-2xl border border-zinc-800 bg-zinc-900 mb-[10px]">
                  <summary className="cursor-pointer flex items-center justify-between gap-4 p-[18px] font-black list-none">
                    {item.q}
                    <ChevronDown size={18} className="text-emerald-300 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="text-sm text-zinc-400 leading-relaxed px-[18px] pb-[18px] -mt-1">{item.a}</p>
                </details>
              ))}
              <a href="https://wa.me/56993183021?text=Hola,%20tengo%20una%20pregunta%20sobre%20NexCard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition-colors text-sm font-black mt-5">
                <MessageCircle size={16} />
                ¿Tienes otra pregunta? Escríbenos por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-[78px]">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <div className="rounded-[28px] border border-emerald-500/35 bg-emerald-950/50 p-8 md:p-12 text-center">
              <h2 className="text-[clamp(2.15rem,4.2vw,4rem)] font-bold tracking-[-0.06em] leading-none mb-5">Crear mi NexCard.</h2>
              <p className="max-w-2xl mx-auto text-zinc-400 leading-relaxed mb-7">Una tarjeta física premium, un perfil digital editable y una forma más rápida de compartir tus datos.</p>
              <button onClick={onCheckoutStart} className="btn-press inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors">
                Comprar mi NexCard
                <ArrowRight size={18} />
              </button>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['Mercado Pago', 'Compra protegida', 'Despacho a Chile'].map((item) => <span key={item} className="rounded-xl border border-emerald-500/25 px-3 py-2 text-sm font-black text-zinc-300">{item}</span>)}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 py-10 px-5">
        <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <span className="text-[1.35rem] font-black tracking-[-0.04em] leading-none" style={BRAND_LOGO_STYLE}>Nex<span className="text-emerald-300">Card</span></span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-500">
            <span>© 2026 NexCard</span>
            <a href="/terminos" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Términos</a>
            <a href="/privacidad" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Privacidad</a>
            <a href="https://wa.me/56993183021" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">Contacto</a>
          </div>
          <a href="https://wa.me/56993183021" target="_blank" rel="noreferrer" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-3 min-h-[44px] inline-flex items-center">
            💬 WhatsApp
          </a>
        </div>
      </footer>

      {showWheel && wheelData && (
        <DiscountWheel wheel={wheelData} onClose={() => setShowWheel(false)} />
      )}

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
