# NexCard — E2E automation runner

## Objetivo
Evitar levantar frontend/backend manualmente cada vez que quieras correr Cypress.

## Script agregado
- `scripts/run-e2e-local.sh`

## Qué hace
1. carga `.env.local` si existe
2. exporta `PUBLIC_APP_URL` por defecto a `http://localhost:3000`
3. levanta frontend React
4. levanta backend Express
5. espera a que ambos estén disponibles (`3000` y `4000`)
6. ejecuta Cypress
7. mata procesos al terminar

---

# NPM scripts agregados

## Ejecutar toda la suite E2E local
```bash
npm run test:e2e:local
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
