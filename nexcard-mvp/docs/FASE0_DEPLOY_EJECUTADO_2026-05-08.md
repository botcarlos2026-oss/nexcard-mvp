# NexCard — Ejecución de despliegue Fase 0

**Fecha:** 2026-05-08

## Resumen
Se ejecutó el despliegue remoto de Fase 0 en Supabase para el proyecto `ghiremuuyprohdqfrxsy` (`nexcard`).

## Ejecutado
### Edge Functions desplegadas
- `create-mp-preference`
- `get-tracking`
- `send-shipping-notification`

### Base de datos
- Se aplicó manualmente el archivo:
  - `supabase/migrations/202605081700_phase0_checkout_hardening.sql`
- Luego se marcó en el historial remoto como:
  - `202605081700 => applied`

## Motivo de ejecución manual
El proyecto remoto mostraba múltiples migraciones locales históricas no aplicadas. Para no empujar todo el lote a producción, se ejecutó **solo la migración nueva** con `supabase db query --linked -f ...` y luego `supabase migration repair` para mantener consistencia del historial.

## Impacto esperado
- Checkout endurecido server-side en `create_order_with_items(...)`
- Preferencia MP armada desde DB persistida
- Tracking público exigiendo `delivery_token`
- Links de seguimiento tokenizados en email de despacho

## Riesgo residual
- Quedan migraciones locales antiguas no aplicadas en remoto; no fueron tocadas en esta intervención.
- Aún falta validación funcional manual post-deploy.

## Incidencia detectada post-deploy
- El tracking tokenizado falló inicialmente porque las functions consultaban `orders.delivery_address`, pero el esquema remoto usa `orders.customer_address`.
- Se programó corrección posterior para alinear functions/frontend con el esquema real.

## Próximo paso correcto
Ejecutar smoke test post-deploy:
1. crear orden
2. abrir preferencia MP
3. validar monto
4. validar tracking tokenizado
5. validar shipping email
