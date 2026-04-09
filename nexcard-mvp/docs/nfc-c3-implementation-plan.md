# NexCard — Plan de implementación C3 (NFC productivo)

## Objetivo
Convertir el diseño NFC de NexCard en un plan ejecutable por fases, minimizando riesgo operativo y evitando romper tarjetas ya emitidas.

---

# Fase 0 — Preparación

## Checklist
- [ ] confirmar cuántas tarjetas existen hoy en `cards`
- [ ] confirmar si alguna URL NFC física ya apunta directo a `/:slug`
- [ ] confirmar si existe QR asociado a tarjetas existentes
- [ ] identificar entorno staging para pruebas

## Riesgo principal
Si ya hay tarjetas físicas emitidas con URL vieja, no se puede simplemente cortar compatibilidad sin estrategia de transición.

---

# Fase 1 — Extensión de schema

## Objetivo
Preparar `cards` para operar como activo durable.

## Cambios recomendados
### Tabla `cards`
Agregar:
- `public_token text unique`
- `issued_at timestamptz`
- `assigned_at timestamptz`
- `activated_at timestamptz`
- `revoked_at timestamptz`
- `replaced_by_card_id uuid nullable`
- `replacement_reason text nullable`
- `deleted_at timestamptz nullable`
- `metadata jsonb default '{}'::jsonb`

### Nueva tabla `card_scans`
Para trazabilidad de scans.

### Nueva tabla `card_events`
Para lifecycle y auditoría específica de tarjetas.

## Entregable
- migración SQL formal

---

# Fase 2 — Backfill y compatibilidad

## Objetivo
Poblar tokens y mantener compatibilidad con activos existentes.

## Acciones
- generar `public_token` único para todas las tarjetas existentes
- marcar estado inicial coherente (`printed`, `assigned`, `active` según caso)
- si hoy la tarjeta no está ligada bien a perfil, dejar reglas de asignación pendiente

## Decisión crítica
Si ya existen tarjetas físicas con URL antigua:
- mantener compatibilidad temporal con `/:slug`
- nuevas tarjetas salen con `/c/:public_token`
- después definir plan de sunset de modelo antiguo

---

# Fase 3 — Routing público

## Objetivo
Introducir resolución pública por token.

## Entregables
- endpoint o ruta pública `/c/:public_token`
- lookup de tarjeta por token
- validación de estado
- redirect o render al perfil actual
- inserción de `card_scans`

## Reglas de negocio
### Si tarjeta está `active`
- registrar scan
- resolver perfil
- redirigir

### Si tarjeta está `suspended` / `revoked` / `lost`
- responder vista segura sin exponer detalles internos

### Si tarjeta no tiene `profile_id`
- responder vista de activación o pendiente

---

# Fase 4 — Operación admin

## Objetivo
Permitir gestión real de tarjetas.

## Capacidades mínimas
- listar tarjetas por organización
- filtrar por estado
- ver perfil asignado
- activar tarjeta
- suspender tarjeta
- revocar tarjeta
- reemplazar tarjeta
- ver historial de scans

## Reglas de UI
- acciones sensibles con confirmación
- no exponer `public_token` innecesariamente en pantallas abiertas
- separar “vista operativa” de “vista comercial”

---

# Fase 5 — Detección de anomalías

## Objetivo
Agregar control de riesgo NFC.

## MVP de riesgo
- job o query para detectar cambios de país en ventana corta
- volumen anormal por tarjeta
- tarjetas revocadas con tráfico

## Salidas
- `risk_score`
- marca de revisión
- evento en `card_events`

---

# Fase 6 — Integración comercial

## Objetivo
Conectar emisión y fulfillment con órdenes.

## Flujo objetivo
1. orden pagada
2. fulfillment crea tarjetas
3. tarjetas quedan `printed`
4. asignación a perfil/cliente
5. activación

## Beneficio
Esto une:
- pedido
- inventario
- tarjeta
- perfil
- scans

---

# SQL / backend recomendados

## SQL / schema
- migración `cards_public_token_and_lifecycle`
- tabla `card_scans`
- tabla `card_events`
- índices por `public_token`, `organization_id`, `profile_id`, `status`

## Backend
- resolver-card-by-token
- activate-card
- revoke-card
- replace-card
- assign-card-to-profile

---

# Dependencias

## Requiere ya resuelto
- B.2 / B.3 de RLS
- modelo de memberships
- acceso admin consistente

## Conviene tener antes o en paralelo
- `audit_log`
- soft delete
- migraciones formales

---

# Riesgos de implementación

## Riesgo 1
Romper compatibilidad con tarjetas ya emitidas.

### Mitigación
- transición gradual
- compatibilidad temporal
- inventario de tarjetas emitidas

## Riesgo 2
No tener proceso claro de activación/revocación.

### Mitigación
- workflow admin simple primero
- luego automatización

## Riesgo 3
Guardar scans sin utilidad operativa.

### Mitigación
- definir desde el inicio qué alertas y métricas usarás

---

# Orden recomendado de ejecución

1. migración de `cards`
2. crear `card_scans` y `card_events`
3. backfill `public_token`
4. implementar `/c/:public_token`
5. panel admin mínimo de tarjetas
6. revocación / reemplazo
7. reglas de anomalía

---

# Decisión recomendada
La próxima implementación concreta de valor en NexCard debería ser:

## "Tarjeta como activo durable"
No una página nueva, no otro panel visual.
Primero:
- `public_token`
- routing estable
- trazabilidad
- revocación

Porque eso protege la inversión física en tarjetas y crea una base escalable de verdad.
