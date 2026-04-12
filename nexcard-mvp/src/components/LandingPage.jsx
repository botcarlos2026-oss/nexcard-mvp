import React from 'react';

export default function LandingPage({ content = {}, onCheckoutStart }) {
  const {
    title = 'NexCard',
    subtitle = 'Tu tarjeta de negocio NFC inteligente',
    description = 'Comparte tu información de contacto al instante con un toque',
    cta_button_text = 'Comenzar',
    features = [],
  } = content;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-emerald-400 via-white to-blue-400 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-xl md:text-2xl text-zinc-300 mb-4">
            {subtitle}
          </p>
          <p className="text-lg text-zinc-400 mb-12 max-w-2xl mx-auto">
            {description}
          </p>

          {/* Botones principales */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            {/* Botón Comprar - NUEVO */}
            <button
              onClick={onCheckoutStart}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-emerald-500/50"
            >
              🛒 Comprar NexCard
            </button>

            {/* Botón Comenzar */}
            <button
              onClick={() => window.location.href = '/setup'}
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-all duration-200 border border-zinc-600 hover:border-zinc-500"
            >
              {cta_button_text}
            </button>
          </div>
        </div>

        {/* Features Grid */}
        {features && features.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-emerald-500/50 transition-colors"
              >
                <div className="text-3xl mb-3">{feature.icon || '✨'}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA secundario */}
        <div className="text-center py-12 border-t border-zinc-800">
          <p className="text-zinc-400 mb-4">
            ¿Ya tienes una NexCard? Visualiza tu perfil público
          </p>
          <input
            type="text"
            placeholder="Ingresa tu slug (ej: carlos-alvarez)"
            className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 mr-2"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const slug = e.target.value.trim();
                if (slug) window.location.href = `/${slug}`;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
