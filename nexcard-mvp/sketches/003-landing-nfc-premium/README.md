## Variant: Landing NFC premium transaccional

### Design stance
Una landing oscura, premium y directa, enfocada en promesa de 3 segundos + packs claros para conversión inmediata.

### Key choices
- Layout: hero split con copy comercial a la izquierda y visual CSS de tarjeta negro mate + teléfono a la derecha.
- Typography: mantiene DM Sans / Syne para alinearse con `src/index.css` y la marca actual.
- Color: conserva zinc/near-black y emerald como acento principal de NexCard.
- Copy: reemplaza la propuesta genérica actual por la promesa “última tarjeta” y una secuencia dolor → solución → pasos → packs → objeciones.
- Pricing: usa los precios nuevos pedidos: Individual, Emprendedor, Socios y Equipo; destaca Pack Socios como mejor relación.
- Interaction: CTA navega a precios, FAQ expandible y botones de pack muestran un toast de selección/checkout simulado.

### Trade-offs
- Strong at: claridad comercial, premium feel, foco en ahorro por pack, menos miedo tecnológico.
- Weak at: no incluye todavía social proof real/testimonios ni fotos reales de producto; el hero visual es CSS placeholder.

### Best for
- Nueva landing `/preview` o home pública antes de pasar a implementación React.

### Implementation notes
- Target probable: `src/components/LandingPage.jsx`.
- Reutilizar tokens de `src/index.css`: `--color-brand`, `--color-surface-*`, `--font-heading`, `--font-logo`.
- Ajustar metadata de precios actual (`PRICING_META` / fallback) o mapear SKUs reales a la nueva oferta antes de implementar.
- Mantener CTA primario único: “Personalizar mi NexCard” / “Crear mi NexCard”.
