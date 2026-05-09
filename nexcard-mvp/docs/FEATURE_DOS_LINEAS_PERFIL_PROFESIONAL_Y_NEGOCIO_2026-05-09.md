# NexCard — Dos líneas de producto en setup y web

**Fecha:** 2026-05-09

## Objetivo
Hacer explícitas las dos líneas estratégicas del producto:
- `Perfil Profesional`
- `Perfil Negocio`

La meta es que NexCard deje de verse como una sola propuesta genérica y empiece a vender mejor según contexto de uso.

## Cambios aplicados

### 1. Setup Wizard
**Archivo:** `src/components/SetupWizard.jsx`

Se renombró y reforzó la selección inicial del onboarding:
- `Uso Personal` → `Perfil Profesional`
- `Empresa / Pyme` → `Perfil Negocio`

Además, se agregaron presets de copy por línea para:
- título de paso
- subtítulo contextual
- placeholders de nombre
- placeholders de profesión/rubro
- bio sugerida
- texto de ayuda para WhatsApp

### 2. Landing comercial
**Archivo:** `src/components/LandingPage.jsx`

Se ajustó el hero principal para comunicar que NexCard sirve para dos líneas claras:
- perfil profesional
- perfil negocio

También se agregó una bajada comparativa simple en el hero y se actualizó el bloque de propuesta de valor para reforzar que ambas líneas viven sobre una sola plataforma.

## Resultado esperado
- mejor claridad comercial en el sitio
- menos ambigüedad en el onboarding
- mayor alineación entre promesa de venta y UX real del producto
- mejor base para defaults diferenciados en el futuro

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.
