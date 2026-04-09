# NexCard — Bridge del endpoint NFC hacia Supabase real

## Objetivo
Definir e implementar un puente incremental desde el endpoint mock/local hacia resolución real en Supabase.

---

# 1. Estrategia adoptada

## Enfoque híbrido
El endpoint `GET /c/:publicToken` ahora intenta:
1. resolver contra Supabase real usando `resolve_card_by_token()`
2. registrar scan en `card_scans`
3. redirigir a `/:slug`
4. si Supabase falla, caer al mock local

## Ventaja
- no rompe flujo local
- acelera validación con base real
- reduce riesgo durante transición

---

# 2. Dependencias necesarias

## Variables de entorno
- `REACT_APP_SUPABASE_URL` o `SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY` o `SUPABASE_ANON_KEY`

## Dependencias de base
- función `resolve_card_by_token(text)`
- tabla `card_scans`
- tabla `cards` con `public_token` y `status`

---

# 3. Flujo runtime

## Camino principal
### Supabase disponible
- RPC `resolve_card_by_token(input_token)`
- validación de estado
- insert en `card_scans`
- redirect a perfil

## Camino secundario
### Supabase falla o no está configurado
- fallback a `db.json`
- mantiene continuidad local/dev

---

# 4. Riesgos conocidos

## RLS en `card_scans`
Hoy existe la tabla, pero si no tiene policies adecuadas para inserción desde este bridge, el insert puede fallar.

### Comportamiento actual
Si falla el insert:
- no bloquea redirect
- se registra warning en servidor

## Uso de anon key en bridge
Sirve para validación inicial, pero no es la arquitectura final ideal.

### Futuro deseable
- route server-side con credenciales adecuadas
- o política explícita mínima de inserción para `card_scans`

---

# 5. Siguiente paso recomendado

## Corto plazo
- validar endpoint contra tokens reales de Supabase
- confirmar si `card_scans` acepta insert

## Medio plazo
- definir políticas RLS de `card_scans`
- definir si `resolve_card_by_token()` debe ocultar tarjetas no activas o pending

## Largo plazo
- convertir este bridge en endpoint productivo definitivo
- eventualmente moverlo a runtime server/edge más limpio

---

# 6. Criterio técnico
Este bridge no es la arquitectura final perfecta.
Es el punto medio correcto entre:
- seguridad ya existente
- stack actual del repo
- velocidad de implementación
- continuidad operacional

Ese equilibrio hoy vale más que una reescritura elegante pero lenta.
