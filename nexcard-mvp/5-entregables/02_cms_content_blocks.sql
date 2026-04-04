-- ============================================================
-- NexCard MVP — CMS Content Blocks
-- block_key = 'landing', locale = 'es-CL'
-- Tres variantes listas para probar A/B o rotar.
-- ============================================================

-- ─────────────────────────────────────────
-- VARIANTE A: "Networking Profesional" (actual / default)
-- Tono: directo, confianza, profesional urbano
-- ─────────────────────────────────────────
INSERT INTO public.content_blocks (block_key, locale, content) VALUES (
  'landing',
  'es-CL',
  '{
    "heroBadge": "Lanzamiento 2026 · Chile",
    "heroTitle": "Tu tarjeta de presentación, en un solo toque.",
    "heroAccent": "en un solo toque.",
    "heroDescription": "Comparte contacto, agenda, links y branding en segundos. NexCard conecta tu identidad física y digital sin depender de apps.",
    "primaryCta": "Personalizar mi NexCard",
    "secondaryCta": "Ver planes y precios",
    "socialProof": "+120 profesionales ya usan NexCard",
    "socialProofSub": "Vendedores, consultores y directivos en Chile",
    "finalCtaTitle": "¿Listo para jubilar tu tarjeta de papel?",
    "finalCtaButton": "Ordena tu NexCard Ahora",
    "benefits": [
      {
        "icon": "smartphone",
        "title": "Perfil 100% editable",
        "desc": "Actualiza nombre, foto, links y datos bancarios en segundos. Sin reimprimir nada."
      },
      {
        "icon": "zap",
        "title": "Un toque, todo listo",
        "desc": "NFC + QR en la misma tarjeta. Compatible con cualquier smartphone moderno."
      },
      {
        "icon": "globe",
        "title": "Escala con tu empresa",
        "desc": "Desde 1 tarjeta individual hasta flotas corporativas con panel de administración."
      }
    ],
    "plans": [
      {
        "name": "Individual",
        "price": "19.900",
        "currency": "CLP",
        "period": "pago único",
        "features": ["1 tarjeta NFC + QR", "Perfil digital editable", "vCard, WhatsApp, redes", "Soporte básico"],
        "cta": "Comenzar",
        "highlighted": false
      },
      {
        "name": "Pyme",
        "price": "79.900",
        "currency": "CLP",
        "period": "pack 5 tarjetas",
        "features": ["5 tarjetas NFC + QR", "Panel de equipo", "Branding unificado", "Analytics de uso", "Soporte prioritario"],
        "cta": "Pedir pack",
        "highlighted": true
      },
      {
        "name": "Enterprise",
        "price": "A convenir",
        "currency": "",
        "period": "desde 20 tarjetas",
        "features": ["Volumen sin límite", "Integración CRM", "Onboarding dedicado", "SLA garantizado"],
        "cta": "Contactar ventas",
        "highlighted": false
      }
    ],
    "faq": [
      {
        "q": "¿Necesito una app para usar NexCard?",
        "a": "No. Quien recibe tu tarjeta no necesita instalar nada. Un toque NFC o escanear el QR abre tu perfil directamente en el navegador."
      },
      {
        "q": "¿Puedo cambiar mis datos después de recibir la tarjeta física?",
        "a": "Sí, todas las veces que quieras. La tarjeta física es solo el lector; tu perfil digital vive en la nube y se actualiza en tiempo real."
      },
      {
        "q": "¿Qué pasa si pierdo la tarjeta?",
        "a": "Puedes desactivar la tarjeta perdida desde tu panel y solicitar una nueva. Tu perfil y datos quedan intactos."
      },
      {
        "q": "¿Con qué teléfonos es compatible?",
        "a": "NFC es compatible con iPhone 7 o superior y la mayoría de Android desde 2018. El QR funciona con cualquier smartphone con cámara."
      },
      {
        "q": "¿Cuánto demora el envío?",
        "a": "Producción en 3–5 días hábiles. Despacho a domicilio en Santiago: 1–2 días. Regiones: 3–5 días hábiles."
      }
    ]
  }'::jsonb
)
ON CONFLICT (block_key, locale) DO UPDATE SET content = EXCLUDED.content, updated_at = now();


