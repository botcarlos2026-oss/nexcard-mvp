# NexCard — Implementación MVP activación post-pago

**Fecha:** 2026-05-08

## Objetivo
Implementar un flujo mínimo viable que conecte:
- pago confirmado
- email de activación
- registro/login
- claim del perfil
- setup del primer profile

## Cambios implementados
### Base de datos
Se agregó migración:
- `supabase/migrations/202605082120_profile_claims.sql`

Crea la tabla `profile_claims` con:
- `order_id`
- `customer_email`
- `claim_token`
- `quantity`
- `status`
- `claimed_by_user_id`
- `claimed_profile_id`
- timestamps

### Edge Functions
#### `claim-profile`
- preview del token
- claim autenticado
- marca el claim como `claimed`
- si ya existe profile del usuario, lo vincula también al claim
- intenta vincular cards de esa orden si ya existen sin profile

#### `send-profile-activation`
- envía correo de activación vía Resend
- usa link `/activar/:token`

### Webhook Mercado Pago
`mp-webhook` ahora:
1. marca la orden como pagada
2. crea `profile_claims` si no existe
3. dispara `send-profile-activation`

### Frontend
#### Auth/Profile bootstrap
- `src/services/supabaseClient.js`
- `src/services/api.js`
- `src/App.jsx`

Se reparó:
- lectura de usuario real desde sesión/auth local Supabase
- creación inicial de profile si no existe
- redirect `/edit -> /setup` cuando falta profile
- persistencia temporal de `pending claim token`

#### Nueva ruta pública
- `/activar/:token`
- componente: `src/components/ActivationPage.jsx`

Flujo:
- preview del claim
- si no hay sesión → login/register
- si hay sesión → claim
- si no existe profile → setup
- al guardar setup se reintenta claim para completar vínculo con profile

## Estado funcional esperado
### Caso 1 — usuario compra y no tiene cuenta
1. paga
2. webhook crea claim
3. recibe email de activación
4. abre `/activar/:token`
5. registra cuenta / login
6. claim queda tomado por su usuario
7. setup crea primer profile
8. claim queda asociado al profile

### Caso 2 — usuario ya tiene cuenta y profile
1. paga
2. abre link
3. inicia sesión
4. claim se consume y se asocia directo a profile existente

## Limitación consciente de este MVP
- se crea **1 claim por orden**, no uno por cada unidad/tarjeta
- sirve para cerrar activación básica ahora
- para packs multi-titular habrá que evolucionar a `claim_items` o claim por unidad

## Riesgos pendientes
- la migración debe aplicarse en remoto
- las functions nuevas deben quedar deployadas
- falta smoke real del email de activación tras un pago aprobado real o simulado por webhook

## Siguiente mejora recomendada
1. crear pantalla de activación con copy más comercial
2. emitir claim por unidad si una orden trae varias tarjetas
3. vincular claim con card física específica al momento de programación/despacho
4. agregar reenvío manual de email de activación desde admin
