# KPI Governance + Alert Readiness — 2026-05-14

## Objetivo
Endurecer la capa KPI con gobernanza mínima real:
- validación de runtime config antes de persistir
- auditoría de cambios KPI
- payload ejecutivo listo para alertas outbound

## Cambios implementados

### 1) Validación de runtime config
En `src/services/api.js` se agregó validación para:
- `sla_targets`
- `payment_method_fees`
- `wow_alert_thresholds`

Controles:
- key permitida
- solo objeto JSON
- sin campos inesperados
- valores numéricos
- rangos razonables por bloque

Esto evita romper el executive score por basura manual en admin.

### 2) Auditoría de cambios KPI
Se reutilizó `public.audit_log` para registrar cambios sobre `kpi_runtime_config`.

Cada upsert ahora guarda:
- actor
- acción (`create` / `update`)
- before
- after
- contexto (`key`, email actor, source)

Además se agregó:
- `api.getKpiRuntimeConfigAudit()`
- bloque visual de **Auditoría KPI config** en `AdminDashboard`

### 3) Base de alerta outbound ejecutiva
Se agregó `executive_alert_payload` dentro de `transportReadiness` con:
- `event`
- `score`
- `band`
- `reasons`
- `summary`
- `generated_at`

También se ajustó `transportReadiness.mode` para marcar cuando el score entra en zona candidata a alerta (`watch` / `critical`).

## Validación
- `npm run build` ✅

## Resultado
El módulo ya no solo mide. Ahora también:
- valida inputs sensibles
- deja trazabilidad operativa
- prepara integración outbound sin inventar payload después

## Próximo paso recomendado
- reemplazar textarea JSON por formulario tipado
- diferenciar alertas por banda (`watch` vs `critical`)
- conectar webhook/email real con deduplicación y cooldown
- exponer filtro de auditoría por fecha/actor
