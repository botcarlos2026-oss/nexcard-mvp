# NexCard — Fase A: integración de cards al flujo admin actual

## Objetivo
Aterrizar cómo las capacidades nuevas de `cards` deberían empezar a vivir en el producto/admin actual sin rehacer el panel completo.

---

# 1. Estado actual del código

## Admin actual
`AdminDashboard.jsx` hoy muestra:
- métricas
- perfiles
- pedidos recientes

Pero no muestra:
- tarjetas
- estado de lifecycle NFC
- scans por tarjeta
- acciones de revoke/archive

## Inventory actual
`InventoryDashboard.jsx` está orientado a stock, no a activos NFC emitidos.

## API actual
`src/services/api.js` hoy no expone operaciones específicas de `cards`.

---

# 2. Integración mínima recomendada

## 2.1 No hacer un panel nuevo desde cero todavía
La forma más rentable hoy es:
- agregar una vista/sección mínima de cards admin
- o una ruta admin secundaria

## 2.2 Capacidades mínimas a mostrar
### Lista mínima
- `card_code`
- `status`
- `activation_status`
- `profile_id` / referencia visible
- `deleted_at`

### Acciones mínimas
- `revoke`
- `archive`
- ver últimos eventos NFC

---

# 3. Diseño de integración recomendado

## Opción recomendada
Agregar primero una ruta nueva:
- `/admin/cards`

### Por qué
- reduce ruido en dashboard principal
- separa lifecycle físico/digital del resto del admin
- permite escalar luego con scans y filtros sin contaminar la vista principal

---

# 4. API mínima necesaria

## Lectura
### `getCardsAdmin()`
Debe devolver dataset mínimo de tarjetas.

Idealmente desde Supabase:
- `cards`
- opcional relación con `profiles`

## Acción revoke
### `revokeCard(cardId, reason)`
Al inicio puede ser invocación manual/backend-controlled.
Si todavía no quieres integrarlo al frontend real, al menos dejar contrato definido.

## Acción archive
### `archiveCard(cardId)`
Mismo criterio.

---

# 5. Guardrails ya necesarios en producto

## Público
`resolve_card_by_token()` y el bridge ya deben excluir:
- `deleted_at is not null`
- `status in ('archived', 'revoked')`

## Admin
Debe poder ver tarjetas archivadas/revocadas en una vista controlada.

## Owner
No necesita todavía lifecycle admin completo.

---

# 6. Cambio mínimo que sí conviene hacer pronto

## En backend bridge
Confirmar que el endpoint público trate explícitamente como inválidas:
- `archived`
- `revoked`
- `replaced`
- `lost`
- `suspended`

Eso ya está bastante encaminado, pero forma parte de esta fase de integración.

---

# 7. Resultado esperado de Fase A

Al cerrar Fase A deberías tener:
- diseño claro de `/admin/cards`
- contrato mínimo de lectura y acciones
- guardrails públicos consistentes con lifecycle
- base lista para una implementación pequeña pero útil

---

# 8. Recomendación ejecutiva

No conviene construir todavía un admin “bonito” de tarjetas.
Conviene construir un admin **útil** de tarjetas.

Primero:
- listar
- revocar
- archivar
- ver estado

Después:
- scans
- filtros avanzados
- analytics

Ese orden protege margen y tiempo.
