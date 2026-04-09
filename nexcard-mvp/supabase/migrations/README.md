# NexCard Supabase migrations

## Objetivo
Esta carpeta debe convertirse en la fuente ordenada de cambios de base versionados para NexCard.

## Estado actual
El proyecto ya tiene varios SQL validados en `supabase/`, pero todavía no están renombrados ni promovidos como historial formal de migraciones.

## Siguiente paso recomendado
Copiar o renombrar progresivamente los SQL ya consolidados usando este formato:

```text
YYYY-MM-DD-###-descripcion-corta.sql
```

Ejemplos:
- `2026-04-09-001-b2-rls-foundation.sql`
- `2026-04-09-002-b3-rls-cards-payments.sql`
- `2026-04-09-003-c3-cards-schema.sql`
- `2026-04-09-004-card-scans-rls.sql`
- `2026-04-09-005-card-events-rls.sql`
- `2026-04-09-006-route2-foundation.sql`
- `2026-04-09-007-route2-profiles-snapshot.sql`
- `2026-04-09-008-route2-profiles-restore.sql`
- `2026-04-09-009-route2-cards-lifecycle.sql`
- `2026-04-09-010-route2-orders-payments.sql`
- `2026-04-09-011-cards-activation-status-alignment.sql`

## Regla
Cada migración debe tener:
1. intención clara
2. validación posterior definida
3. preferencia por probar primero en staging
