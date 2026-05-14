# KPI Auto Dispatch + Routing — 2026-05-14

## Objetivo
Cerrar la décima etapa con automatización controlada:
- routing configurable por runtime config
- auto-dispatch opcional basado en `should_send`
- tablero emitidas/omitidas/fallidas

## Cambios implementados

### 1) Runtime config de routing
Nuevo bloque:
- `executive_alert_routing`

Campos:
- `enabled`
- `auto_dispatch`
- `dry_run_default`
- `recipients_csv`

Seed remoto aplicado:
- `supabase/migrations/202605141645_kpi_executive_alert_routing_seed.sql`

### 2) Auto-dispatch controlado
`getAdminDashboard()` ahora puede disparar automáticamente `send-executive-alert` cuando:
- `should_send = true`
- routing enabled = 1
- auto_dispatch = 1

Protecciones:
- cooldown
- dedupe por banda
- dedupe fino por `payload_hash`
- default a dry-run si así lo define routing

### 3) Recipients configurables
La Edge Function `send-executive-alert` ahora acepta recipients explícitos.

Si no se envían, usa fallback interno.
Si se envían, el hash considera también la audiencia para deduplicar correctamente.

### 4) Historial más útil
En duplicados, la función ahora registra evento `omitted` en `kpi_alert_history`.

Eso permite medir:
- emitidas
- dry-run
- omitidas
- fallidas

### 5) Dashboard operativo
Se agregó:
- summary cards de alertas ejecutivas
- visibilidad de routing enabled / auto dispatch / dry-run default / recipients
- resultado del último auto-dispatch cuando aplica

## Validación
- `npm run build` ✅
- `supabase db push` ✅
- `supabase functions deploy send-executive-alert` ✅

## Resultado
La capa ya quedó lista para operación real con control:
- destinatarios parametrizados
- dispatch manual o automático
- historia medible
- deduplicación más robusta

## Recomendación dura
No activaría `auto_dispatch=1` en producción hasta revisar 2-3 ciclos dry-run y confirmar que el score no dispara ruido falso.
