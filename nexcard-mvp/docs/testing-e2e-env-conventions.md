# NexCard — E2E environment conventions

## Objetivo
Reducir fricción operacional al correr Cypress localmente y separar mejor el entorno E2E del entorno diario de desarrollo.

---

# 1. Archivo recomendado
Usar `.env.e2e.local` como fuente principal para Cypress local.

- Base sugerida: copiar `.env.e2e.example`
- Fallback permitido: `.env.local`
- Regla operativa: no meter seeds temporales de testing en el `.env.local` si puedes evitarlo

Esto separa mejor credenciales/fixtures E2E del trabajo normal de frontend.

---

# 2. Admin test account
Para que las suites admin sean reproducibles, definir siempre estas env vars al correr tests:

```bash
CYPRESS_login_email="admin@nexcard.cl"
CYPRESS_login_password="<password-valido>"
```

Si el login falla y la app queda en `/login`, el problema suele ser de credenciales/seed y no del spec.

---

# 3. Ports
Las suites E2E asumen por defecto:
- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

El runner `scripts/run-e2e-local.sh` ahora intenta matar procesos locales previos de:
- `react-scripts start`
- `node server/index.js`

para evitar choques de puertos comunes.

También acepta overrides útiles vía env:
- `E2E_FRONTEND_PORT`
- `E2E_BACKEND_PORT`
- `E2E_WAIT_ON_TIMEOUT_MS`

---

# 4. Logs
El runner escribe:
- `.e2e-frontend.log`
- `.e2e-backend.log`

Si un test falla por entorno, revisar primero esos archivos.

Cuando el runner aborta, imprime automáticamente las últimas ~40 líneas de ambos logs para acelerar diagnóstico.

---

# 5. Datos de prueba
Para suites lifecycle/admin, conviene definir env vars estables para:
- revoked cards
- archived cards
- active profile
- archived profile

Esto hace que los tests sean reproducibles sin depender de inspección manual previa.

---

# 6. Preflight recomendado
Antes de correr una suite importante:

```bash
npm run test:e2e:env-check
```

Y para suites específicas, el runner ejecuta validación mínima automática según el spec pedido.

---

# 7. Regla práctica
Cuando un test E2E falla, primero distinguir:
1. fallo de entorno (puertos/login/seed)
2. fallo real de app/flujo

## Fallos comunes y lectura rápida
- **Se queda en `/login`** → credenciales inválidas, seed admin ausente o `REACT_APP_SUPABASE_*` vacío.
- **`wait-on` vence timeout** → puerto ocupado, frontend no compiló o backend cayó al boot.
- **Bridge `/c/:token` responde 404/410 inesperado** → token seed incorrecto o card lifecycle cambió; revisar variables `CYPRESS_*token*` antes del spec.
- **`/admin/profiles` no muestra filas esperadas** → slugs/versions/last_event desalineados respecto al seed real; no rehacer test primero, corregir fixture/env.

Eso evita perder tiempo depurando el lugar equivocado.
