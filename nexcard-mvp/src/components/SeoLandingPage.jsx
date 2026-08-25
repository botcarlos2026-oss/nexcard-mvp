import React from 'react';
import { ArrowRight, CheckCircle, Instagram, MessageCircle } from 'lucide-react';
import { CORPORATE_QUOTE_WHATSAPP_URL } from '../config/contactLinks';

export const SEO_PAGES = {
  '/tarjeta-nfc-chile': {
    title: 'Tarjeta NFC Chile — NexCard',
    description: 'Tarjeta NFC en Chile para compartir WhatsApp, redes, web y datos profesionales con un toque. Perfil editable, QR de respaldo y compra online.',
    eyebrow: 'Tarjeta NFC Chile',
    h1: 'Tarjeta NFC en Chile para compartir contactos sin fricción',
    answer: 'Una tarjeta NFC en Chile permite abrir un perfil digital profesional con solo acercarla a un celular compatible. NexCard suma QR de respaldo, link público y edición online para compartir WhatsApp, redes, web y datos profesionales sin imprimir de nuevo.',
    who: ['Vendedores y equipos comerciales', 'Freelancers y profesionales independientes', 'Pymes que necesitan contacto directo por WhatsApp'],
    comparison: [
      ['NexCard', 'NFC + QR + perfil editable + compra online'],
      ['Tarjeta de papel', 'Se pierde, queda obsoleta y no mide interacción'],
      ['QR genérico', 'Funciona, pero pierde el gesto premium de un toque NFC'],
    ],
    faqs: [
      ['¿Funciona con iPhone y Android?', 'Sí. NFC en equipos compatibles y QR dinámico como respaldo.'],
      ['¿Necesito una app?', 'No. El contacto abre el perfil desde el navegador.'],
    ],
  },
  '/tarjeta-digital-de-presentacion': {
    title: 'Tarjeta digital de presentación — NexCard',
    description: 'Tarjeta digital de presentación editable para compartir contacto, WhatsApp, redes, sitio web y enlaces clave por NFC, QR o link.',
    eyebrow: 'Tarjeta digital de presentación',
    h1: 'Tu presentación profesional, editable y lista para compartir',
    answer: 'Una tarjeta digital de presentación reemplaza la tarjeta de papel por un perfil online editable. Con NexCard puedes compartir contacto, WhatsApp, redes, sitio web y enlaces clave por NFC, QR o link, sin obligar al receptor a instalar una app.',
    who: ['Profesionales que cambian datos seguido', 'Equipos que quieren imagen consistente', 'Personas que venden o atienden por WhatsApp'],
    comparison: [
      ['NexCard', 'Perfil editable + tarjeta física premium + QR/link'],
      ['Link-in-bio', 'Útil para redes, menos natural en reuniones presenciales'],
      ['Papel', 'No es editable y no conecta directo a canales digitales'],
    ],
    faqs: [
      ['¿Puedo cambiar mis datos?', 'Sí. El perfil se actualiza online.'],
      ['¿Sirve sin tarjeta física?', 'El perfil puede compartirse por link o QR; la tarjeta agrega el gesto NFC.'],
    ],
  },
  '/tarjeta-nfc-para-vendedores': {
    title: 'Tarjeta NFC para vendedores — NexCard',
    description: 'Tarjeta NFC para vendedores que necesitan convertir reuniones en contactos accionables: WhatsApp, catálogo, web y datos profesionales.',
    eyebrow: 'Ventas y terreno',
    h1: 'Tarjeta NFC para vendedores que no quieren perder contactos',
    answer: 'NexCard ayuda a vendedores a transformar reuniones, visitas y ferias en contactos accionables. Con un toque, el cliente abre WhatsApp, guarda datos, revisa redes, visita tu web o accede a un catálogo sin buscar ni escribir nada.',
    who: ['Ejecutivos comerciales', 'Equipos en terreno', 'Vendedores B2B y B2C'],
    comparison: [
      ['NexCard', 'WhatsApp + perfil + catálogo + contacto guardable'],
      ['Papel', 'Depende de que el cliente guarde o escriba los datos'],
      ['Solo WhatsApp link', 'Resuelve una acción, pero no ordena identidad completa'],
    ],
    faqs: [
      ['¿Puedo agregar catálogo?', 'Sí. Puedes enlazar catálogo, PDF, web o landing.'],
      ['¿Sirve para equipos?', 'Sí. Los packs permiten perfiles por persona.'],
    ],
  },
  '/tarjeta-nfc-para-freelancers': {
    title: 'Tarjeta NFC para freelancers — NexCard',
    description: 'Tarjeta NFC para freelancers con portfolio, redes, WhatsApp, email y perfil profesional editable en un solo link.',
    eyebrow: 'Freelancers',
    h1: 'Tarjeta NFC para freelancers que venden confianza en segundos',
    answer: 'Para freelancers, NexCard funciona como una presentación compacta: portfolio, redes, WhatsApp, correo, web y datos profesionales en un perfil editable. Ideal para reuniones, eventos, recomendaciones y primeras conversaciones comerciales.',
    who: ['Diseñadores, fotógrafos y creativos', 'Consultores y técnicos independientes', 'Profesionales que viven de recomendaciones'],
    comparison: [
      ['NexCard', 'Portfolio + contacto + redes + identidad profesional'],
      ['Instagram solo', 'Muestra trabajo, pero no ordena contacto completo'],
      ['PDF o CV', 'Menos rápido y difícil de actualizar en terreno'],
    ],
    faqs: [
      ['¿Puedo usar mi portfolio?', 'Sí. Puedes enlazar portfolio, Behance, web, Drive o landing.'],
      ['¿Puedo editar mi perfil?', 'Sí. La gracia es no reimprimir cada vez que cambia algo.'],
    ],
  },
  '/tarjeta-nfc-para-resenas-google': {
    title: 'Tarjeta NFC para reseñas Google — NexCard',
    description: 'Tarjeta NFC y QR para facilitar reseñas en Google, sin prometer reseñas positivas. Ideal para locales, clínicas, restaurantes y servicios.',
    eyebrow: 'Reseñas Google',
    h1: 'Tarjeta NFC para pedir reseñas Google sin fricción',
    answer: 'Una tarjeta NFC para reseñas Google reduce los pasos para que un cliente deje su opinión: toca la tarjeta o escanea el QR y llega al enlace de reseña. NexCard puede incluir ese acceso junto con WhatsApp, web, redes y datos del negocio.',
    who: ['Restaurantes y cafeterías', 'Clínicas, barberías y salones', 'Servicios locales que dependen de reputación'],
    comparison: [
      ['NexCard', 'Reseña Google + perfil completo del negocio'],
      ['Tarjeta solo reseñas', 'Buena para una acción, limitada para contacto comercial'],
      ['Pedir verbalmente', 'Depende de memoria y buena voluntad del cliente'],
    ],
    faqs: [
      ['¿Garantiza reseñas positivas?', 'No. Facilita pedir reseñas reales; no promete ni manipula calificaciones.'],
      ['¿Puede apuntar a TripAdvisor?', 'Puede enlazar destinos externos válidos, incluyendo reseñas o perfiles públicos.'],
    ],
  },
};

