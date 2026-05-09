# NexCard — UX orden de módulos personal vs empresa

**Fecha:** 2026-05-08

## Objetivo
Aplicar una pasada de UX fina al landing público del usuario activado para que el orden de los módulos responda mejor al tipo de perfil:
- personal / profesional
- empresa / negocio

Sin romper el principio base de NexCard:
- el usuario sigue pudiendo activar o desactivar cada módulo

## Lógica aplicada

### Perfil personal / profesional
Se prioriza:
1. Guardar contacto
2. WhatsApp
3. Agendar reunión
4. Redes / presencia profesional
5. Datos de contacto
6. Links útiles
7. Banco
8. Conectemos

### Perfil empresa / negocio
Se prioriza:
1. WhatsApp
2. Llamar
3. Sitio web
4. Guardar contacto
5. Ubicación
6. Datos de contacto
7. Links útiles
8. Redes
9. Conectemos

## Regla de detección
**Archivo:** `src/components/NexCardProfile.jsx`

Se considera perfil empresa si:
- `account_type` viene como `company` o `business`
- o si existe una mezcla fuerte de señales comerciales (`company` + web/teléfono)

## Cambios aplicados
- CTA principal reordenado según tipo de perfil
- CTA de agenda subido para perfil personal
- CTA de llamada subido para perfil empresa
- ubicación subida dentro del bloque de contacto para empresa
- redes sociales bajadas en empresa para que no compitan con contacto comercial
- `Conectemos` mantenido como CTA secundario final

## Validación ejecutada
Se ejecutó:
- `npm run build`

**Resultado:** compilación exitosa.
