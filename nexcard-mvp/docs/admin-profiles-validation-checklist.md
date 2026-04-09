# `/admin/profiles` — checklist de validación y testing

## Objetivo
Cerrar `/admin/profiles` con un criterio de salida más duro, sin depender de cambios de UI ni de mutaciones frágiles desde Cypress.

La lógica es simple: si esta pantalla deja de exponer bien el lifecycle/history de perfiles, el costo operativo sube porque se pierde trazabilidad para soporte, restore y revisión Route 2.

---

## Criterio de salida recomendado
No cerrar `/admin/profiles` hasta cumplir estas 3 capas:

1. **Cobertura automatizada admin-only**
   - tabla visible
   - columnas de lifecycle/history visibles
   - dataset seed `active` + `archived` estable
   - búsqueda y filtro `archived` reproducibles
   - iconografía de historial/archivado visible tras cambios de filtro

2. **Cobertura automatizada punta a punta**
   - perfil `active` resuelve por ruta pública
   - perfil `archived` no resuelve como perfil activo
   - `/admin/profiles` sigue mostrando ambos estados con metadata coherente
   - el perfil archivado sigue siendo encontrable desde admin luego del rechazo público

3. **Playbook manual Route 2**
   - snapshot ejecutable
   - soft delete verificable
   - restore verificable
   - audit trail verificable
   - validación visual en `/admin/profiles`

---

## Suite automatizada actual

### 1) Guardrails admin-only
Spec:
- `cypress/e2e/admin-profiles.cy.js`

Cubre:
- carga de `/admin/profiles`
- columnas `Profile`, `Status`, `Deleted`, `Versions`, `Last Event`, `Updated`, `Flags`
- presencia de perfiles seed `active` y `archived`
- búsqueda por slug
- filtro por estado `archived`
- persistencia visual de iconos `Tiene historial` y `Archivado`

Runner:
```bash
npm run test:e2e:admin-profiles-guardrails
```

### 2) Guardrails punta a punta public/admin
Spec:
- `cypress/e2e/admin-profiles-e2e.cy.js`

Cubre:
- el perfil `active` resuelve por `/:slug`
- el perfil `archived` rechaza la resolución pública
- ambos perfiles siguen visibles y coherentes en `/admin/profiles`
- el perfil archivado sigue siendo trazable por búsqueda + filtro en admin

Runner:
```bash
npm run test:e2e:profiles-e2e
```

### 3) Guardrail público mínimo de soft delete
Spec:
- `cypress/e2e/profile-soft-delete-guard.cy.js`

Runner:
```bash
npm run test:e2e:soft-delete
```

---

## Pack recomendado para cerrar `/admin/profiles`
Correr este orden, porque maximiza señal con bajo costo de mantenimiento:

```bash
npm run test:e2e:admin-profiles-guardrails
npm run test:e2e:profiles-e2e
npm run test:e2e:soft-delete
```

Si el objetivo es una pasada local integral del frente de perfiles:

```bash
npm run test:e2e:profiles-full
```

---

## Contrato de datos seed
Se recomienda mantener **dos perfiles controlados**:

### Perfil activo
Debe cumplir:
- slug estable
- visible públicamente
- visible en `/admin/profiles`
- `deleted = No`
- `versions >= 1`
- `last_event` consistente con el estado real

### Perfil archivado
Debe cumplir:
- slug estable
- no resolverse como perfil público activo
- visible en `/admin/profiles`
- `deleted = Sí`
- `versions >= 1`
- `last_event` consistente (`soft_delete`, `restore`, etc. según seed)

---

## Variables de entorno requeridas

### Comunes
```bash
CYPRESS_login_email
CYPRESS_login_password
```

### Dataset profiles
```bash
CYPRESS_active_profile_slug
CYPRESS_active_profile_status
CYPRESS_active_profile_versions
CYPRESS_active_profile_last_event
CYPRESS_archived_profile_slug
CYPRESS_archived_profile_status
CYPRESS_archived_profile_versions
CYPRESS_archived_profile_last_event
```

### Opcionales pero recomendadas
```bash
CYPRESS_active_profile_full_name
CYPRESS_archived_profile_full_name
CYPRESS_active_profile_deleted
CYPRESS_archived_profile_deleted
CYPRESS_deleted_profile_slug
```

---

## Checklist manual de validación funcional

### A. Visibilidad admin
- [ ] `/admin/profiles` carga sin error
- [ ] se ve el encabezado `Profiles Recovery Desk`
- [ ] existen columnas de lifecycle/history
- [ ] al menos un perfil `active` y uno `archived` están visibles
- [ ] la columna `Deleted` está alineada con el estado real
- [ ] la columna `Versions` no está vacía para perfiles con historial
- [ ] `Last Event` refleja el último evento esperado
- [ ] flags visuales `Tiene historial` y `Archivado` aparecen donde corresponde

### B. Filtros
- [ ] búsqueda por slug devuelve el perfil correcto
- [ ] limpiar búsqueda restaura dataset esperado
- [ ] filtro `archived` aísla perfiles archivados
- [ ] volver a `all` restaura visibilidad normal
- [ ] cambiar filtros no rompe iconos ni metadata

### C. Coherencia public/admin
- [ ] el slug activo abre perfil público válido
- [ ] el slug archivado muestra rechazo/error controlado
- [ ] aun rechazado públicamente, el perfil archivado sigue trazable en `/admin/profiles`
- [ ] admin no muestra metadata contradictoria entre `status`, `deleted`, `versions`, `last_event`

### D. Route 2 / datos
- [ ] `snapshot_profile()` crea una nueva versión
- [ ] `soft_delete_profile()` marca `deleted_at`
- [ ] `restore_profile_version()` revierte estado/datos esperados
- [ ] `audit_log` registra `snapshot`, `soft_delete` y `restore`
- [ ] `/admin/profiles` refleja el cambio después de recargar

---

## SQL manual sugerido
Apoyarse en:
- `docs/route2-manual-test-playbook.md`
- `docs/route2-profiles-snapshot-minimal.md`

Secuencia mínima:
1. `snapshot_profile()`
2. revisar `profile_versions`
3. `soft_delete_profile()`
4. revisar `profiles.deleted_at`
5. `restore_profile_version()`
6. revisar `audit_log`
7. validar `/admin/profiles`

---

## Riesgos que esta cobertura sí detecta
- drift entre estado público y estado admin
- tabla admin sin columnas críticas de history/lifecycle
- filtros que esconden o distorsionan perfiles archivados
- pérdida de señal visual de historial/archivado
- seeds incoherentes para Route 2

## Riesgos que esta cobertura no detecta sola
- exactitud total del contenido restaurado campo por campo
- permisos/RLS profundos del backend
- regresiones de edición avanzada en `/edit`
- problemas de performance con datasets grandes

Eso requiere pruebas SQL/manuales complementarias.
