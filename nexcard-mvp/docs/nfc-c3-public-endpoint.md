# NexCard — Diseño del endpoint público `/c/:public_token`

## Objetivo
Definir el comportamiento funcional y técnico del endpoint público que resuelve tarjetas NFC de forma durable.

---

# 1. Ruta objetivo

## Endpoint público
- `GET /c/:public_token`

## Propósito
Resolver una tarjeta física a su destino digital vigente sin acoplar la tarjeta a `profiles.slug`.

---

# 2. Flujo funcional

## Paso 1 — Recibir token
El usuario escanea tarjeta NFC y abre:
- `/c/:public_token`

## Paso 2 — Resolver tarjeta
Backend consulta:
- `cards` por `public_token`
- `profiles` asociado si existe

Preferentemente a través de:
- `resolve_card_by_token(input_token)`

## Paso 3 — Validar estado
### Casos válidos
- `active`
- eventualmente `assigned` si quieres permitir pre-activación controlada

### Casos no válidos
- `revoked`
- `lost`
- `replaced`
- `archived`
- `deleted_at is not null`

## Paso 4 — Registrar scan
Insertar en `card_scans`:
- `card_id`
- `profile_id`
- `organization_id`
- `scan_source`
- `ip_hash`
- `country`
- `region`
- `city`
- `user_agent`
- `referrer`
- `risk_score`

## Paso 5 — Decidir respuesta
### Si tarjeta activa y perfil existe
- redirect a `/:slug`
  o render directo del perfil

### Si tarjeta activa sin perfil
- pantalla “tarjeta pendiente de activación”

### Si tarjeta revocada/perdida
- pantalla segura “tarjeta no disponible”

### Si token no existe
- 404 controlado

---

# 3. Reglas de respuesta

## 3.1 Redirect vs render
### Redirect a perfil
Ventajas:
- mínimo cambio en app actual
- conserva vista pública existente
- desacopla resolución de presentación

### Render directo
Ventajas:
- unifica tracking y render
- puede mejorar performance más adelante

## Recomendación
Partir con:
- `302 redirect` a `/:slug`

Porque reduce costo inicial de implementación.

---

# 4. Seguridad del endpoint

## No exponer detalles internos
Si el token existe pero la tarjeta no es válida:
- no exponer estado interno exacto
- responder mensaje genérico seguro

## Rate limiting recomendado
Aplicar rate limit básico por:
- IP
- token

## Hash de IP
No guardar IP cruda si no es necesario.
Ideal:
- hash o truncamiento

## Source tagging
Registrar si el acceso parece venir de:
- NFC
- QR
- manual
- unknown

---

# 5. Riesgo / score inicial

## Heurística inicial simple
Asignar `risk_score` por reglas:
- base 0
- +40 si cambia país en ventana corta
- +30 si volumen de scans supera umbral
- +20 si user agent es sospechoso
- +10 si referrer inconsistente

## Acción inicial
No bloquear automáticamente en v1.
Solo registrar y alertar.

---

# 6. Casos de uso

## Caso A — tarjeta activa normal
- token válido
- tarjeta activa
- perfil activo
- registra scan
- redirect a perfil

## Caso B — tarjeta emitida pero no activada
- token válido
- tarjeta `printed` o `assigned`
- render “pendiente de activación”

## Caso C — tarjeta revocada
- token válido
- tarjeta revocada
- render seguro, sin detalles internos

## Caso D — tarjeta reemplazada
- política recomendada:
  - o responder “tarjeta no disponible”
  - o redirigir a nueva tarjeta solo si el negocio lo requiere

## Caso E — token inexistente
- 404 controlado

---

# 7. Integración con scans y analytics

## Eventos públicos actuales
Ya existe tracking general en `events`.

## Recomendación
No mezclar del todo:
- `events` = interacción general de producto
- `card_scans` = telemetría específica de activo NFC

## Beneficio
Separar métricas operativas de tarjetas de métricas generales de perfil.

---

# 8. Requisitos técnicos mínimos

## Backend
Necesitas un entorno que pueda:
- consultar Supabase con seguridad
- registrar scan
- responder redirect/render

## Opciones válidas
- server route
- edge function
- API route protegida

## No recomendado
Resolver esto enteramente desde frontend público.

---

# 9. Pseudoflujo sugerido

```text
GET /c/:public_token
  -> resolve card by token
  -> if not found: 404
  -> if revoked/lost/archived: unavailable page
  -> insert card_scans row
  -> if no profile: activation pending page
  -> redirect to /:slug
```

---

# 10. Roadmap de implementación del endpoint

## V1
- resolver token
- validar estado
- log scan
- redirect a slug

## V2
- geolocalización / risk score
- panel de scans por tarjeta
- alertas

## V3
- respuestas dinámicas por org
- auto-suspensión opcional
- reconciliación con fraude / abuso

---

# 11. Decisión recomendada
Implementar `/c/:public_token` como capa de resolución pública mínima, con:
- redirect 302 inicial
- logging en `card_scans`
- mensajes seguros en estados inválidos

Es la forma más barata de obtener:
- durabilidad
- trazabilidad
- revocación
- escalabilidad
sin rehacer toda la vista pública del perfil.
