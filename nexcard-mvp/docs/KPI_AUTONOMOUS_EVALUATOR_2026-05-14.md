# KPI Autonomous Evaluator — 2026-05-14

## Objetivo
Sacar la evaluación ejecutiva fuera del dashboard y dejar un backend autónomo reutilizable.

## Qué se implementó

### 1) Edge Function autónoma
Nueva función:
- `supabase/functions/evaluate-executive-alert/index.ts`

Hace:
- lee runtime config activa
- calcula un executive score backend simplificado
- evalúa:
  - revenue 7d vs ventana previa
  - tasa de pago 7d vs ventana previa
  - SLA breaches abiertos
  - cooldown / dedupe / kill switch
- decide `should_send`
- si `auto_dispatch=1`, dispara `send-executive-alert`
- registra el resultado de la evaluación

### 2) Registro de evaluaciones
Nueva tabla:
- `public.kpi_alert_evaluations`

Guarda:
- `trigger_source`
- `score`
- `band`
- `should_send`
- `dispatched`
- `dry_run`
- `blocked_reason`
- `payload`
- `created_at`

### 3) Trigger programado preparado
Nueva migración:
- `202605141735_evaluate_executive_alert_cron.sql`

Intenta programar evaluación cada 30 minutos usando `pg_cron` + `pg_net`.

Estado real del entorno remoto:
- `pg_cron` no está disponible
- por eso quedó como `NOTICE`, no como scheduler activo

### 4) UI admin
Se agregó bloque:
- **Evaluador backend autónomo**

Permite:
- ejecutar evaluación manual
- ver historial reciente de evaluaciones
- distinguir `should_send`, `dispatched` y `blocked_reason`

## Validación
- `npm run build` ✅
- `supabase db push --include-all` ✅
- `supabase functions deploy evaluate-executive-alert` ✅

## Limitación importante
Este evaluador backend es **autónomo pero simplificado**.

Todavía no replica el 100% de la lógica enriquecida del dashboard (`claims`, algunos cortes avanzados y señales derivadas de observabilidad compuesta). Aun así, ya permite:
- evaluación fuera de la UI
- dispatch automático desacoplado del dashboard
- trazabilidad persistente

## Diagnóstico
Este fue el salto importante: el sistema ya no necesita abrir `/admin` para pensar.
Ahora ya puede pensar solo, aunque con una versión backend más compacta del score.

## Próximo paso correcto
- converger la lógica backend y dashboard en un evaluador único compartido
- activar cron externo real si `pg_cron` sigue indisponible
- agregar tests del evaluador con fixtures de órdenes
