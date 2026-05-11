# Observabilidad post-pago / activación — capa 2 server-side (2026-05-11)

## Objetivo
Mover la trazabilidad crítica desde lógica derivada en aplicación hacia el backend para que el sistema deje huella formal aunque el cambio ocurra por webhook, RPC, trigger o panel admin.

## Alcance implementado

### 1. Nuevos timestamps formales en `orders`
Se agregan columnas:
- `paid_at`
- `ready_at`
- `activated_at`

Con esto el embudo ya no depende solo de leer estados actuales; ahora también conserva momentos operativos explícitos.

### 2. Tabla de eventos operativos
Nueva tabla:
- `public.order_operational_events`

Propósito:
- registrar hitos operativos canónicos del funnel
- dejar evidencia cronológica independiente del frontend
- soportar auditoría y futuros KPIs/SLAs

Etapas soportadas:
- `paid`
- `ready`
- `shipped`
- `delivered`
- `activated`

### 3. Triggers sobre `orders`
Se agregan dos capas automáticas:

#### `trg_orders_set_operational_timestamps`
Before insert/update:
- completa `paid_at` cuando la orden pasa a `payment_status = paid`
- completa `ready_at` cuando pasa a `ready/shipped/delivered`
- asegura `shipped_at` y `delivered_at` si el estado ya lo exige

#### `trg_orders_emit_operational_events`
After insert/update:
- registra eventos en `order_operational_events`
- inserta historial para timestamps (`paid_at`, `ready_at`, `activated_at`)
- cuando el cambio no pasó por RPC con bypass, también registra historial de `payment_status` y `fulfillment_status`

### 4. Función formal de activación de orden
Nueva función:
- `public.mark_order_activated(...)`

Responsabilidad:
- setear `orders.activated_at` una sola vez
- registrar evento de activación en `order_operational_events`
- dejar historial de `activated_at`

### 5. Triggers de activación desde cards y claims
#### `trg_cards_sync_order_activation`
Cuando una card queda activa (`status = active` o `activation_status = activated`):
- busca la orden por `cards.order_id` o `order_cards`
- marca la orden como activada server-side

#### `trg_profile_claims_sync_order_activation`
Cuando `profile_claims.status` pasa a `claimed`:
- marca la orden como activada server-side

Esto cubre dos rutas reales de cierre:
- activación técnica de la card
- consumo del claim por el cliente

## Backfill
La migración también rellena datos históricos cuando faltan:
- `paid_at` desde `payments.paid_at` o fallback razonable
- `ready_at` desde hitos operativos existentes
- `activated_at` desde cards activas / `order_cards` / claims ya consumidos

## UI / aplicación
Se ajustó la capa de aplicación para privilegiar timestamps formales:
- `src/services/api.js` ahora usa `orders.activated_at` como fuente fuerte de activación cuando existe
- `src/components/OrdersDashboard.jsx` usa:
  - `paid_at`
  - `ready_at`
  - `shipped_at`
  - `delivered_at`
  - `activated_at`

## Archivo principal
Migración creada en:
- `supabase/migrations/202605110950_second_layer_order_observability.sql`

## Validación ejecutada
- `npm run lint` ✅
- `npm run build` ✅
- precheck remoto por Management API read-only ✅
- aplicación remota puntual de la migración ✅
- verificación de columnas / funciones / triggers / registro de versión ✅

## Ejecución real en producción
Se aplicó con cautela directamente sobre el proyecto productivo usando Supabase Management API, evitando `supabase db push` porque el remoto no tenía alineado todo el historial antiguo de migraciones locales.

Incidencia encontrada durante la ejecución:
- el primer intento falló porque la migración asumía `payments.paid_at`
- en producción, `payments` no tiene esa columna
- se corrigió el backfill para usar `order_status_history` y fallback por `orders.updated_at`
- tras eso, la migración aplicó correctamente

Observación importante:
- el endpoint remoto aplicó el SQL pero no dejó registrada automáticamente la versión `202605110950` en `supabase_migrations.schema_migrations`
- se registró manualmente esa versión para evitar drift futuro en el historial

## Resultado ejecutivo
Con esta capa, NexCard ya no depende solo del frontend para entender el post-pago.
El sistema empieza a comportarse como operación seria:
- timestamps formales
- eventos operativos auditables
- activación consolidada server-side
- base lista para SLA, funnel real y alertas futuras
