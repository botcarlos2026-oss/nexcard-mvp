# NexCard Supabase migrations

## Objetivo
Esta carpeta debe convertirse en la fuente ordenada de cambios de base versionados para NexCard.

## Estado actual
Primera tanda formal ya promovida desde `supabase/` a esta carpeta con naming consistente.

## Lote inicial formalizado
```text
2026-04-09-001-b2-rls-profiles-orders.sql
2026-04-09-002-b3-rls-cards-payments.sql
2026-04-09-003-card-scans-rls.sql
2026-04-09-004-card-events-rls.sql
2026-04-09-005-c3-cards-schema.sql
2026-04-09-006-cards-activation-status-alignment.sql
2026-04-09-007-route2-foundation.sql
2026-04-09-008-route2-profiles-snapshot.sql
2026-04-09-009-route2-profiles-restore.sql
2026-04-09-010-route2-cards-lifecycle.sql
2026-04-09-011-route2-orders-payments.sql
```

## Convención
Formato aplicado:

```text
YYYY-MM-DD-###-descripcion-corta.sql
```

Cada archivo promovido incluye:
- referencia explícita al SQL fuente en `supabase/`
- nota mínima de validación/promoción
- orden secuencial para reconstruir historial

## Regla
Cada migración debe tener:
1. intención clara
2. validación posterior definida
3. preferencia por probar primero en staging
