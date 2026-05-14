# KPI Hardening Final — 2026-05-14

## Objetivo
Cerrar el ciclo operativo del evaluador autónomo con pruebas, visibilidad y scheduling usable.

## Qué quedó implementado

### 1) Tests del núcleo KPI
Nuevo archivo:
- `src/utils/executiveKpi.test.js`

Cubre:
- `percentage`
- `deltaPercent`
- `buildWowAlerts`
- `computeExecutiveScore`

Resultado:
- el score ejecutivo ya tiene una base mínima automatizada
- baja el riesgo de romper fórmula/bandas por refactors rápidos

### 2) Observabilidad en `/admin`
Se reforzó el bloque **Evaluador backend autónomo** con métricas operativas:
- última corrida
- dispatch efectivo
- bloqueo dominante
- fallos de dispatch

Esto permite distinguir rápido entre:
- problema de score
- problema de policy/cooldown
- problema de dispatch
- simple ausencia de condiciones para envío

### 3) Script operativo real
Nuevo script:
- `scripts/run-executive-alert-evaluator.mjs`

Nuevos comandos:
- `npm run kpi:evaluate`
- `npm run kpi:evaluate:cron`

El script:
- carga `.env` / `.env.local`
- usa `REACT_APP_SUPABASE_URL`
- usa `REACT_APP_SUPABASE_ANON_KEY`
- invoca la function `evaluate-executive-alert`
- devuelve JSON ejecutable/parseable

### 4) Scheduling real puente
Como `pg_cron` no está disponible en el proyecto remoto, quedó operativo un scheduler puente externo cada 30 minutos usando OpenClaw cron.

Cadencia:
- cada 30 minutos

Comando efectivo validado:
- `npm run kpi:evaluate:cron`

## Validación
- `npm run test:unit -- --runInBand --watch=false` ✅
- `npm run build` ✅
- `npm run kpi:evaluate:cron` ✅

Resultado real de la corrida validada:
- `score: 100`
- `band: strong`
- `should_send: false`
- `blocked_reason: below_band`

## Diagnóstico
Esto ya deja un circuito bastante sano:
- el dashboard observa
- el backend evalúa
- el script permite ejecución operativa fuera del navegador
- el scheduler ya lo mueve sin abrir `/admin`
- hay tests mínimos sobre la fórmula crítica

## Limitación residual
Lo único que todavía llamaría “industrializable” pero no imprescindible para operar es:
- más tests de fixtures con órdenes reales/sintéticas
- canal explícito de alertado por failure del scheduler si quieres un NOC más rígido
- eventual reemplazo del scheduler puente por infraestructura propia del stack
