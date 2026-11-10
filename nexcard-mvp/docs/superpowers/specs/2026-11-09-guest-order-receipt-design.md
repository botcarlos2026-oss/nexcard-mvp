# P1-01 — Recibo seguro para checkout guest y retorno de Mercado Pago

Fecha: 2026-11-09
Estado: diseño aprobado
Propietario de implementación: `nexcard-dev`
Propietario de QA/release: `nexcard-qa`

## 1. Problema confirmado

`create_order_with_items(p_order, p_items)` permite crear una orden guest mediante `SECURITY DEFINER`, pero retorna únicamente el UUID. Inmediatamente después, `src/services/api/orders.js` intenta recuperar la fila mediante `select * from orders`. El retorno desde Mercado Pago repite una lectura directa de `orders` en `src/hooks/useCheckoutFlow.js`.

La política `orders_owner_read` concede lectura solo a usuarios `authenticated` cuyo `user_id = auth.uid()`. Un guest no cumple esa condición. Resultado:

1. la orden puede crearse correctamente;
2. la recuperación posterior es bloqueada por RLS;
3. el checkout muestra `Orden creada pero no se pudo recuperar` antes de redirigir a Mercado Pago;
4. el retorno de pago depende de un snapshot de la misma pestaña y no puede verificar el estado mediante la tabla base.

Reproducción de contrato realizada sobre `origin/main`:

- el RPC retorna `uuid`;
- creación y retorno consultan `orders` directamente;
- no existe RPC acotada para recibos guest;
- lectura directa guest permanece denegada por RLS.

## 2. Objetivo

Permitir que un checkout guest recupere únicamente su recibo y estado mediante una prueba de posesión de alta entropía, sin abrir `SELECT` sobre `orders` ni exponer campos no necesarios.

El retorno seguro se soportará en el mismo navegador/pestaña que inició el checkout. Si falta la prueba local, la interfaz mostrará una confirmación genérica sin PII.

## 3. No objetivos

- No soportar recuperación cross-device o cross-browser en este P1.
- No agregar tokens al query string ni a las URLs de retorno de Mercado Pago.
- No confiar en `payment=success` como prueba de pago.
- No modificar la máquina de estados de pagos o fulfillment.
- No ejecutar cobros reales ni Gate G.
- No abrir políticas públicas de lectura sobre `orders`.
- No devolver dirección, teléfono, RUT, razón social, personalización, fingerprints ni datos internos del pago.

## 4. Arquitectura aprobada

### 4.1 RPC acotada

Agregar una migración con una función nueva:

`public.get_guest_order_receipt(p_order_id uuid, p_checkout_attempt_id text, p_checkout_fingerprint text) returns table (...)`

El resultado será cero o una fila. El cliente normalizará la respuesta RPC al primer elemento antes de exponer el recibo al resto de la aplicación.

Propiedades obligatorias:

- `SECURITY DEFINER`;
- `SET search_path = public`;
- parámetros no nulos y no vacíos;
- comparación exacta de `id`, `client_checkout_attempt_id` y `client_checkout_fingerprint`;
- exclusión de filas con `deleted_at is not null`;
- resultado vacío tanto para orden inexistente como para prueba inválida;
- sin excepciones que revelen si el UUID existe;
- `REVOKE ALL ... FROM PUBLIC`;
- `GRANT EXECUTE` únicamente a `anon`, `authenticated` y `service_role`;
- ninguna política RLS nueva sobre `orders`.

La función devolverá solo:

- `id`;
- `folio`;
- `customer_email`;
- `payment_method`;
- `payment_status`;
- `paid_at`;
- `fulfillment_status`;
- `amount_cents`;
- `currency`;
- `created_at`;
- `updated_at`.

### 4.2 Contrato frontend

`createOrdersApi.createOrder(payload)` mantendrá `create_order_with_items` como operación de escritura e idempotencia. Con el UUID retornado llamará a `get_guest_order_receipt` usando los mismos `client_checkout_attempt_id` y `client_checkout_fingerprint` enviados al RPC de creación.

Se elimina del flujo guest la lectura directa `from('orders').select('*')`.

La respuesta pública de `createOrder` será el recibo seguro. Una prueba inválida o un recibo ausente producirá un error genérico; no se intentará degradar a lectura pública de la tabla base.

### 4.3 Persistencia de pestaña

Separar en `sessionStorage`:

- snapshot del recibo seguro usado por la confirmación;
- prueba de checkout con `orderId`, `clientCheckoutAttemptId` y `clientCheckoutFingerprint`.

La prueba debe persistirse antes de redirigir a Mercado Pago. Su alcance es la pestaña y expira al cerrar la sesión de navegador. Un checkout nuevo reemplaza la prueba anterior. No se serializará en URLs, analytics ni logs.

### 4.4 Retorno desde Mercado Pago

Al detectar `payment` y `order`:

1. limpiar los parámetros de la barra mediante `history.replaceState`;
2. cargar la prueba local;
3. verificar que su `orderId` coincide exactamente con el de la URL;
4. si no coincide o no existe, mostrar confirmación genérica sin email, monto ni otros datos;
5. si coincide, consultar `get_guest_order_receipt`;
6. nunca convertir `payment=success` en `payment_status=paid`;
7. usar exclusivamente el estado devuelto por Supabase.

