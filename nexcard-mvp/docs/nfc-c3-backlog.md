# NexCard — Backlog priorizado C3

## Objetivo
Traducir la fase C3 en tareas ejecutables, ordenadas por impacto y dependencia.

---

# P0 — Base estructural

## C3-001 — Extender `cards`
**Tipo:** schema / migration

### Tarea
Agregar a `cards`:
- `public_token`
- `status`
- `issued_at`
- `assigned_at`
- `activated_at`
- `revoked_at`
- `replaced_by_card_id`
- `replacement_reason`
- `metadata`
- `deleted_at`

### Valor
Sin esto, la tarjeta sigue siendo un asset débil y no durable.

### Dependencia
Ninguna.

---

## C3-002 — Crear `card_scans`
**Tipo:** schema / migration

### Tarea
Crear tabla específica para telemetría NFC.

### Valor
Permite trazabilidad, fraude básico, métricas por tarjeta.

### Dependencia
C3-001

---

## C3-003 — Crear `card_events`
**Tipo:** schema / migration

### Tarea
Crear historial de lifecycle de tarjetas.

### Valor
Permite auditoría de activación, revocación, reemplazo.

### Dependencia
C3-001

---

## C3-004 — Backfill de `public_token`
**Tipo:** data migration

### Tarea
Generar token durable para tarjetas existentes.

### Valor
Permite transición a routing estable.

### Dependencia
C3-001

---

# P1 — Routing público durable

## C3-005 — Implementar `GET /c/:public_token`
**Tipo:** backend / route

### Tarea
Resolver tarjeta por token y redirigir a perfil.

### Valor
Crea la base durable de NFC.

### Dependencia
C3-001, C3-002, C3-004

---

## C3-006 — Manejo de estados inválidos
**Tipo:** backend / UX

### Tarea
Responder páginas seguras para:
- revoked
- lost
- replaced
- not found
- pending activation

### Valor
Evita comportamiento ambiguo y mejora operación.

### Dependencia
C3-005

---

## C3-007 — Logging de scans
**Tipo:** backend / telemetry

### Tarea
En cada `/c/:public_token`, insertar en `card_scans`.

### Valor
Da visibilidad real del uso por tarjeta.

### Dependencia
C3-002, C3-005

---

# P2 — Operación admin

## C3-008 — Vista admin de tarjetas
**Tipo:** frontend / admin

### Tarea
Listar tarjetas con filtros:
- org
- perfil
- estado
- fecha de emisión

### Valor
Hace operable el asset físico.

### Dependencia
C3-001

---

## C3-009 — Activar tarjeta
**Tipo:** backend + admin UI

### Tarea
Acción admin/operator para pasar a `active`.

### Valor
Formaliza lifecycle.

### Dependencia
C3-003, C3-008

---

## C3-010 — Revocar / suspender tarjeta
**Tipo:** backend + admin UI

### Tarea
Permitir suspensión o revocación con motivo.

### Valor
Mitiga tarjetas comprometidas o perdidas.

### Dependencia
C3-003, C3-008

---

## C3-011 — Reemplazar tarjeta
**Tipo:** backend + admin UI

### Tarea
Emitir nueva tarjeta y enlazar `replaced_by_card_id`.

### Valor
Permite continuidad de servicio sin perder trazabilidad.

### Dependencia
C3-009, C3-010

---

# P3 — Riesgo y observabilidad

## C3-012 — Risk score inicial
**Tipo:** backend / analytics

### Tarea
Calcular score simple por scan.

### Valor
Primer nivel de detección de clonación/anomalías.

### Dependencia
C3-007

---

## C3-013 — Alertas operativas
**Tipo:** ops / monitoring

### Tarea
Alertar sobre:
- scans sospechosos
- tarjetas revocadas con tráfico
- volumen anómalo

### Valor
Reduce tiempo de respuesta.

### Dependencia
C3-012

---

## C3-014 — Historial de scans por tarjeta
**Tipo:** admin / observability

### Tarea
Mostrar últimos scans y flags de riesgo.

### Valor
Mejora soporte, fraude y diagnóstico.

### Dependencia
C3-007, C3-012

---

# P4 — Integración comercial

## C3-015 — Vincular emisión a órdenes
**Tipo:** backend / business flow

### Tarea
Crear tarjetas desde órdenes elegibles.

### Valor
Conecta fulfillment con activo físico.

### Dependencia
C3-001, C3-003

---

## C3-016 — Integrar con inventario
**Tipo:** backend / ops

### Tarea
Descontar stock o registrar movimiento asociado a emisión.

### Valor
Conecta operación física con sistema.

### Dependencia
C3-015

---

# P5 — Transición y compatibilidad

## C3-017 — Inventario de URLs ya emitidas
**Tipo:** ops

### Tarea
Identificar tarjetas/QR ya emitidos con `/:slug`.

### Valor
Evita romper activos físicos ya en la calle.

### Dependencia
Ninguna.

---

## C3-018 — Plan de transición `/:slug` -> `/c/:public_token`
**Tipo:** ops / product

### Tarea
Definir coexistencia temporal y sunset de modelo antiguo.

### Valor
Protege continuidad comercial.

### Dependencia
C3-017, C3-005

---

# Recomendación de ejecución

## Sprint 1
- C3-001
- C3-002
- C3-003
- C3-004

## Sprint 2
- C3-005
- C3-006
- C3-007

## Sprint 3
- C3-008
- C3-009
- C3-010
- C3-011

## Sprint 4
- C3-012
- C3-013
- C3-014

## Sprint 5
- C3-015
- C3-016
- C3-017
- C3-018

---

# Decisión ejecutiva
Si el objetivo es proteger la inversión en tarjetas físicas, el primer paquete que sí o sí deberías ejecutar es:
- C3-001
- C3-002
- C3-003
- C3-004
- C3-005

Ese bloque es el que convierte NFC en una capacidad durable en vez de un hack de slug.
