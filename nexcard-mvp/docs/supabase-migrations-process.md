# NexCard — Proceso serio de migraciones Supabase

## Objetivo
Pasar de SQL manual disperso a un proceso controlado, versionado y repetible para cambios de base.

Este proceso busca:
- reducir pasos manuales
- evitar drift de schema
- acelerar validación
- permitir mayor autonomía técnica sin subir riesgo innecesario

---

# 1. Principios

## 1.1 Todo cambio de schema debe vivir en el repo
No depender de “queries que alguien pegó en el editor y funcionaron”.

## 1.2 Primero staging, después producción
Nunca normalizar cambios directos primero en prod si el cambio afecta estructura o policies.

## 1.3 Un archivo por cambio lógico
Evitar blobs enormes y ambiguos.
Cada migración debe representar una intención clara.

## 1.4 Toda migración debe tener validación posterior
No basta con que el SQL corra. Hay que verificar estado final.

---

# 2. Estructura recomendada

## Carpeta sugerida
```text
nexcard-mvp/
  supabase/
    migrations/
      2026-04-09-001-b2-rls-profiles-orders.sql
      2026-04-09-002-b3-rls-cards-payments.sql
      2026-04-09-003-c3-cards-schema.sql
      2026-04-09-004-card-scans-rls.sql
      2026-04-09-005-card-events-rls.sql
      2026-04-09-006-route2-foundation.sql
      ...
```

## Regla de naming
Formato recomendado:
- `YYYY-MM-DD-###-descripcion-corta.sql`

Ejemplo:
- `2026-04-09-011-route2-profiles-snapshot.sql`

---

# 3. Flujo recomendado

## Paso 1 — diseñar migración
- crear archivo SQL en repo
- documentar intención
- revisar compatibilidad

## Paso 2 — validar en staging
- aplicar en staging
- correr consultas de verificación
- correr tests relevantes

## Paso 3 — promover a producción
- aplicar mismo archivo
- repetir validaciones clave

## Paso 4 — registrar resultado
- commit ya existe en repo
- anotar si hubo ajuste/manual follow-up

---

# 4. Qué migraciones deben existir sí o sí

## Categorías
### `authz`
- RLS
- policies
- funciones de permisos

### `cards`
- schema C3
- scans/events
- lifecycle constraints

### `route2`
- audit_log
- profile_versions
- helpers de snapshot/restore/soft delete

### `ops`
- grants cleanup
- views
- maintenance helpers

---

# 5. Qué no debería seguir pasando

## Mala práctica
- abrir Supabase editor
- pegar query suelta
- no guardar versión en repo
- no dejar validación escrita

## Riesgo
- drift entre ambientes
- olvido de cambios
- imposibilidad de reproducir
- errores futuros difíciles de explicar

---

# 6. Validación post-migración

## Toda migración debe tener al menos
- consulta de estructura
- consulta funcional
- si aplica, prueba de flujo

### Ejemplo
Para `cards`:
- columnas creadas
- función disponible
- token resuelve
- bridge bloquea estados inválidos

---

# 7. Staging recomendado

## Meta
Tener un proyecto Supabase staging donde aplicar primero:
- migrations nuevas
- tests de NFC
- tests admin/cards
- validaciones Route 2

## Ventaja
Eso te permitiría darme mucha más autonomía porque podríamos trabajar con menor riesgo.

---

# 8. Cómo aumentar autonomía técnica real

## Lo que más ayuda
### 1. staging separado
### 2. migraciones versionadas
### 3. scripts reproducibles
### 4. menos pasos manuales en SQL editor

## Lo que ayuda menos de lo que parece
- control del navegador para pegar SQL manual

Para base de datos, la automatización correcta es por migraciones, no por clicks.

---

# 9. Recomendación operativa inmediata

## Corto plazo
- crear carpeta `supabase/migrations/`
- empezar a copiar/ordenar ahí las migraciones ya validadas
- mantener naming consistente

## Mediano plazo
- agregar checklist de staging/prod por migración
- si es viable, conectar Supabase CLI/psql en flujo más automatizable

## Largo plazo
- pipeline más formal de promoción staging -> prod

---

# 10. Conclusión
Si NexCard quiere avanzar más rápido sin depender de copy/paste manual en cada cambio de base, necesita un proceso serio de migraciones.

Ese proceso da dos ventajas al mismo tiempo:
- más velocidad
- más control

Y además es la forma correcta de aumentar autonomía técnica sin pagarla con caos.