Para `payment=success`, la consulta será inmediata y luego se repetirá cada 3 segundos durante un máximo de 30 segundos. El sondeo termina al recibir `payment_status=paid`, al desmontar el componente o al vencer el plazo.

Para `payment=failure` y `payment=pending`, se hará una consulta segura y se representará el estado real. El parámetro de retorno es una señal UX, no la fuente de verdad.

## 5. Manejo de errores

- Prueba ausente o `orderId` distinto: confirmación genérica, sin llamada con credenciales equivocadas.
- Prueba inválida, orden inexistente o soft-deleted: resultado vacío indistinguible y mensaje genérico.
- Error de red/RPC durante creación: informar que la orden no pudo recuperarse; el reintento conserva la idempotencia por `client_checkout_attempt_id`.
- Error de red/RPC durante retorno: mantener estado `pending` y mensaje de revisión, sin afirmar rechazo ni aprobación.
- Timeout de 30 segundos: mostrar `pending` con mensaje honesto de confirmación diferida.
- Respuesta `paid`: mostrar pago confirmado por NexCard.
- Respuesta no terminal: mostrar el estado real sin avanzar fulfillment.

## 6. Seguridad

- La autorización es una capacidad compuesta por tres valores: UUID de orden, UUID/intento de checkout y fingerprint de navegador.
- Los valores de prueba no se incluyen en query strings, eventos GA4, Sentry, logs ni mensajes de error.
- La RPC no acepta email como factor de autorización.
- La RPC no usa entradas dinámicas en SQL.
- La RPC no cambia RLS ni grants de `orders`.
- La función devuelve una lista explícita de columnas; nunca `orders.*`.
- Una prueba incorrecta no permite distinguir orden válida de inexistente.

## 7. Pruebas

### 7.1 Unitarias y de contrato

- `createOrder` llama primero a `create_order_with_items` y después a `get_guest_order_receipt`.
- `createOrder` no consulta `from('orders')` para recuperar una orden guest.
- El recibo usa exactamente attempt ID y fingerprint del payload.
- Falta de recibo devuelve error genérico.
- La migración contiene `SECURITY DEFINER`, `search_path`, `REVOKE PUBLIC`, grants explícitos y lista segura de columnas.
- La migración compara los tres factores y excluye `deleted_at`.
- La migración no crea una política `SELECT` para `anon` sobre `orders`.

### 7.2 Hook de retorno

- Sin prueba local: no llama RPC y no muestra PII.
- `orderId` distinto: no llama RPC y no muestra PII.
- Prueba válida + `paid`: confirma pago.
- Prueba válida + `pending`: mantiene pendiente.
- `payment=success` sin respuesta `paid`: nunca afirma pago confirmado.
- Sondeo termina al confirmar, a los 30 segundos o al desmontar.
- Error RPC/timeout: mensaje honesto y estado pending.

### 7.3 PostgreSQL efímero y staging

- `anon` con prueba válida obtiene exactamente una fila y solo columnas permitidas.
- Prueba inválida, UUID desconocido y soft-delete obtienen cero filas.
- `anon` sigue sin poder leer `orders` directamente.
- Campos sensibles no están presentes en el contrato.
- Owner/admin conservan sus accesos existentes.
- Reintento con el mismo attempt ID conserva una sola orden.

### 7.4 Preview

- Crear una orden sintética guest en staging sin cobro real.
- Confirmar redirección hasta la creación de preferencia TEST o mock controlado.
- Simular retorno `success`, `pending` y falta de prueba.
- Verificar ausencia de errores de consola y de PII sin autorización.

## 8. Rollout

La migración es aditiva y el código nuevo depende de ella. Secuencia:

1. aplicar migración en Supabase staging;
2. ejecutar pruebas runtime de RPC/RLS;
3. desplegar rama a Vercel Preview conectado a staging;
4. ejecutar unit, lint, build y E2E focalizado;
5. revisión independiente de seguridad/QA;
6. aplicar la función aditiva en Supabase producción;
7. verificar grants y sonda negativa sin datos de clientes;
8. mergear/desplegar frontend a producción;
9. smoke de checkout sin cobro y retorno genérico;
10. confirmar que producción sigue apuntando al proyecto Supabase productivo.

El rollback web es viable porque la función nueva es aditiva. En una emergencia se revierte el frontend y se deja la función sin uso; no se abrirá RLS ni se eliminará inmediatamente la RPC durante el incidente.

## 9. Criterios de aceptación

- Un guest puede crear una orden y obtener un recibo seguro sin leer `orders` directamente.
- El flujo no muestra `Orden creada pero no se pudo recuperar` por RLS.
- Un retorno con prueba válida obtiene estado real y puede confirmar `paid`.
- Un retorno sin prueba muestra información genérica sin PII.
- `payment=success` por sí solo nunca produce estado pagado.
- El sondeo está limitado a 30 segundos y se cancela correctamente.
- Lectura directa anon de `orders` continúa denegada.
- No se exponen campos fuera del allowlist.
- Idempotencia de creación se conserva.
- Tests focalizados, suite unitaria, lint, build y Preview QA pasan.
- Gate G permanece fuera de alcance y requiere autorización explícita separada.
