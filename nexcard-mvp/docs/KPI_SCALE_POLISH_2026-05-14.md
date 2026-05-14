# KPI Scale Polish — 2026-05-14

## Objetivo
Cerrar brechas finas de escalabilidad/operación en el evaluador KPI ejecutivo.

## Qué se mejoró

### 1) Decisión operativa separada y testeable
En `src/utils/executiveKpi.js` se agregó:
- `computeExecutiveAlertDecision(...)`

Esto desacopla la lógica de:
- banda elegible
- cooldown
- dedupe por banda
- kill switch
- `blockedReason`
- `shouldSend`

Beneficio:
- menos drift en reglas operativas
- más fácil endurecer policy sin tocar bloques gigantes de `api.js`

### 2) Cobertura unitaria más realista
`src/utils/executiveKpi.test.js` ahora cubre además:
- bloqueo por banda saludable (`below_band`)
- bloqueo por cooldown (`cooldown_active`)
- bloqueo por dedupe (`same_band_dedup`)
- caso permitido de envío sin bloqueos

Resultado:
- el riesgo ya no está sólo cubierto en score; también en el gate de dispatch

### 3) Salud del cron visible en admin
El bloque **Evaluador backend autónomo** ahora muestra también:
- último cron
- bloqueo del último cron
- cantidad de corridas cron recientes
- dispatch cron perdidos

Esto permite distinguir rápido entre:
- cron muerto
- cron vivo pero sin condición de envío
- cron vivo con bloqueo por policy
- cron vivo con dispatch perdido

## Validación
- `npm run test:unit -- --runInBand --watch=false` ✅
- `npm run build` ✅

## Diagnóstico
Esto ya está muy cerca de un estado 100% fino para operación real.

Lo más valioso de esta pasada no fue agregar otra feature, sino:
- separar decisión de envío del cálculo de score
- hacer visible si el scheduler realmente está corriendo
- cubrir en tests los bloqueos más probables que causan falsos positivos o silencios inesperados
