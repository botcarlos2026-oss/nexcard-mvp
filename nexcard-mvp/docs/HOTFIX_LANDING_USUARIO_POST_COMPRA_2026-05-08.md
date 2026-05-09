# NexCard — Hotfix landing usuario post-compra

**Fecha:** 2026-05-08

## Objetivo
Mejorar la experiencia del landing público del usuario ya activado, manteniendo la filosofía original de NexCard:
- el cliente decide qué módulos mostrar
- cada canal puede activarse o desactivarse
- el landing debe priorizar conversión real y coherencia de datos

## Cambios aplicados

### 1. CTA principal más limpio
**Archivo:** `src/components/NexCardProfile.jsx`

- se mantuvo `Guardar Contacto` como CTA principal
- `Conectemos` dejó de competir arriba con el CTA principal
- si el perfil no tiene WhatsApp ni agenda, `Conectemos` sigue apareciendo arriba como fallback útil
- en escenarios normales, `Conectemos` pasa al bloque inferior como CTA secundario

### 2. Tarjetas de contacto ahora son accionables
**Archivo:** `src/components/NexCardProfile.jsx`

Se transformaron en acciones reales:
- teléfono → `tel:`
- correo → `mailto:`
- sitio web → link externo real

Esto mejora conversión sin quitar control al usuario.

### 3. Normalización de sitio web
**Archivos:**
- `src/components/NexCardProfile.jsx`
- `src/components/UserEditor.jsx`
- `src/services/api.js`

Se alineó la edición/render con el campo persistido `website`.
Además, la landing pública sigue soportando fallback desde `website_url` para compatibilidad con data antigua/mock.

### 4. Corrección de email bancario
**Archivo:** `src/components/NexCardProfile.jsx`

El bloque bancario ya no muestra siempre `contact_email`.
Ahora prioriza:
- `bank_email`
- fallback a `contact_email` solo si no existe email bancario específico

### 5. Copy más limpio
**Archivos:**
- `src/components/NexCardProfile.jsx`
- `src/components/UserEditor.jsx`

Se cambió el label:
- `Teléfono Múltiple` → `Teléfono`

### 6. Limpieza de branding innecesario
**Archivo:** `src/components/NexCardProfile.jsx`

Se eliminó el footer `NexCard Sentinel`, porque no aportaba conversión ni claridad al usuario final.

## Principio respetado
No se eliminó la lógica de toggles. El usuario sigue pudiendo:
- activar/desactivar WhatsApp
- activar/desactivar correo
- activar/desactivar teléfono
- activar/desactivar web
- activar/desactivar portafolio
- activar/desactivar agenda
- activar/desactivar datos bancarios

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.
