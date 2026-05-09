# NexCard — Deploy ejecutado hotfix activación/webhook

**Fecha:** 2026-05-08

## Resumen
Se desplegó el hotfix del webhook de Mercado Pago para el proyecto Supabase remoto `ghiremuuyprohdqfrxsy`.

## Ejecutado
### Edge Function desplegada
- `mp-webhook`

### Cambios incluidos en el deploy
- resolución correcta de eventos `payment` y `merchant_order`
- reintento seguro del flujo de activación en webhooks duplicados cuando la orden ya está `paid`
- mejor manejo/log de fallo real al disparar `send-profile-activation`

## Evidencia
Comando ejecutado:
- `supabase functions deploy mp-webhook`

Salida relevante:
- `Deployed Functions on project ghiremuuyprohdqfrxsy: mp-webhook`

## Rollback simple
Si este hotfix generara incidencia, el rollback correcto es:
1. volver a desplegar la versión anterior de `supabase/functions/mp-webhook/index.ts`
2. validar manualmente una orden pagada y el trigger de activación
3. revisar logs de function en dashboard Supabase

## Nota
Este deploy no aplicó migraciones nuevas. Solo actualizó la Edge Function `mp-webhook`.