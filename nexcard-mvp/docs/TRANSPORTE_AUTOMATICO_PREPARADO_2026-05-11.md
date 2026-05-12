# Transporte automático preparado (2026-05-11)

## Objetivo
Dejar la salida automática técnicamente preparada sin enviar mensajes reales todavía.

Esto protege operación y privacidad:
- no hay spam accidental
- no hay destinatarios mal configurados
- no se duplica lógica al conectar cron/webhook después

## Qué se agregó

### `transportReadiness`
`getAdminDashboard()` ahora devuelve una estructura de preparación de transporte con:
- `mode: dry_run_only`
- `recommended_trigger`
- `recommended_frequency`
- `checklist`
- `cron_payload`
- `webhook_payload`

## Criterio
La regla actual recomienda:
- **immediate** si la severidad líder es `critical`
- **scheduled** en el resto de casos

Frecuencia sugerida:
- `*/15 * * * *` para escenarios críticos
- `0 9 * * *` para resumen diario normal

## Visualización en dashboard
Se agregó bloque:
- **Transporte automático preparado**

Muestra:
- modo actual
- trigger/frecuencia sugeridos
- checklist de activación
- payload ejemplo para cron
- payload ejemplo para webhook

## Decisión correcta
No se activó ningún envío real.

Se dejó explícitamente en:
- `dry_run_only`

Eso cumple el criterio operacional correcto: preparar primero, activar después con validación humana.

## Lectura ejecutiva
NexCard ya tiene:
- observabilidad
- priorización
- digest
- formatos por canal
- preparación de transporte

Lo único que falta para salir en vivo es conectar destinatario + cron/webhook aprobado.
