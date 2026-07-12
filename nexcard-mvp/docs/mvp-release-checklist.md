# NexCard — Checklist de release MVP / Pre-Launch

Fecha: 2026-07-03

## Estado técnico local

- [x] Repo GitHub clonado localmente.
- [x] `npm install` ejecutado.
- [x] `npm run build` pasa.
- [x] Smoke público preparado para correr sin credenciales admin.
- [ ] Smoke autenticado con admin seeded.
- [ ] `npm run check` completo.

## Producción / infraestructura

- [x] Dominio `nexcard.cl` documentado como activo.
- [x] HTTPS documentado como activo.
- [x] Vercel CI/CD desde GitHub documentado.
- [ ] Billing/tarjeta Vercel confirmado.
- [ ] Variables productivas revisadas en Vercel.
- [ ] Variables productivas revisadas en Supabase Edge Functions.

## Mercado Pago

- [x] Integración Mercado Pago sandbox documentada.
- [x] Edge Function `create-mp-preference` existe.
- [x] Edge Function `mp-webhook` existe.
- [ ] `MP_ACCESS_TOKEN` productivo configurado en Supabase, no en frontend.
- [ ] `notification_url` productiva validada.
- [ ] Primer pago real controlado ejecutado.
- [ ] Payment id real registrado internamente.
- [ ] Orden queda `payment_status=paid` por webhook.
- [ ] Payment ledger queda actualizado en `payments`.

## Catálogo y checkout

- [ ] Producto `TEST-1` eliminado o deshabilitado en Supabase.
- [ ] Catálogo productivo revisado en `/preview`.
- [ ] Precios reales revisados.
- [ ] Checkout móvil probado.
- [ ] Checkout desktop probado.
- [ ] Términos y privacidad accesibles desde checkout.

## Emails

- [x] Resend documentado como configurado.
- [x] `send-order-confirmation` existe.
- [x] `send-profile-activation` existe.
- [ ] Email de confirmación llega tras compra real.
- [ ] Notificación interna llega tras compra real.
- [ ] Email de activación llega tras pago real.

## Admin / operación

- [ ] Usuario admin productivo confirmado.
- [ ] Login admin probado.
- [ ] `/admin/orders` muestra orden real.
- [ ] `/admin/products` revisado para producto test.
- [ ] `/admin/inventory` revisado para stock inicial.
- [ ] `/admin/cards` revisado para cards disponibles.
- [ ] Runbook operativo leído y aceptado.

## Activación post-pago

- [x] `claim-profile` existe.
- [x] `profile_claims` está considerado por `mp-webhook`.
- [ ] Orden pagada crea o reutiliza claim.
- [ ] Link `/activar/:token` probado.
- [ ] Cliente puede completar setup.
- [ ] Perfil público queda visible.
- [ ] Card queda vinculada a order/profile o queda fallback manual documentado.

## QA

- [x] Build local OK.
- [ ] `.env.e2e.local` creado localmente con credenciales seeded.
- [ ] `npm run test:e2e:env-check` pasa.
- [ ] `npm run test:e2e:smoke` pasa.
- [ ] Test manual iPhone/Safari completado.
- [ ] Test manual desktop completado.

## Seguridad

- [x] No se detectó `MP_ACCESS_TOKEN` hardcodeado en frontend durante auditoría rápida.
- [x] Service role se usa en Edge Functions, no en React.
- [ ] Confirmar que service role no está en Vercel frontend vars.
- [ ] Confirmar que `.env.e2e.local` no se commitea.
- [ ] Revisar admin whitelist antes de abrir a más operadores.

## Go final

Puede abrir venta controlada solo si están OK:

- [ ] MP producción activo.
- [ ] Primer pago real validado.
- [ ] Webhook actualiza orden.
- [ ] Orden aparece en admin.
- [ ] Email llega.
- [ ] Vercel billing activo.
- [ ] Producto test fuera.
- [ ] Runbook listo.

## No-Go automático

No lanzar si ocurre cualquiera de estos:

- [ ] MP sigue en TEST.
- [ ] MP cobra pero webhook no actualiza orden.
- [ ] No hay acceso admin productivo.
- [ ] Vercel billing no confirmado.
- [ ] Producto test sigue vendible.
- [ ] No se puede identificar/reconciliar un pago real.
