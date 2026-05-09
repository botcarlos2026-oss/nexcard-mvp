# NexCard — Afinación de detección de perfil y copy de CTAs

**Fecha:** 2026-05-08

## Objetivo
Mejorar la detección entre perfil personal y comercial y refinar el copy de los CTAs del landing público para que la acción principal suene más natural según contexto.

## Ajustes aplicados
**Archivo:** `src/components/NexCardProfile.jsx`

### 1. Detección más robusta de perfil comercial
Ahora no depende solo de `account_type`.
También considera señales comerciales como:
- empresa informada
- teléfono / WhatsApp / web / ubicación
- palabras clave de rubro en profesión o bio

### 2. Copy dinámico de CTAs
Se ajustó el texto según contexto:
- `Guardar mi contacto` para perfil personal
- `Guardar contacto comercial` para negocio
- `Escribirme por WhatsApp` / `Hablemos por WhatsApp` para personal
- `Escribir por WhatsApp` para negocio
- `Llamar al local` si el perfil comercial además tiene ubicación
- `Ver catálogo` si el bloque principal comercial cae en portafolio en vez de web

## Resultado esperado
- menos copy genérico
- mejor claridad de intención
- mayor coherencia entre tipo de perfil y acción principal

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.
