# NexCard — Fase C3: Modelo NFC productivo

## Objetivo
Diseñar el modelo definitivo para que las tarjetas NFC sean un activo durable, seguro y operable a escala.

Esta fase cubre:
1. modelo de datos de tarjetas
2. routing público estable
3. activación / revocación / reemplazo
4. tracking y detección de anomalías
5. implicancias operativas
6. roadmap de implementación

---

# 1. Problema a resolver

En un MVP, la tarjeta suele apuntar a una URL del perfil (`/:slug`).
Eso es simple, pero estructuralmente frágil:

- si cambia el routing, rompes tarjetas físicas
- si cambias el slug, rompes tarjetas físicas
- no puedes revocar una tarjeta individual sin tocar el perfil
- no puedes medir realmente comportamiento por tarjeta
- no puedes diferenciar clonación de uso legítimo

## Conclusión
La tarjeta NFC no debe resolver directo a `profiles.slug`.
Debe resolver a una entidad propia: `cards.public_token`.

---

# 2. Arquitectura objetivo

## 2.1 URL pública estable
### Hoy (frágil)
- `https://nexcard.cl/carlos-alvarez`

### Objetivo (durable)
- `https://nexcard.cl/c/<public_token>`

Donde:
- `public_token` representa la tarjeta
- el backend decide a qué perfil o destino redirigir

## 2.2 Ventajas
- tarjeta desacoplada del slug
- revocación individual
- reemplazo de perfil sin reemitir URL pública
- trazabilidad por tarjeta
- soporte a multi-tenant

---

# 3. Modelo de datos recomendado