export default function SeoLandingPage({ page }) {
  if (!page) return null;
  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      <nav className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto min-h-[68px] flex items-center justify-between gap-4">
          <a href="/preview" className="text-[1.35rem] font-black tracking-[-0.04em]">Nex<span className="text-emerald-300">Card</span></a>
          <div className="flex items-center gap-3 text-sm">
            <a href="/demo" className="hidden sm:inline-flex min-h-[44px] items-center text-zinc-400 hover:text-white font-bold">Ver demo</a>
            <a href="/preview#precios" className="btn-base btn-press rounded-xl btn-primary min-h-[46px] px-4">Comprar NexCard</a>
          </div>
        </div>
      </nav>

      <main>
        <header className="border-b border-zinc-800 py-16 md:py-24">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto grid gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.18em] mb-4">{page.eyebrow}</p>
              <h1 className="text-[clamp(2.7rem,6vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.07em] mb-6">{page.h1}</h1>
              <p className="text-lg text-zinc-300 leading-[1.65] max-w-3xl">{page.answer}</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <a href="/preview#precios" className="btn-base btn-press inline-flex items-center justify-center gap-2 min-h-[50px] px-6 rounded-xl btn-primary">Comprar NexCard <ArrowRight size={18} /></a>
                <a href="/demo" className="inline-flex items-center justify-center min-h-[50px] px-6 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 font-black">Ver demo en vivo</a>
              </div>
            </div>
            <aside className="rounded-[26px] border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-black tracking-[-0.05em] mb-4">Ideal para</h2>
              <ul className="grid gap-3">
                {page.who.map((item) => <li key={item} className="flex gap-2 text-zinc-300"><CheckCircle size={18} className="text-emerald-300 shrink-0 mt-0.5" />{item}</li>)}
              </ul>
            </aside>
          </div>
        </header>

        <section className="border-b border-zinc-800 py-16">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto">
            <h2 className="text-[clamp(2.1rem,4vw,3.7rem)] font-bold tracking-[-0.06em] leading-none mb-7">Comparación rápida</h2>
            <div className="overflow-hidden rounded-[22px] border border-zinc-800">
              {page.comparison.map(([name, detail]) => (
                <div key={name} className="grid gap-3 md:grid-cols-[0.28fr_0.72fr] border-b last:border-b-0 border-zinc-800 bg-zinc-900 p-5">
                  <p className="font-black text-white">{name}</p>
                  <p className="text-zinc-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-800 py-16">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto grid gap-8 lg:grid-cols-[0.72fr_1fr]">
            <div>
              <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.18em] mb-3">Demo + canal social</p>
              <h2 className="text-[clamp(2.1rem,4vw,3.7rem)] font-bold tracking-[-0.06em] leading-none mb-5">Mira NexCard antes de comprar.</h2>
              <p className="text-zinc-400 leading-relaxed">Puedes probar el perfil demo editable y seguir el avance visual en Instagram.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <a href="/demo" className="rounded-[22px] border border-emerald-500/40 bg-emerald-500/10 p-6 hover:bg-emerald-500/15 transition-colors">
                <p className="font-black text-xl mb-2">Demo editable</p>
                <p className="text-zinc-400 text-sm">Cambia nombre, bio, WhatsApp, redes y mira el perfil al instante.</p>
              </a>
              <a href="https://www.instagram.com/nexcard_cl/" target="_blank" rel="noreferrer" className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700 transition-colors">
                <Instagram className="text-pink-400 mb-4" />
                <p className="font-black text-xl mb-2">@nexcard_cl</p>
                <p className="text-zinc-400 text-sm">Demos, lanzamientos y fotos reales cuando estén listas.</p>
              </a>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="w-[calc(100%_-_40px)] max-w-[1120px] mx-auto grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <h2 className="text-[clamp(2.1rem,4vw,3.7rem)] font-bold tracking-[-0.06em] leading-none">Preguntas frecuentes</h2>
            <div className="grid gap-3">
              {page.faqs.map(([q, a]) => (
                <details key={q} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5" open>
                  <summary className="font-black cursor-pointer">{q}</summary>
                  <p className="text-zinc-400 text-sm leading-relaxed mt-3">{a}</p>
                </details>
              ))}
              <a href={CORPORATE_QUOTE_WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 font-black min-h-[44px]">
                <MessageCircle size={17} />
                Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
