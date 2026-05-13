# NexCard — segregación estructural de órdenes QA/test

**Fecha:** 2026-05-13

## Objetivo
Dejar de depender solo de heurísticas en frontend para excluir órdenes internas/QA del dashboard operativo.

## Cambio aplicado
Se creó la migración:
- `supabase/migrations/202605131250_orders_test_segmentation.sql`

### Qué hace
1. agrega a `public.orders`:
   - `is_test boolean not null default false`
   - `test_reason text null`
2. crea la función:
   - `public.classify_order_test_signal(customer_name, customer_email)`
3. crea trigger sobre `orders` para clasificar automáticamente en `insert/update`
4. hace backfill histórico de las órdenes ya existentes
5. indexa `orders.is_test`

## Reglas de clasificación actuales
Se marca `is_test = true` cuando:
- el email es uno de los internos conocidos:
  - `bot.carlos.2026@gmail.com`
  - `carlos.alvarez.contreras@gmail.com`
  - `admin@nexcard.cl`
  - `carlos@nexcard.cl`
  - `hola@nexcard.cl`
- el email termina en `@nexcard.cl`
- el nombre contiene patrones QA:
  - `qa`
  - `test`
  - `tst`
  - `smoke`
  - `demo`
  - `bot`

`test_reason` deja trazado si la clasificación vino por:
- `internal_email`
- `internal_domain`
- `name_pattern`

## Consumo en aplicación
Se centralizó helper en:
- `src/utils/orderOperationalSegmentation.js`

Comportamiento:
- si `order.is_test === true`, la app usa esa marca estructural
- si el campo todavía no existe en algún entorno desalineado, cae a fallback heurístico para no romper compatibilidad

## Impacto funcional
### `/admin`
- `operationalAlerts`
- `slaBreaches`
- `proactiveSummary`

ahora dependen preferentemente de la marca persistente `orders.is_test`.

### `/admin/orders`
- el filtro `?audit=excluded`
- el selector `Solo QA/internas`

usan la misma lógica centralizada.

## Estado observado tras backfill
Auditoría ejecutada sobre producción:
- `24` órdenes totales
- `24` clasificadas como QA/internas
- `0` órdenes operativas reales hoy
- `0` SLA breaches reales
- `0` alertas operativas reales

## Siguiente mejora recomendada
Cuando exista primera venta operativa real:
1. revisar que `is_test = false` se mantenga correctamente
2. separar KPIs comerciales reales vs QA también en revenue/funnel global
3. evaluar override manual admin si alguna orden legítima cae mal clasificada
