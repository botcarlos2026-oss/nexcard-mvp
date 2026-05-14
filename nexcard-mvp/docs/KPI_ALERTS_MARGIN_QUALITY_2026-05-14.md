# KPI Alerts, Margin & Quality Layer — 2026-05-14

## Objetivo
Agregar una cuarta capa al módulo KPI enfocada en margen neto estimado, calidad logística/comercial y alertas automáticas por deterioro.

## Cambios implementados

### 1) Margen neto estimado por método de pago
Se agregaron fees configurables en `src/config/admin.js` bajo `KPI_PAYMENT_METHOD_FEES`.

Métodos incluidos en esta iteración:
- WebPay / Transbank
- Mercado Pago
- fallback default

El dashboard ahora muestra por método:
- órdenes
- fee % asumido
- costo fee estimado
- revenue neto estimado

> Nota: este cálculo es una aproximación operacional basada en fee rate por método, no contabilidad final.

### 2) Carrier performance con percentil operativo
`carrierStats` ahora agrega:
- tasa de entrega
- `p90` de horas entre entrega y activación

Esto permite detectar operadores que entregan, pero dejan fricción post-entrega/activación.

### 3) Claim rate por SKU
`productStats` ahora agrega:
- órdenes por SKU
- claim rate (%) basado en órdenes con `activation_claim.status === 'pending'`

Esto convierte el top SKU en una lectura de calidad, no solo de revenue.

### 4) Alertas automáticas WoW
Se agregaron thresholds configurables en `src/config/admin.js` bajo `KPI_WOW_ALERT_THRESHOLDS`.

Alertas actuales:
- revenue 7d cayendo fuerte vs período previo
- tasa de pago deteriorándose WoW
- carrier con caída fuerte de delivery rate vs ventana previa
- SKU con claim rate alto

Estas alertas ya se renderizan como panel ejecutivo dedicado en dashboard.

## Archivos modificados
- `src/config/admin.js`
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`

## Validación
- `npm run build` ✅

## Resultado
El dashboard ya cubre cuatro capas:
1. operación real
2. performance ejecutiva
3. mix/margen por cortes
4. deterioro automático y calidad

## Siguiente mejora recomendada
- persistir thresholds y fees fuera de código
- claim rate con denominador por unidades además de órdenes
- costo logístico por carrier para margen neto extendido
- score compuesto ejecutivo por canal / método / carrier / SKU
