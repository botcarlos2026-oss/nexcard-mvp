# NexCard — Inventario inicial de migraciones existentes

## Objetivo
Tener un mapa claro de los SQL ya creados/validados antes de reorganizarlos como migraciones formales.

## SQL actuales en `supabase/`
- `rls_phase_b2.sql`
- `rls_phase_b3.sql`
- `c3_cards_schema.sql`
- `card_scans_rls.sql`
- `card_events_rls.sql`
- `cards_activation_status_alignment.sql`
- `route2_foundation.sql`
- `route2_profiles_snapshot_minimal.sql`
- `route2_profiles_restore_minimal.sql`
- `route2_cards_minimal.sql`
- `route2_orders_payments_minimal.sql`
- `route2_profiles_first.sql` (versión más ambiciosa; conservar solo como referencia si la mínima ya quedó validada)

## Promoción inicial a `supabase/migrations/`
### Grupo 1 — seguridad base
1. `2026-04-09-001-b2-rls-profiles-orders.sql`
2. `2026-04-09-002-b3-rls-cards-payments.sql`
3. `2026-04-09-003-card-scans-rls.sql`
4. `2026-04-09-004-card-events-rls.sql`

### Grupo 2 — NFC/cards
5. `2026-04-09-005-c3-cards-schema.sql`
6. `2026-04-09-006-cards-activation-status-alignment.sql`
7. `2026-04-09-010-route2-cards-lifecycle.sql`

### Grupo 3 — resiliencia Route 2
8. `2026-04-09-007-route2-foundation.sql`
9. `2026-04-09-008-route2-profiles-snapshot.sql`
10. `2026-04-09-009-route2-profiles-restore.sql`
11. `2026-04-09-011-route2-orders-payments.sql`

## Nota
`route2_profiles_first.sql` se mantiene fuera del lote formal como referencia histórica, porque la promoción se hizo sobre la ruta mínima validada (`snapshot` + `restore`).

## Criterio
La primera tanda ya quedó ordenada y versionada.
El siguiente paso serio no es crear más SQL suelto, sino aplicar/validar estas migraciones con disciplina staging -> prod.
