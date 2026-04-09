# NexCard — Camino B aterrizado al stack actual

## Objetivo
Definir cómo introducir `/c/:public_token` usando la arquitectura actual de NexCard, sin vender una solución abstracta que no calce con el repo real.

Estado actual del stack:
- frontend React SPA con enrutamiento manual en `App.jsx`
- API local Express en `server/index.js`
- consumo principal productivo orientado a Supabase
- vista pública de perfil ya resuelta por `/:slug`

---

# 1. Realidad actual del proyecto

## 1.1 Frontend
El frontend actual:
- interpreta `window.location.pathname`
- resuelve `/` como landing
- resuelve `/login`, `/edit`, `/admin`, `/admin/inventory`, `/setup`
- cualquier otro path lo trata como `slug` de perfil

### Implicancia
Hoy si visitas:
- `/c/abc123`

la app probablemente interpretará el slug como:
- `c/abc123`

y fallará o no resolverá como corresponde.

## 1.2 Backend local
El backend Express actual:
- solo tiene `/api/...`
- no sirve rutas públicas amigables tipo `/c/:public_token`
- tampoco tiene integración real con `cards`

### Implicancia
No existe hoy una capa pública de resolución NFC.

---

# 2. Recomendación de integración

## Decisión recomendada
Implementar `/c/:public_token` primero como **ruta de frontend con resolución API**, y luego evolucionarla a ruta server-side productiva.

¿Por qué?
- menor costo inmediato
- aprovecha el stack actual
- evita rehacer toda la app ahora
- permite validar flujo NFC rápido

---

# 3. Implementación recomendada en dos etapas

## Etapa B1 — Integración inmediata en stack actual
### Qué hacer
1. agregar una rama explícita en `App.jsx` para detectar paths que empiecen con `/c/`
2. crear función `api.resolveCardToken(publicToken)`
3. hacer que esa función consulte un endpoint controlado
4. si tarjeta resuelve a slug válido, navegar/cargar perfil
5. registrar scan en backend o Supabase

### Ventaja
Se integra rápido sin rehacer render público.

### Limitación
No es la forma final más elegante, porque la resolución sigue pasando por SPA.

## Etapa B2 — Endpoint público server-side real
### Qué hacer
Mover la resolución a una ruta pública backend/edge:
- `GET /c/:public_token`

Y que responda:
- redirect 302 a `/:slug`
- o página segura según estado

### Ventaja
Es la solución correcta para producción.

### Mi recomendación
Hacer B1 primero solo si quieres validar rápido.
Pero si el objetivo es producción seria, apuntar directamente a B2.

---

# 4. Opción concreta recomendada para este repo

## Recomendación principal
Usar el backend Express actual como puente temporal productivo para `/c/:public_token`.

### Por qué esta es la mejor opción aquí
Porque ya tienes:
- `server/index.js`
- una API local existente
- lógica simple de rutas públicas

Agregar ahí un endpoint público temporal es más consistente que forzar la SPA a resolver todo sola.

---

# 5. Diseño de integración propuesto

## 5.1 Nuevo endpoint backend temporal
Agregar en `server/index.js`:
- `GET /c/:publicToken`

### Comportamiento temporal recomendado
#### En entorno local/mock
- resolver desde `db.cards`
- si tarjeta existe y está activa:
  - redirigir a `/${profile.slug}`
- si no existe:
  - responder 404 simple
- si no está activa:
  - responder página o JSON de indisponibilidad

#### En modo Supabase/productivo
Idealmente este endpoint luego debe consultar Supabase/server-side.

---

# 6. Cómo calza con el frontend actual

## No tocar la vista pública del perfil
Eso es clave.

El perfil público ya funciona en:
- `/:slug`

Entonces el endpoint `/c/:public_token` debe ser solo una capa de resolución.
No debería reemplazar aún a `NexCardProfile`.

## Flujo recomendado
1. NFC abre `/c/:public_token`
2. backend valida token
3. backend registra scan
4. backend redirige a `/:slug`
5. frontend actual carga perfil normalmente

### Beneficio
Cambias NFC sin rehacer el perfil público.

---

# 7. Integración con Supabase futura

## Solución transitoria
El Express actual puede servir como POC o puente.

## Solución productiva final
Migrar `/c/:public_token` a:
- API route server-side
- edge function
- server runtime del frontend productivo

## Razón
El backend público debe poder:
- leer `cards`
- escribir `card_scans`
- aplicar reglas de riesgo
- responder rápido

Sin depender de cliente público.

---

# 8. Riesgos del camino B en este stack

## Riesgo 1
Resolver `/c/:public_token` desde SPA solamente.

### Problema
- peor UX
- peor control de logging
- dependencia del cliente

## Riesgo 2
Acoplar de nuevo token a slug.

### Problema
Pierdes el beneficio estructural del modelo nuevo.

## Riesgo 3
No registrar scans en la capa de resolución.

### Problema
La tarjeta sigue sin trazabilidad real.

---

# 9. Recomendación concreta por prioridad

## Prioridad inmediata
### Implementar backend temporal
- `GET /c/:public_token` en Express
- redirect a `/:slug`
- placeholder de estados inválidos

## Prioridad siguiente
### Conectar a Supabase real
- leer `cards`
- leer `profiles`
- escribir `card_scans`

## Prioridad posterior
### Migrar a endpoint productivo definitivo
- edge/server route
- logging enriquecido
- geolocalización/risk score

---

# 10. Cambios concretos por archivo

## `server/index.js`
Agregar:
- endpoint `GET /c/:publicToken`
- helper para resolver tarjeta
- registro temporal de scan o placeholder

## `server/data/*.json`
Agregar mocks de `cards` si se usa flujo local

## `src/App.jsx`
Opcionalmente no requiere cambio si el redirect lo maneja backend.

## `src/services/api.js`
Solo necesario si decides resolver token desde frontend, lo cual no recomiendo como primera versión.

---

# 11. Decisión final recomendada

Para este repo y su estado actual, el Camino B correcto es:

## B recomendado
**Agregar `/c/:public_token` en backend Express como puente temporal**, con redirect a `/:slug`.

No usar la SPA como resolvedor principal.

## Motivo
Es el punto medio óptimo entre:
- costo de implementación
- limpieza arquitectónica
- continuidad con el código actual
- preparación para la versión productiva seria

---

# 12. Conclusión
El stack actual todavía no está montado como aplicación server-rendered ni como edge-first app.
Por eso la forma más inteligente de introducir NFC durable ahora es:
- backend resuelve token
- frontend mantiene la vista pública existente
- luego migras esa capa a una implementación más seria sin romper el concepto

Ese es el Camino B más rentable hoy.
