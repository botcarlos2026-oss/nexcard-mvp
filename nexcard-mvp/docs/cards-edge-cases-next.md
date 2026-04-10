# NexCard - próximos edge cases de cards

## Prioridad inmediata
1. Reassign con reglas claras.
2. Guardrail para no activar dos veces.
3. Guardrail para no asignar tarjeta ya activa a otro perfil sin flujo explícito.
4. Regla para revoke sobre tarjeta activa/asignada con trazabilidad.

## Recomendación
No abrir todo junto.
Primero:
- add RPC `reassign_card(...)`
- validar precondiciones
- registrar event `reassigned`
- registrar audit `reassign`

## Motivo
Es el siguiente caso borde más real una vez que assign/activate ya funcionan.
