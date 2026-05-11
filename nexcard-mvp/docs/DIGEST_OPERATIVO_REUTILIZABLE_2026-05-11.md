# Digest operativo reutilizable (2026-05-11)

## Objetivo
Preparar la salida del sistema fuera del dashboard sin meter todavía una integración externa obligatoria.

La lógica clave era no rehacer criterio cuando toque conectar:
- cron
- WhatsApp
- mail
- webhook
- resumen diario

## Qué se agregó

### 1. `operationalDigest`
`getAdminDashboard()` ahora devuelve un digest ejecutivo reutilizable con:
- `generated_at`
- `text`
- `lines`

El texto resume:
- prioridad actual
- severidad
- casos prioritarios
- alertas operativas
- SLA rotos
- estado del funnel
- SLA promedio por etapa
- acciones sugeridas
- recomendación principal

### 2. Bloque visual en dashboard
`AdminDashboard` ahora muestra:
- tarjeta **Resumen ejecutivo listo para enviar**
- botón **Copiar**
- contenido en formato compacto y reutilizable

## Decisión de diseño
No se conectó todavía a un canal externo.

Eso es correcto por costo/riesgo:
- primero consolidamos la lógica
- después enchufamos delivery
- evitamos duplicar reglas en cron, frontend y futuros webhooks

## Cambios técnicos

### `src/services/api.js`
Se agregó construcción de:
- `stageSlaDigest`
- `digestLines`
- `operationalDigest`

### `src/components/AdminDashboard.jsx`
Se agregó:
- render del digest
- acción de copiado al portapapeles

## Lectura ejecutiva
Este cambio deja lista la capa de salida.

Ahora NexCard ya puede:
- observar
- priorizar
- resumir

El siguiente paso natural ya no es diseño de lógica.
Es **delivery automatizado**.