-- ─────────────────────────────────────────
-- VARIANTE B: "Anti-papel" (más disruptivo)
-- Para probar con segmento más joven / startups
-- Cambiar block_key a 'landing_b' para A/B
-- ─────────────────────────────────────────
INSERT INTO public.content_blocks (block_key, locale, content) VALUES (
  'landing_b',
  'es-CL',
  '{
    "heroBadge": "El fin de las tarjetas de papel",
    "heroTitle": "La tarjeta que nunca se queda sin datos.",
    "heroAccent": "nunca se queda sin datos.",
    "heroDescription": "Actualiza tu información cada vez que cambias de trabajo, cargo o teléfono. Sin reimprimir. Sin quedar mal.",
    "primaryCta": "Quiero la mía",
    "secondaryCta": "¿Cómo funciona?",
    "socialProof": "Ya no imprimen papel",
    "socialProofSub": "Únete a los profesionales que van un paso adelante",
    "finalCtaTitle": "Tu próximo cliente ya tiene NFC en su teléfono.",
    "finalCtaButton": "Empieza hoy",
    "benefits": [
      {
        "icon": "zap",
        "title": "Toca y comparte",
        "desc": "Sin fricción. Sin apps. Sin \"¿me mandas tu contacto por WhatsApp?\""
      },
      {
        "icon": "refresh-cw",
        "title": "Siempre actualizada",
        "desc": "¿Cambiaste de empresa? Edita el perfil en 30 segundos. La tarjeta física sigue igual."
      },
      {
        "icon": "bar-chart-2",
        "title": "Sabe cuándo te ven",
        "desc": "Cada tap registra una visita. Sabrás qué funciona en tus encuentros de networking."
      }
    ],
    "plans": [
      {
        "name": "Solo",
        "price": "19.900",
        "currency": "CLP",
        "period": "una vez",
        "features": ["1 NexCard física", "Perfil digital vitalicio", "WhatsApp, LinkedIn, Calendly", "QR de respaldo"],
        "cta": "La quiero",
        "highlighted": false
      },
      {
        "name": "Equipo",
        "price": "79.900",
        "currency": "CLP",
        "period": "5 tarjetas",
        "features": ["5 NexCards", "Panel de empresa", "Misma imagen de marca", "Estadísticas por persona"],
        "cta": "Para mi equipo",
        "highlighted": true
      }
    ],
    "faq": [
      {
        "q": "¿Funciona sin internet?",
        "a": "El tap NFC sí requiere que quien recibe tu tarjeta tenga datos móviles para cargar tu perfil, igual que un link de WhatsApp."
      },
      {
        "q": "¿Es compatible con iPhone?",
        "a": "Sí, desde iPhone 7. En iOS 14+ no necesitas abrir ninguna app, el NFC funciona en background."
      },
      {
        "q": "¿Y si cambio de empresa?",
        "a": "Entras al panel, editas tu cargo y empresa, y listo. La tarjeta física sigue funcionando con tu nueva información."
      }
    ]
  }'::jsonb
)
ON CONFLICT (block_key, locale) DO NOTHING;


-- ─────────────────────────────────────────
-- BLOQUE: Página de precios (futuro /planes)
-- ─────────────────────────────────────────
INSERT INTO public.content_blocks (block_key, locale, content) VALUES (
  'pricing',
  'es-CL',
  '{
    "title": "Planes NexCard",
    "subtitle": "Un solo pago. Sin suscripción mensual. Tu perfil digital activo mientras NexCard exista.",
    "badge": "Sin letra chica",
    "plans": [
      {
        "id": "individual",
        "name": "Individual",
        "price_cents": 1990000,
        "currency": "CLP",
        "period": "pago único",
        "desc": "Para profesionales independientes que quieren causar una primera impresión memorable.",
        "features": [
          "1 tarjeta NFC + QR de alta resolución",
          "Perfil digital personalizable",
          "WhatsApp, Instagram, LinkedIn, Web",
          "Botón de agendar reunión",
          "Datos de transferencia (acordeón)",
          "Descarga vCard automática",
          "QR descargable para imprimir"
        ],
        "cta": "Pedir mi NexCard",
        "highlighted": false
      },
      {
        "id": "individual_pack",
        "name": "Pack Individual x3",
        "price_cents": 4990000,
        "currency": "CLP",
        "period": "pago único",
        "desc": "Tres tarjetas al precio de dos y medio. Ideal si regalas o pierdes tarjetas.",
        "features": [
          "3 tarjetas NFC + QR",
          "Todo lo del plan Individual",
          "Ahorra $960 vs precio unitario"
        ],
        "cta": "Pedir pack x3",
        "highlighted": false
      },
      {
        "id": "sme_5",
        "name": "Pyme 5",
        "price_cents": 7990000,
        "currency": "CLP",
        "period": "5 tarjetas",
        "desc": "Para equipos de venta, atención al cliente o sucursales que necesitan coherencia de marca.",
        "features": [
          "5 tarjetas NFC + QR personalizadas",
          "Panel de administración de equipo",
          "Branding unificado (color de marca)",
          "Analytics por tarjeta",
          "Soporte por WhatsApp"
        ],
        "cta": "Pedir pack Pyme",
        "highlighted": true
      },
      {
        "id": "enterprise",
        "name": "Enterprise",
        "price_cents": null,
        "currency": "CLP",
        "period": "desde 20 tarjetas",
        "desc": "Solución a medida para flotas corporativas, franquicias o integraciones con CRM propio.",
        "features": [
          "Volumen sin tope",
          "Integración con CRM o HRIS",
          "Onboarding y capacitación",
          "Factura con razón social",
          "SLA de soporte garantizado",
          "Account manager dedicado"
        ],
        "cta": "Hablar con ventas",
        "highlighted": false
      }
    ]
  }'::jsonb
)
ON CONFLICT (block_key, locale) DO NOTHING;
