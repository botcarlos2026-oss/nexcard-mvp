# NexCard — Fase B: tests para lifecycle de cards y guardrails

## Objetivo
Definir pruebas reproducibles para que el lifecycle de `cards` no dependa de validaciones manuales aisladas.

---

# 1. Qué ya existe

## Ya cubierto
- bridge NFC básico por token
- guardrail de perfil soft-deleted

## Falta cubrir
- tarjeta revocada no debe resolverse como activa
- tarjeta archivada no debe resolverse como activa
- lifecycle admin/helper debe dejar rastro consistente

---

# 2. Cobertura recomendada

## Test 1 — revoked token guard
### Objetivo
Si una tarjeta está revocada, `/c/:public_token` no debe redirigir a perfil activo.

### Expectativa
- HTTP 410 o respuesta segura equivalente

## Test 2 — archived token guard
### Objetivo
Si una tarjeta está archivada (`deleted_at != null` / `status = archived`), el bridge no debe resolverla como activa.

### Expectativa
- HTTP 410 / 404 según implementación

## Test 3 — cards admin dataset
### Objetivo
La futura ruta `/admin/cards` debe poder listar estados mínimos coherentes.

## Test 4 — audit trail consistency
### Objetivo
Después de revoke/archive, el estado en `cards`, `card_events` y `audit_log` debe ser consistente.

---

# 3. Estrategia de test en esta etapa

## No intentar todo desde UI todavía
En esta fase conviene separar:
- tests HTTP/bridge
- validaciones SQL/manuales de consistencia

## Recomendación
Agregar tests Cypress para:
- bridge revoked
- bridge archived

Y mantener por ahora playbook SQL/manual para:
- audit consistency
- lifecycle helper validation

---

# 4. Variables sugeridas para Cypress

## Revoked token
- `CYPRESS_revoked_nfc_token`

## Archived token
- `CYPRESS_archived_nfc_token`

## Expected status text (opcional)
- `CYPRESS_revoked_expected_status`
- `CYPRESS_archived_expected_status`

---

# 5. Resultado esperado de Fase B

Al cerrar Fase B deberías tener:
- tests reproducibles para guardrails NFC en estados inválidos
- menos dependencia de prueba manual para regressions importantes

---

# 6. Recomendación ejecutiva

El valor principal de Fase B no es cobertura total.
Es capturar los guardrails más caros de romper:
- no exponer tarjetas archivadas
- no exponer tarjetas revocadas

Ese es el tipo de regresión que sí cuesta reputación.
