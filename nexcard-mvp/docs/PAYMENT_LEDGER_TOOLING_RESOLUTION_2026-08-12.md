# Resolución técnica — ledger de pagos, tooling y CI

Fecha: 2026-08-12

## Estado ejecutivo

Estado: técnicamente OK con bloqueo comercial/operacional pendiente.

Se cerraron los hallazgos técnicos accionables de la revisión Claude Code/Hermes:

- idempotencia del ledger de pagos frente a retries/concurrencia de Mercado Pago;
- documentación operativa de agente alineada a Vite/Vitest;
- lint ampliado sobre el árbol real de código;
- higiene de artefactos locales en Git;
- plantilla de CI mínimo documentada;
- backfill de ledger endurecido para el nuevo índice único.

No se ejecutó Gate G ni pago real. No se modificó catálogo comercial ni se decidió el estado comercial de `NEXCARD-MP-TEST-1000`.

## PRs cerrados

### PR #47 — payment ledger idempotency + release tooling

URL: https://github.com/botcarlos2026-oss/nexcard-mvp/pull/47

Merge commit: `3279d5cd0dfe6e394ae188635a46067ad6f86046`

Cambios:

- `supabase/migrations/202608112215_payment_ledger_provider_external_id_unique.sql`
  - crea índice único parcial activo:
    `payments_provider_external_id_active_unique`
  - cubre `public.payments(provider, external_id)` solo cuando:
    - `deleted_at is null`
    - `external_id is not null`
- `supabase/functions/mp-webhook/index.ts`
  - evita duplicados activos ante webhook concurrente/reintentado;
  - patrón aplicado: `insert` y, si ocurre `23505`, recuperar la fila activa existente por `provider + external_id` y actualizar payload/status/monto;
  - se evitó `upsert` porque el índice es parcial y Supabase/PostgREST puede no inferirlo correctamente con `onConflict`.
- `CLAUDE.md`
  - actualizado a stack real Vite/Vitest;
  - removidas instrucciones operativas antiguas de CRA/react-scripts en la sección superior;
  - documentado scope real de lint y reglas estabilizadas.
- `.eslintrc.json` / `package.json`
  - `npm run lint` ahora cubre `src server scripts vite.config.js`;
  - reglas React Compiler experimentales quedan desactivadas hasta refactor dedicado para no bloquear release con deuda preexistente.
- `.gitignore`
  - agrega `.hermes/`, `strix_runs/`, `supabase/.temp/`.
- `docs/ci/github-actions-ci.yml`
  - plantilla de CI mínimo: `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build`.

Verificación local ejecutada:

- `npm ci`: OK
- `npm run lint`: OK, 0 errores, 3 warnings existentes
- `npm run test:unit`: OK, 22 files / 93 tests
- `npm run build`: OK
- verificación ad-hoc: OK para webhook, migración, lint, CI template, gitignore y CLAUDE.md

Verificación GitHub/Vercel:

- Vercel preview: pass
- PR mergeado: sí

### PR #48 — backfill ledger idempotente

URL: https://github.com/botcarlos2026-oss/nexcard-mvp/pull/48

Merge commit: `c94f1a93867bbbf7fef1ab45a8033ed6ad0d7d6a`

Cambios:

- `supabase/functions/backfill-payment-ledger/index.ts`
  - si el insert choca con `23505`, busca la fila activa existente por `provider + external_id`;
  - si existe, no falla el backfill: registra `skipped` con `reason=provider_external_id_already_exists`, `existing_payment_id` y `existing_order_id`;
  - mantiene trazabilidad operativa sin mutar filas reales durante dry-run.

Verificación local ejecutada:

- `npm run lint`: OK, 0 errores, 3 warnings existentes
- `npm run test:unit`: OK, 22 files / 93 tests
- `npm run build`: OK
- `npm run ops:backfill-payments:dry`: OK
  - `http_ok: true`
  - `status: 200`
  - `success: true`
  - `dry_run: true`
  - `summary.scanned: 0`
  - `summary.failed: 0`

