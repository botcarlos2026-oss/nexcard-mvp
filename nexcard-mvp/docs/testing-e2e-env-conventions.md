# NexCard — E2E environment conventions

## Objetivo
Reducir fricción operacional al correr Cypress localmente.

---

# 1. Admin test account
Para que las suites admin sean reproducibles, definir siempre estas env vars al correr tests:

```bash
CYPRESS_login_email="admin@nexcard.cl"
CYPRESS_login_password="<password-valido>"
```

Si el login falla y la app queda en `/login`, el problema suele ser de credenciales/seed y no del spec.

---

# 2. Ports
Las suites E2E asumen:
- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

El runner `scripts/run-e2e-local.sh` ahora intenta matar procesos locales previos de:
- `react-scripts start`
- `node server/index.js`

para evitar choques de puertos comunes.

---

# 3. Logs
El runner escribe:
- `.e2e-frontend.log`
- `.e2e-backend.log`

Si un test falla por entorno, revisar primero esos archivos.

---

# 4. Datos de prueba
Para suites lifecycle/admin, conviene definir env vars estables para:
- revoked cards
- archived cards
- active profile
- archived profile

Esto hace que los tests sean reproducibles sin depender de inspección manual previa.

---

# 5. Regla práctica
Cuando un test E2E falla, primero distinguir:
1. fallo de entorno (puertos/login/seed)
2. fallo real de app/flujo

Eso evita perder tiempo depurando el lugar equivocado.
