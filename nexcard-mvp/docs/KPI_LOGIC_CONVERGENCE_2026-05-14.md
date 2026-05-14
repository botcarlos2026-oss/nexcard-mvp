# KPI Logic Convergence — 2026-05-14

## Objetivo
Reducir la divergencia entre el dashboard admin y el evaluador backend autónomo para que ambos operen con la misma semántica ejecutiva.

## Qué se hizo

### 1) Núcleo reutilizable en frontend/admin
Se creó:
- `src/utils/executiveKpi.js`

Contiene:
- `round1`
- `percentage`
- `percentile`
- `deltaPercent`
- `buildWowAlerts`
- `computeExecutiveScore`

Con eso, `src/services/api.js` ya no define inline la lógica crítica del score/alertas.

### 2) Dashboard alineado al núcleo
`getAdminDashboard` ahora usa el helper compartido para:
- construir `wowAlerts`
- calcular `executiveScore`

Esto baja el riesgo de drift dentro del frontend.

### 3) Backend autónomo enriquecido
La function:
- `supabase/functions/evaluate-executive-alert/index.ts`

ahora replica mucho mejor la lógica del dashboard:
- exclusión de órdenes no operacionales
- enriquecimiento con `profile_claims`, `cards`, `order_cards`, `profiles`
- `activation_claim`
- `observability_alerts`
- `carrierStats`
- `productStats`
- penalización por `avgClaimRate`
- `wowAlerts` por revenue, payment rate, carrier deterioration y SKU claim rate

## Resultado
Ya no estamos comparando:
- dashboard rico
- backend simplón

Ahora estamos mucho más cerca de un criterio único real.

## Validación
- `npm run build` ✅
- `supabase functions deploy evaluate-executive-alert` ✅

## Limitación pendiente
Todavía no hay **single-source cross-runtime real** entre React y Edge Function.

Hoy la convergencia es:
- **semántica** y **fórmula** alineadas
- pero con implementación duplicada entre runtimes

Para cerrar eso al 100% habría que:
- mover la lógica a un paquete/shared module compatible con browser + Supabase Edge
- o empujar toda la evaluación al backend y hacer que `/admin` sólo consuma el resultado

## Diagnóstico ejecutivo
Esta etapa sí reduce riesgo operativo: menos probabilidad de que el dashboard diga una cosa y el backend dispare otra.
