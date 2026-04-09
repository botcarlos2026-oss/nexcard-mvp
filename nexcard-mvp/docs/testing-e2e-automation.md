# NexCard — E2E automation runner

## Objetivo
Evitar levantar frontend/backend manualmente cada vez que quieras correr Cypress.

## Script agregado
- `scripts/run-e2e-local.sh`

## Qué hace
1. carga `.env.e2e.local` si existe (fallback: `.env.local`)
2. valida env mínima según el spec/mode pedido
3. exporta `PUBLIC_APP_URL` por defecto a `http://localhost:3000`
4. levanta frontend React
5. levanta backend Express
6. espera a que ambos estén disponibles (`3000` y `4000` por defecto)
7. ejecuta Cypress
8. mata procesos al terminar
9. si falla, imprime tail de logs frontend/backend para diagnóstico rápido

---

# NPM scripts agregados

## Preflight rápido
```bash
npm run test:e2e:env-check
```

## Ejecutar toda la suite E2E local
```bash
npm run test:e2e:local
```

## Ejecutar smoke mínimo reproducible
```bash
npm run test:e2e:smoke
```

## Ejecutar solo NFC bridge
```bash
CYPRESS_nfc_token="your-token" \
CYPRESS_nfc_expected_slug="carlos-alvarez" \
npm run test:e2e:nfc
```

## Ejecutar solo soft delete guard
```bash
CYPRESS_deleted_profile_slug="bot-carlos" \
npm run test:e2e:soft-delete
```

---

# Requisito
Instalar dependencias nuevas después del cambio:
```bash
npm install
```

Esto agregará `wait-on`, usado para esperar a que los servicios estén listos antes de correr Cypress.

---

# Nota
Este runner está pensado para acelerar pruebas futuras del proyecto, no solo NFC/Route 2.
Se puede extender después para suites específicas (admin, auth, lifecycle, etc.).

## Modos validados automáticamente hoy
- `local` → mínimo login admin
- `nfc` → `CYPRESS_nfc_token`, `CYPRESS_nfc_expected_slug`
- `soft-delete` → `CYPRESS_deleted_profile_slug`
- `cards-lifecycle` → login admin + seeds revoked/archived
- `admin-profiles` → login admin + fixtures active/archived con lifecycle/history

Si quieres agregar otra suite con seeds propios, conviene extender `scripts/e2e-env-check.js` antes de multiplicar instrucciones manuales.