Verificación GitHub/Vercel:

- Vercel preview: pass
- PR mergeado: sí

## Supabase producción

Proyecto: `ghiremuuyprohdqfrxsy`

### Preflight antes de migración

Consulta read-only ejecutada para detectar duplicados activos de `(provider, external_id)`:

```sql
with duplicates as (
  select provider, external_id, count(*) as active_count
  from public.payments
  where deleted_at is null
    and external_id is not null
  group by provider, external_id
  having count(*) > 1
)
select count(*) as duplicate_groups, coalesce(sum(active_count),0) as duplicate_rows
from duplicates;
```

Resultado:

- `duplicate_groups: 0`
- `duplicate_rows: 0`

### Migración aplicada

Archivo aplicado vía `supabase db query --linked --file`:

`supabase/migrations/202608112215_payment_ledger_provider_external_id_unique.sql`

Verificación del índice:

- `payments_provider_external_id_active_unique`
- definición verificada:
  `CREATE UNIQUE INDEX payments_provider_external_id_active_unique ON public.payments USING btree (provider, external_id) WHERE ((deleted_at IS NULL) AND (external_id IS NOT NULL))`

### Edge Functions desplegadas

`mp-webhook`:

- desplegada a Supabase producción;
- versión posterior: `16`;
- `UPDATED_AT`: `2026-08-12 02:42:30 UTC`.

Probe negativo seguro:

- `POST https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/mp-webhook` con `{}`
- resultado: `http_status=200`, body `ok`
- no ejecuta pago real ni llamada positiva a Mercado Pago.

`backfill-payment-ledger`:

- desplegada a Supabase producción;
- versión posterior: `10`;
- `UPDATED_AT`: `2026-08-12 02:45:15 UTC`.

Dry-run operativo:

- `npm run ops:backfill-payments:dry`
- resultado:
  - `http_ok: true`
  - `status: 200`
  - `trigger: manual`
  - `dry_run: true`
  - `success: true`
  - `summary.scanned: 0`
  - `summary.eligible: 0`
  - `summary.inserted: 0`
  - `summary.skipped: 0`
  - `summary.failed: 0`

## CI

La plantilla quedó en:

`docs/ci/github-actions-ci.yml`

No quedó activada como `.github/workflows/ci.yml` porque GitHub rechazó el push con:

`refusing to allow an OAuth App to create or update workflow .github/workflows/ci.yml without workflow scope`

Acción pendiente:

- usar un token GitHub con scope `workflow` para copiar la plantilla a `.github/workflows/ci.yml`.

## Pendientes comerciales/operacionales

Siguen fuera del cierre técnico y requieren decisión/autorización explícita:

1. Gate G / pago real end-to-end en producción.
2. Confirmar en Supabase/MP que el token Mercado Pago usado para producción es `APP_USR-*` y corresponde a Chile/MLC.
3. Confirmar que `NEXCARD-MP-TEST-1000` esté fuera del catálogo comercial real o visible solo bajo flujo controlado.
4. Ejecutar Zero-to-Hero físico:
   - compra/control de pedido;
   - preparación física;
   - programación NFC;
   - despacho/entrega;
   - activación del comprador;
   - verificación post-entrega.

## Estado final

Técnico:

- ledger de pagos protegido a nivel DB contra duplicados activos por `provider + external_id`;
- `mp-webhook` y `backfill-payment-ledger` toleran carreras/idempotencia;
- migración aplicada en producción;
- funciones Supabase relevantes desplegadas;
- lint/unit/build/dry-run verificados.

Comercial/operacional:

- pendiente Gate G real;
- pendiente Zero-to-Hero físico;
- pendiente confirmación de token MP productivo y catálogo test.

Etiqueta recomendada:

`técnicamente OK con bloqueo comercial/operacional pendiente`
