# Nexcard — AI Operating Context (CLAUDE.md)

## 1. Propósito
NexCard es una plataforma de tarjetas NFC digitales y Google Reviews Cards.
- Tarjetas NFC con perfil digital personalizado
- Google Reviews Card (NexReview) — redirige a reseñas de Google
- Panel admin para gestión de órdenes, inventario, perfiles y cards
- Checkout con Mercado Pago

## 2. Stack
- Frontend: React 18 SPA → Vercel (nexcard.cl)
- DB + Auth + Edge Functions: Supabase (ghiremuuyprohdqfrxsy)
- Email: Resend (hola@nexcard.cl)
- Pagos: Mercado Pago (Checkout Pro)
- Repo: github.com/botcarlos2026-oss/nexcard-mvp

## 3. Rutas principales
- / → ComingSoon (lista de espera)
- /preview → LandingPage completa
- /admin → AdminDashboard (whitelist emails)
- /admin/orders → OrdersDashboard
- /admin/inventory → InventoryDashboard
- /admin/cards → AdminCardsDashboard
- /admin/profiles → AdminProfilesDashboard
- /privacidad → PrivacyPolicy
- /terminos → TermsAndConditions
- /:slug → NexCardProfile (perfil público)

## 4. Tablas Supabase
- products — price_cents en CLP directo (no centavos)
- orders — payment_status, fulfillment_status
- order_items — product_id, quantity, unit_price_cents
- order_status_history — historial cambios de estado
- cards — tarjetas NFC físicas
- profiles — perfiles digitales
- inventory_items — stock físico
- inventory_movements — movimientos de stock
- waitlist — emails lista de espera

## 5. Edge Functions
- send-order-confirmation → email cliente + notificación interna
- create-mp-preference → crea preferencia Mercado Pago
- mp-webhook → recibe notificaciones MP, actualiza orden

## 6. Variables de entorno
### Supabase Secrets
- RESEND_API_KEY
- MP_ACCESS_TOKEN (TEST-... para pruebas, producción para lanzar)

### Vercel
- REACT_APP_SUPABASE_URL
- REACT_APP_SUPABASE_ANON_KEY
- RESEND_API_KEY

## 7. Admin acceso
Whitelist hardcodeada en App.jsx:
- bot.carlos.2026@gmail.com
- carlos.alvarez.contreras@gmail.com

## 8. Flujo de pago MP
Checkout → crear orden (pending) → Edge Function create-mp-preference
→ redirect MP → pago → webhook mp-webhook → orden (paid)
→ return nexcard.cl?payment=success&order=ID

## 9. Reglas críticas
- price_cents en CLP directo (79990 = $79.990, NO centavos)
- RLS activo en todas las tablas
- Nunca exponer service_role en frontend
- Admin protegido con whitelist en código (no tabla memberships)
- Cambiar MP_ACCESS_TOKEN a producción antes de lanzar

## 10. Pendientes para lanzamiento
- [ ] Cambiar MP_ACCESS_TOKEN a credenciales de producción
- [ ] Eliminar producto TEST-1 ($19.990)
- [ ] Remover console.log de debug en api.js
- [ ] Panel configuración Google Reviews Card
- [ ] Transbank WebPay (segunda integración)
- [ ] CRM con pipeline Kanban

## 11. Principios
1. NO hacer cambios grandes sin plan
2. Cambios pequeños y verificables
3. No debilitar RLS
4. No exponer secretos en frontend
5. Validar manualmente cada cambio
