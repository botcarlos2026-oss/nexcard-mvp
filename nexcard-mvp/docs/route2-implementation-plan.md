# NexCard — Route 2 implementation plan

## Objetivo
Convertir la arquitectura de resiliencia en un plan ejecutable por fases.

---

# Fase R2.1 — Foundation

## Entregables
- `audit_log`
- `profile_versions`
- `deleted_at` en entidades prioritarias

## Valor
Crea la base para trazabilidad y restauración.

---

# Fase R2.2 — Profiles first

## Objetivo
Hacer del perfil la primera entidad restaurable y auditable.

## Trabajo recomendado
- trigger o función de snapshot antes de updates relevantes
- helper de restore
- ajuste de policies para excluir `deleted_at`
- criterio de archivado vs borrado

## Por qué empezar aquí
El perfil es el núcleo visible del producto y la entidad más expuesta a cambios frecuentes.

---

# Fase R2.3 — Cards lifecycle audit

## Objetivo
Alinear `cards` con audit y restauración.

## Trabajo recomendado
- registrar activación
- registrar revocación
- registrar reemplazo
- registrar asignación
- soporte a soft delete si se archivan tarjetas

---

# Fase R2.4 — Business operations

## Objetivo
Llevar trazabilidad a órdenes, pagos e inventario.

## Trabajo recomendado
- audit de cambios de `orders`
- audit de cambios de `payments`
- audit de movimientos críticos de inventario

---

# Riesgos si no se implementa

## Riesgo operativo
Cambios accidentales sin rastro ni restore.

## Riesgo de soporte
No poder responder quién cambió qué y cuándo.

## Riesgo de mantenimiento
Migraciones y ajustes futuros más peligrosos.

---

# Recomendación ejecutiva
El primer sprint correcto de Ruta 2 es:
1. aplicar `route2_foundation.sql`
2. diseñar snapshots de perfiles
3. diseñar restore de perfil

Eso entrega el mejor retorno con el menor acoplamiento inicial.
