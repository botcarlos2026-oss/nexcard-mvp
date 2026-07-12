## Variant: Landing NFC clean

### Design stance
Misma estructura comercial que la maqueta anterior, pero más sobria: menos copy decorativo, menos efectos, más jerarquía y lectura rápida.

### Key choices
- Hero split con tarjeta + teléfono CSS, sin exceso de glow ni ornamentación.
- Copy directo: promesa, dolor, solución, pasos, pricing, FAQ y cierre.
- Pricing con 4 packs pedidos y ahorro visible.
- Pack Socios destacado como recomendado, sin sobre-diseñar.
- FAQ corta para objeciones reales antes de checkout.

### Trade-offs
- Strong at: claridad, implementación simple, menos “AI slop”, mejor base para React/Tailwind.
- Weak at: visual menos espectacular; necesitaría foto/render real de la tarjeta para producción.

### Best for
Base de implementación en `src/components/LandingPage.jsx` si apruebas la dirección.
