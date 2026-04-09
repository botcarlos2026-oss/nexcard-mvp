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

## Recomendación de promoción a `supabase/migrations/`
### Grupo 1 — seguridad base
1. B2 RLS
2. B3 RLS
3. card_scans RLS
4. card_events RLS

### Grupo 2 — NFC/cards
5. C3 cards schema
6. cards activation_status alignment
7. route2 cards lifecycle

### Grupo 3 — resiliencia Route 2
8. route2 foundation
9. route2 profiles snapshot minimal
10. route2 profiles restore minimal
11. route2 orders/payments minimal

## Criterio
No hace falta mover todo hoy mismo.
Pero este inventario deja claro qué piezas ya existen y cuáles ya fueron validadas en la base real.