## 3.1 Tabla `cards`
Campos recomendados:
- `id uuid pk`
- `organization_id uuid not null`
- `profile_id uuid nullable`
- `order_id uuid nullable`
- `card_code text unique not null`
- `public_token text unique not null`
- `status text not null`
- `activation_status text not null`
- `issued_at timestamptz not null`
- `assigned_at timestamptz nullable`
- `activated_at timestamptz nullable`
- `revoked_at timestamptz nullable`
- `replaced_by_card_id uuid nullable`
- `replacement_reason text nullable`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz nullable`

## 3.2 Campos clave
### `card_code`
Identificador interno/logístico.
Puede estar impreso o ligado a batch.
No debe ser la URL pública.

### `public_token`
Token no predecible usado en la URL NFC.

Requisitos:
- alto nivel de entropía
- no incremental
- no derivable del `id`
- ideal: nanoid / token random URL-safe

### `status`
Estados recomendados:
- `printed`
- `assigned`
- `active`
- `suspended`
- `revoked`
- `lost`
- `replaced`
- `archived`

### `activation_status`
Separar activación lógica de estado operativo ayuda.
Ejemplo:
- `pending`
- `activated`
- `revoked`

## 3.3 Tabla `card_scans`
Campos recomendados:
- `id uuid pk`
- `card_id uuid not null`
- `profile_id uuid nullable`
- `organization_id uuid nullable`
- `scan_source text not null` (`nfc`, `qr`, `manual`, `unknown`)
- `ip_hash text nullable`
- `country text nullable`
- `region text nullable`
- `city text nullable`
- `user_agent text nullable`
- `referrer text nullable`
- `risk_score integer default 0`
- `created_at timestamptz not null default now()`

## 3.4 Tabla `card_events`
Eventos de lifecycle.

Campos:
- `id uuid pk`
- `card_id uuid not null`
- `event_type text not null`
- `actor_user_id uuid nullable`
- `context jsonb`
- `created_at timestamptz not null default now()`

Ejemplos de `event_type`:
- `issued`
- `assigned`
- `activated`
- `profile_changed`
- `suspended`
- `revoked`
- `replaced`
- `scan_anomaly_detected`

---

# 4. Routing público

## 4.1 Endpoint recomendado
### `GET /c/:public_token`

Flujo:
1. resolver tarjeta por `public_token`
2. validar existencia
3. validar que no esté `revoked`, `lost`, `archived`
4. registrar scan
5. resolver perfil/destino actual
6. redirigir o renderizar

## 4.2 Respuestas posibles
### Caso normal
- tarjeta activa
- perfil válido
- redirect 302 a `/:slug`
  o render directo del perfil si conviene SSR/app router

### Caso suspendida/revocada
- página segura tipo:
  - “Tarjeta no disponible”
  - opcional contacto soporte

### Caso sin perfil asignado
- página de activación o estado pendiente

## 4.3 Regla crítica
La URL de la tarjeta debe sobrevivir aunque:
- cambie el slug
- cambie el perfil asociado
- cambie la estructura del frontend

---

# 5. Reglas de seguridad

## 5.1 Lo que jamás debe ser público
- metadata sensible interna de tarjeta
- estado interno de pago
- historial completo de scans
- asignaciones internas
- relaciones logísticas completas

## 5.2 Lo que sí puede exponerse indirectamente
- resolución pública de tarjeta activa
- redirección al perfil vigente
- página de activación/soporte si aplica

## 5.3 Escrituras
Toda escritura de tarjetas debe pasar por backend privilegiado:
- emitir
- asignar
- activar
- revocar
- reemplazar
- cambiar perfil asociado

Nunca desde frontend directo.

---

# 6. Activación, revocación y reemplazo

## 6.1 Flujo de activación
1. tarjeta creada en estado `printed`
2. tarjeta asignada a orden o perfil
3. usuario/operador activa tarjeta
4. `status -> active`
5. se registra `card_events.activated`

## 6.2 Flujo de revocación
1. operador/admin marca tarjeta comprometida o perdida
2. `status -> revoked` o `lost`
3. `revoked_at` se completa
4. endpoint público deja de redirigir a perfil
5. se registra `card_events.revoked`

## 6.3 Flujo de reemplazo
1. tarjeta anterior marcada `replaced`
2. nueva tarjeta emitida
3. `replaced_by_card_id` apunta a la nueva
4. historial conserva trazabilidad

---

# 7. Detección de anomalías

## 7.1 Señales mínimas
Disparar alerta si:
- misma tarjeta aparece en múltiples países en una ventana muy corta
- misma tarjeta tiene scans masivos en poco tiempo
- user agents extraños o automatizados dominan el tráfico
- tarjeta suspendida sigue recibiendo tráfico alto

## 7.2 Riesgo inicial simple
Implementar `risk_score` básico por reglas:
- +40: cambio de país en < 1h
- +30: >N scans en 10 min
- +20: user-agent anómalo
- +10: referrer inconsistente

## 7.3 Acción recomendada
- score bajo: registrar
- score medio: marcar observación
- score alto: alerta + revisión manual
- score crítico: auto-suspend opcional en el futuro

---

# 8. Relación con perfiles y organizaciones

## 8.1 `profile_id` nullable
Porque no todas las tarjetas tienen que estar asignadas desde el primer día.

## 8.2 `organization_id` obligatorio
Sirve para:
- tenancy
- operación empresarial
- reportes
- permisos

## 8.3 `order_id` nullable
Permite trazabilidad comercial:
- qué orden originó la tarjeta
- costo / emisión / fulfillment

---

# 9. Policies recomendadas

## Público
No acceso directo a tabla `cards` por token desde cliente general.
Idealmente la resolución pública se hace vía endpoint/backend controlado.

## Owner
Puede leer tarjetas propias asignadas a su perfil.

## Organization owner/operator
Puede leer tarjetas de su organización.
Escritura según rol, preferentemente backend mediado.

## Admin
Acceso total.

---

# 10. Implicancias de implementación

## 10.1 Cambios de schema requeridos
- agregar `public_token`
- agregar estados más precisos
- agregar timestamps de lifecycle
- crear `card_scans`
- crear `card_events`
- opcional `deleted_at`

## 10.2 Cambios de app requeridos
- crear endpoint `/c/:public_token`
- separar resolución pública de tarjeta de la vista pública de perfil
- dashboard admin de cards
- historial de scans
- opción de revocar/reemplazar

## 10.3 Cambios operativos requeridos
- proceso de emisión
- proceso de activación
- proceso de revocación
- soporte para tarjeta perdida/clonada

---

# 11. Roadmap recomendado

## C3.1 — Base estructural
- migración `cards.public_token`
- generar token para tarjetas existentes
- agregar lifecycle fields

## C3.2 — Routing público
- endpoint `/c/:public_token`
- registrar `card_scans`
- redirección a perfil

## C3.3 — Operación
- acciones admin: assign / activate / revoke / replace
- listado de cards por org y perfil

## C3.4 — Riesgo
- detección simple de anomalías
- alertas
- panel de revisiones

---

# 12. Recomendación concreta

## Decisión estructural
Adoptar definitivamente:
- tarjeta física = entidad `cards`
- URL NFC = `/c/:public_token`
- perfil público = destino, no identificador primario de la tarjeta

## Por qué
Porque reduce:
- fragilidad de URLs
- costo futuro de migraciones
- riesgo operativo
- dificultad de revocación
- ceguera analítica

Y aumenta:
- durabilidad
- trazabilidad
- seguridad
- escalabilidad

---

# 13. Conclusión
Si NexCard va a imprimir y emitir tarjetas a escala, este bloque no es opcional.
El modelo NFC define la capacidad de crecer sin rehacer el sistema cuando ya haya activos físicos en la calle.

Diseñar bien `cards` hoy es mucho más barato que perseguir tarjetas rotas, clonadas o imposibles de revocar mañana.
