# KPI Margin Segmentation — 2026-05-14

## Objetivo
Agregar una tercera capa al módulo KPI orientada a margen, mix comercial y control ejecutivo de targets.

## Cambios implementados

### 1) Targets SLA configurables
Se movieron los targets SLA a `src/config/admin.js` bajo `KPI_SLA_TARGET_HOURS`.

Targets activos:
- Paid → Ready: 24h
- Ready → Shipped: 24h
- Shipped → Delivered: 72h
- Delivered → Activated: 24h

El dashboard ahora muestra explícitamente estos targets activos para evitar ambigüedad entre cálculo y expectativa operativa.

### 2) Segmentación por método de pago (30d)
Se agregó `paymentMethodStats` sobre órdenes operativas pagadas de rolling 30 días.

Campos mostrados:
- método
- cantidad de órdenes
- revenue real

Uso esperado:
- detectar qué método trae caja real
- ver concentración de revenue
- abrir futuras decisiones de fee/margen

### 3) Segmentación por carrier (30d)
Se agregó `carrierStats` sobre órdenes despachadas en rolling 30 días.

Campos mostrados:
- carrier
- despachos
- entregadas
- tasa de entrega

Uso esperado:
- detectar carrier dominante
- detectar riesgo operacional por cumplimiento
- preparar futuros KPIs de SLA logístico por operador

### 4) Segmentación por producto/SKU (30d)
Se agregó `productStats` usando `order_items` y catálogo `products`.

Campos mostrados:
- producto/SKU
- unidades
- revenue operativo estimado por línea

Uso esperado:
- detectar mix de ventas real
- detectar productos que explican margen
- facilitar decisiones sobre escalabilidad y foco comercial

## Archivos modificados
- `src/config/admin.js`
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`

## Validación
- `npm run build` ✅

## Resultado
El dashboard KPI ahora combina:
- operación
- performance ejecutiva
- segmentación de margen y mix
- visibilidad explícita de targets SLA

## Próximo paso recomendado
- margin neto por método/canal si se incorporan fees
- SLA por carrier con percentiles reales
- SKU mix vs conversión vs claim rate
