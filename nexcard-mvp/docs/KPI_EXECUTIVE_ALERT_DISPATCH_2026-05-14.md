# KPI Executive Alert Dispatch — 2026-05-14

## Objetivo
Pasar de preparación a salida controlada real para alertas ejecutivas:
- función edge dedicada
- historial persistente de dispatch
- hash de payload para dedupe fino
- trigger manual desde dashboard

## Cambios implementados

### 1) Historial persistente de alertas
Nueva migración:
- `supabase/migrations/202605141635_kpi_alert_history.sql`

Tabla:
- `public.kpi_alert_history`

Guarda:
- `alert_key`
- `alert_band`
- `payload_hash`
- `channel`
- `status`
- `provider`
- `provider_message_id`
- `payload`
- `metadata`

### 2) Edge Function real
Nueva función:
- `supabase/functions/send-executive-alert/index.ts`

Hace:
- valida acceso interno/admin
- calcula `payload_hash` SHA-256
- evita reenvío si ya existe mismo hash
- soporta `dry_run` y `real dispatch`
- envía por Resend cuando `dry_run=false`
- persiste en `kpi_alert_history`
- actualiza `kpi_alert_state`
- registra también en `email_log`

### 3) API app
En `src/services/api.js` se agregó:
- `api.getKpiAlertHistory()`
- `api.dispatchExecutiveAlert()`

### 4) Dashboard admin
En `AdminDashboard` se agregó:
- bloque visual de historial de alertas ejecutivas
- botón **Disparar dry-run**
- botón **Enviar real**
- lectura de hash, status, provider message id y payload emitido

## Validación
- `npm run build` ✅
- `supabase db push` ✅
- `supabase functions deploy send-executive-alert` ✅

## Nota operativa
Intenté invocar la función vía CLI para una prueba dry-run, pero este CLI no expone subcomando `functions invoke` en este entorno. Quedó validado el deploy, pero la prueba end-to-end debe ejecutarse desde la UI/admin o vía HTTP autenticado.

## Resultado
Ahora el sistema ya puede:
- decidir si una alerta debería salir
- deduplicar por hash real de payload
- persistir historia de dispatch
- disparar salida real controlada desde admin

## Próximo paso recomendado
- auto-dispatch programado basado en `should_send`
- cooldown distinto por banda
- destinatarios configurables por runtime config
- vista comparativa de alertas emitidas vs omitidas
