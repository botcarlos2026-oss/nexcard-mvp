# NexCard — Hotfix activación y webhook

**Fecha:** 2026-05-08

## Objetivo
Cerrar riesgos detectados en la revisión posterior a Fase 0 sobre:
- cierre real de sesión
- reingreso al flujo de activación
- resiliencia del webhook de Mercado Pago ante duplicados/fallas de email
- falso soporte de `merchant_order`

## Cambios realizados

### 1. Logout real con Supabase Auth
**Archivo:** `src/services/api.js`

Se corrigió `logout()` para ejecutar `supabase.auth.signOut()` antes de limpiar estado local.

### 2. Reingreso seguro al flujo de activación
**Archivo:** `src/components/ActivationPage.jsx`

Se ajustó la UI para permitir que un usuario autenticado pueda volver a presionar el CTA cuando el claim ya figure como `claimed`.

Esto cubre el caso:
1. usuario abre link de activación
2. inicia sesión
3. claim queda tomado por su cuenta
4. abandona antes de terminar setup
5. vuelve al link y puede continuar

### 3. Webhook MP endurecido para reintento de activación
**Archivo:** `supabase/functions/mp-webhook/index.ts`

Se refactorizó el flujo para:
- resolver correctamente `payment` y `merchant_order`
- encapsular la lógica de claim + trigger de email en `ensureProfileActivationFlow(...)`
- reintentar el flujo de activación aun cuando llegue un webhook duplicado y la orden ya esté `paid`
- revisar la respuesta de `send-profile-activation` y loguear fallo real si devuelve `success: false`

## Riesgos cerrados

### Cerrado
- Logout aparente que no invalidaba sesión real.
- Activación “muerta” por claim ya tomado por el mismo usuario.
- Orden pagada sin nuevo intento de email de activación ante webhook duplicado.
- Soporte inconsistente de `merchant_order`.

### Pendiente / no cubierto en este hotfix
- Reenvío manual de activación desde admin.
- Claim por unidad para órdenes multi-pack.
- Cola/retry persistente fuera del webhook para fallas prolongadas de Resend.

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.

## Archivos modificados
- `src/services/api.js`
- `src/components/ActivationPage.jsx`
- `supabase/functions/mp-webhook/index.ts`
- `docs/HOTFIX_ACTIVACION_Y_WEBHOOK_2026-05-08.md`

## Lectura ejecutiva
Este hotfix no cambia el modelo de negocio del claim, pero sí mejora la confiabilidad operativa del MVP: reduce fuga entre pago confirmado y activación efectiva del cliente.