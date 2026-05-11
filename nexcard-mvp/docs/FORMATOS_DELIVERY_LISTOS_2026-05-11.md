# Formatos de delivery listos (2026-05-11)

## Objetivo
Dejar la capa de salida preparada para distintos canales sin duplicar lógica ni reescribir mensajes cada vez.

## Qué se agregó

### `deliveryFormats`
`getAdminDashboard()` ahora devuelve formatos listos para consumo externo:
- `short_text`
- `whatsapp_text`
- `email_subject`
- `email_body`

Todos salen del mismo núcleo:
- prioridad operativa
- severidad
- cantidad de casos
- funnel
- SLA promedio
- recomendación principal

## Visualización en dashboard
`AdminDashboard` ahora muestra la tarjeta:
- **Formatos listos por canal**

Con acción de copiado individual para:
- resumen corto
- WhatsApp
- asunto de email
- cuerpo de email

## Decisión correcta
No disparé mensajes todavía.

Primero consolidamos:
- contenido
- formato
- criterio

Después conectamos transporte.

Eso evita drift entre:
- dashboard
- cron
- mail
- WhatsApp
- webhook

## Lectura ejecutiva
Ahora el sistema ya no solo tiene digest.
Tiene **payloads listos para delivery real**.

El siguiente paso ya es mecánico:
- elegir canal
- elegir frecuencia
- conectar envío automático
