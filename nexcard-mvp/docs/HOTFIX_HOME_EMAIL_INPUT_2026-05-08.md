# NexCard — Hotfix campo email en home

**Fecha:** 2026-05-08

## Objetivo
Corregir el tamaño visual del campo de email en el home (`/`) porque estaba demasiado pequeño para el peso visual del hero principal.

## Cambio aplicado
**Archivo:** `src/components/ComingSoon.jsx`

### Ajustes realizados
- se amplió el contenedor principal del hero de `max-w-lg` a `max-w-2xl`
- se amplió el bloque del formulario a `max-w-xl`
- el input de email pasó a tener:
  - mayor ancho útil
  - altura mínima de `56px`
  - padding más generoso
  - tipografía `text-base`
  - borde más consistente con el CTA
- el botón `Notifícame` quedó alineado en altura con el input
- el mensaje de error quedó alineado a la izquierda para mejorar lectura

## Resultado esperado
- mejor jerarquía visual en el hero
- mejor legibilidad del placeholder y del texto ingresado
- mayor área táctil/clickable en mobile y desktop
- proporción más premium entre input y CTA

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.
