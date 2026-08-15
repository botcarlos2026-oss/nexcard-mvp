# Supabase schema baseline — 2026-08-15

## Objetivo

Cerrar el bloqueo de replay limpio de migraciones Supabase en NexCard: la historia asumía tablas de producción existentes antes de que existiera una migración `CREATE TABLE` reproducible.

## Fuente de verdad

Se copió el dump real usado en la verificación de rollback CN-007 al repo para no depender de `/tmp`:

- `docs/schema-snapshots/202608141357_prod_schema_dump.sql`
- sha256: `9a4df6620720f487ffbf553bd57fc4f180614a83bd36d730a185c6210a3bdd38`

## Migración agregada

- `supabase/migrations/202604080002_initial_schema_baseline.sql`

La migración:

- usa `CREATE TABLE IF NOT EXISTS`;
- guarda PK/UNIQUE/FK con bloques `DO $$ ... IF NOT EXISTS ... $$`;
- usa `CREATE INDEX IF NOT EXISTS`;
- habilita RLS en las tablas baseline;
- no crea policies RLS nuevas;
- incluye `public.set_updated_at()` porque migraciones históricas posteriores crean triggers que lo necesitan.

## Tablas cubiertas

El plan inicial identificó 11 tablas sin baseline temprano:

- `organizations`
- `profiles`
- `orders`
- `cards`
- `order_items`
- `payments`
- `products`
- `content_blocks`
- `events`
- `inventory_items`
- `inventory_movements`

Durante el replay limpio aparecieron dependencias adicionales que también existían en el dump de producción y eran necesarias para que la historia migrara completa:

- `card_scans` y `card_events`: tienen `CREATE TABLE` en `202604090005`, pero sus migraciones RLS `202604090003`/`202604090004` corren antes.
- `waitlist`: referenciada por `202605030002_kpi_views.sql` sin `CREATE TABLE` previo.
- `order_status_history`: referenciada por `202605102310_order_transition_guards.sql` y `202605110950_second_layer_order_observability.sql` sin `CREATE TABLE` previo.
- `order_cards`: referenciada por `202605110950_second_layer_order_observability.sql`; su `CREATE TABLE` llega recién en `202607150001_hybrid_order_cards.sql`.

Total baseline: 16 tablas.

## Otros blockers de replay corregidos

El baseline permitió avanzar y expuso tres migraciones históricas con SQL no reproducible desde cero. Se corrigieron de forma idempotente/local-replay safe:

1. `202604180001_order_folio.sql`
   - reemplaza `ROW_NUMBER()` directo en `UPDATE SET` por CTE, porque PostgreSQL no permite window functions en ese lugar.
2. `202604200002_abandoned_carts_cron.sql`
   - cambia dollar-quoting anidado de `$$` a `$do$`/`$job$`.
3. `202605082245_fix_order_folio_sequence.sql`
   - evita `setval(..., 0, true)` cuando no hay órdenes; usa `setval(..., 1, false)` para DB vacía.

## Verificación

### Replay limpio local

Comando:

```bash
supabase stop --no-backup || true
supabase start
```

Resultado: OK, exit 0.

Evidencia:

- `/private/tmp/nexcard-schema-baseline-evidence-20260815174834/supabase-start.log`

El replay aplicó todas las migraciones hasta `202608132300_cyber_neo_rls_profile_status_hardening.sql` y levantó Supabase local correctamente.

### Idempotencia local

Se re-ejecutó `202604080002_initial_schema_baseline.sql` sobre la DB local ya migrada usando el contenedor Postgres de Supabase.

Resultado: OK, exit 0; las 16 tablas baseline existen.

Evidencia:

- `/private/tmp/nexcard-schema-baseline-idempotency-20260815175243/rerun-baseline.log`
- `/private/tmp/nexcard-schema-baseline-idempotency-20260815175243/table-count.txt`

### No-op contra producción

Se verificó que todas las tablas, constraints e índices declarados por el baseline existen en el dump real de producción copiado al repo:

- tablas baseline faltantes en dump: 0
- constraints baseline faltantes en dump: 0
- índices baseline faltantes en dump: 0
- policies creadas por baseline: 0

También se ejecutó `supabase db diff --linked --schema public` contra el proyecto `ghiremuuyprohdqfrxsy`. El comando fue read-only y terminó OK, pero el diff remoto/local no sirve como prueba de no-op aislado del baseline porque contiene divergencias históricas no relacionadas entre la historia local y el esquema remoto (por ejemplo `event_log`, `product_bundles`, grants/policies y funciones). Evidencia:

- `/private/tmp/nexcard-schema-baseline-evidence-prod-20260815175048/prod-linked-diff.sql`
- `/private/tmp/nexcard-schema-baseline-evidence-prod-20260815175048/prod-linked-diff.stderr`

Conclusión: el no-op está respaldado contra el dump real de producción para los objetos tocados por el baseline; el diff live completo queda no-concluyente por drift no relacionado.
