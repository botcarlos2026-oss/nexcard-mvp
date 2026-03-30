# NexCard - Arquitectura Base Producción

## Stack recomendado
- **Frontend:** React (base actual), migrable a Next.js si se requiere SSR/SEO más fino.
- **API/Backend productivo:** Supabase
  - Auth
  - PostgreSQL
  - Storage
  - Row Level Security
  - Edge Functions para pagos/webhooks
- **Pagos:** Webpay + Mercado Pago
- **Hosting frontend:** Vercel
- **Observabilidad:** PostHog + Sentry
- **Email transaccional:** Resend

## Principios
1. **Separar comercial de operación**: landing, checkout y panel admin no deben mezclar lógica.
2. **Modelo multi-segmento desde el inicio**: individual, pyme y empresa.
3. **NFC desacoplado**: la tarjeta física se asocia después; el perfil digital vive por sí mismo.
4. **CMS liviano**: contenido editable desde admin sin depender de deploy.
5. **Escalabilidad financiera**: cada nueva venta no debe requerir trabajo manual estructural.

## Módulos del sistema
### 1. Sitio comercial
- Landing
- Planes
- FAQ
- Captura de lead o checkout
- CMS editable

### 2. Cuenta cliente
- Login
- Setup inicial
- Perfil público editable
- Branding, links, foto, datos comerciales
- Métricas básicas

### 3. Backoffice admin
- Dashboard comercial
- Gestión de perfiles
- Gestión de pedidos
- Inventario
- Producción / fulfillment
- CMS landing

### 4. Dominio de pedidos
- Producto
- Pedido
- Pago
- Estado de producción
- Estado de despacho
- Asociación futura con tarjeta física/NFC

## Modelo de datos mínimo recomendado
- `users`
- `organizations`
- `memberships`
- `profiles`
- `products`
- `orders`
- `order_items`
- `payments`
- `inventory_items`
- `inventory_movements`
- `cards`
- `content_blocks`
- `events`

## Roadmap técnico
### Fase 1 - Base operativa
- Auth real
- Profiles reales
- Admin dashboard
- Inventory
- Orders
- CMS landing

### Fase 2 - Monetización
- Checkout Webpay / Mercado Pago
- Webhooks de confirmación
- Estados de fulfillment
- Notificaciones email

### Fase 3 - Escala empresa
- Organizaciones
- Packs y equipos
- Gestión multiusuario
- Facturación y permisos por rol

### Fase 4 - Tarjeta física / NFC
- Activación de tarjeta
- Asociación card/profile
- Escritura NFC asistida o interna

## Entorno local actual
Se dejó un **mini servidor Express** para validar:
- auth local
- perfiles públicos
- perfil editable
- dashboard admin
- inventario
- CMS landing inicial

Esto no reemplaza Supabase productivo; sirve para avanzar el frontend sin bloquearse por infraestructura.
