# NexCard — Ruta 2.3: Cards lifecycle audit, versioning y soft delete

## Objetivo
Llevar el patrón validado en `profiles` hacia `cards`, que es el siguiente activo crítico del sistema.

Esta fase busca que `cards` sea:
- auditable
- versionable cuando corresponda
- soft-deletable / archivable
- operable con historial de lifecycle

---

# 1. Por qué `cards` es la siguiente entidad correcta

`cards` no es solo una tabla más.
Representa:
- activo físico emitido
- punto de entrada al perfil digital
- componente clave del modelo NFC

Si una tarjeta se activa, revoca, reemplaza o reasigna sin trazabilidad, el riesgo operativo sube rápido.

---

# 2. Qué eventos importan en `cards`

## Eventos mínimos a registrar
- `card_snapshot`
- `card_assign`
- `card_activate`
- `card_suspend`
- `card_revoke`
- `card_replace`
- `card_soft_delete`
- `card_restore` (si se habilita luego)

## Dónde registrarlos
- `audit_log` para trazabilidad operativa global
- `card_events` para lifecycle específico NFC

---

# 3. Versionado en `cards`

## ¿Hace falta una tabla tipo `card_versions`?
Mi recomendación inicial:
- **todavía no** como primera iteración

## Por qué
En `cards`, muchas acciones importantes ya viven como lifecycle/eventos.
El valor inicial más alto está en:
- snapshot antes de cambios sensibles
- audit claro
- card_events consistente

## Recomendación pragmática
Crear una tabla `card_versions` solo si empiezas a tener cambios complejos de payload/metadata/configuración de tarjeta.

Mientras tanto:
- `audit_log` + `card_events` + snapshot JSON puntual es suficiente

---

# 4. Soft delete para `cards`

## Regla
No borrar físicamente tarjetas por defecto.

## Acción recomendada
- `deleted_at = now()`
- `status = 'archived'` o `status = 'replaced'` según el caso
- registrar `audit_log`
- registrar `card_events`

## Lectura pública
Una tarjeta con `deleted_at` no debe resolverse como activa en `/c/:public_token`.

---

# 5. Helpers recomendados

## Fase mínima
- `snapshot_card(card_id, actor_id)`
- `soft_delete_card(card_id, actor_id)`
- `activate_card(card_id, actor_id)`
- `revoke_card(card_id, actor_id, reason)`

## Beneficio
Empiezas a formalizar lifecycle sensible sin depender de updates ad hoc.

---

# 6. Snapshot de tarjeta

## Qué guardar
Snapshot completo de la fila `cards` como JSONB antes de cambios sensibles.

## Dónde guardarlo
Opciones:
- en `audit_log.before/after`
- o en tabla dedicada `card_versions`

## Recomendación actual
Primero usar `audit_log` + `card_events`.
No introducir `card_versions` todavía, salvo que el modelo se vuelva más complejo.

---

# 7. Casos mínimos a cubrir

## Activación
- snapshot previo si cambia estado
- update `status/activation_status/activated_at`
- `audit_log`
- `card_events`

## Revocación
- snapshot previo
- update `status = 'revoked'`
- `revoked_at = now()`
- registrar motivo en `context`

## Soft delete / archive
- snapshot previo
- `deleted_at = now()`
- `status = 'archived'`
- log en ambas capas

---

# 8. Integración con resolución NFC

La función `resolve_card_by_token()` y el endpoint `/c/:public_token` deben respetar:
- `deleted_at is null`
- estados válidos (`active`, opcionalmente `assigned` si el negocio lo permite)

Esto conecta Ruta 2 con C3 de forma natural.

---

# 9. Recomendación ejecutiva

## Primer bloque correcto de Ruta 2.3
1. helper `snapshot_card()`
2. helper `soft_delete_card()`
3. helper `revoke_card()`
4. registrar `card_events`
5. luego revisar `resolve_card_by_token()` para endurecer estados válidos

---

# 10. Conclusión
Perfiles ya demostraron que el patrón de resiliencia funciona.
La siguiente entidad lógica es `cards`, porque ahí se cruza:
- operación física
- seguridad
- reputación del producto
- trazabilidad NFC

Si `cards` gana lifecycle serio, NexCard sube varios peldaños de madurez operativa.
