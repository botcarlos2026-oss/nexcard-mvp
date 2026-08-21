# NexCard — Índice de documentación

_Generado 2026-08-21. Sucesor de `docs/DOCUMENTACION_REPO_2026-05-08.md` (quedó desactualizado — ver sección de docs obsoletos)._

Este índice existe para que, cuando el proyecto escale (nuevas personas, nuevos agentes, nuevos módulos), se sepa **qué documentación existe y dónde vivir cuando se genera nueva**. No reemplaza el contenido de cada doc — apunta a él y dice si sigue vigente.

## Cómo usar esto

1. Si algo choca entre documentos, prioriza en este orden: **código** (`src/`, `supabase/`, `api/`, `server/`) → `CLAUDE.md` → los 5 docs raíz (`README.md`, `ARCHITECTURE.md`, `SCHEMA.md`, `PRODUCT.md`, `DESIGN.md`) → este índice → todo lo demás.
2. Documentación nueva de **estado operativo actual** (cómo funciona algo hoy) va en los docs raíz o en `CLAUDE.md`, no en `docs/` suelto.
3. Documentación de **eventos puntuales** (cierre de incidente, auditoría, plan de una tarea) va en `docs/NOMBRE_DESCRIPTIVO_YYYY-MM-DD.md` y se agrega a la tabla de "Recientes" abajo — pero no se edita después, queda como registro histórico.
4. La memoria operativa viva (decisiones, contexto, next steps) vive en Obsidian (`Proyectos/NexCard/`), no aquí — ver sección final.

## 1. Punto de entrada (raíz del repo)

| Doc | Rol | Estado |
|---|---|---|
| `README.md` | Puerta de entrada: cómo correr el repo, stack, estructura | Refrescado 2026-08-21 |
| `ARCHITECTURE.md` | Arquitectura real: stack, split de backends, módulos, roadmap | Refrescado 2026-08-21 |
| `SCHEMA.md` | Mapa de las ~29 tablas por dominio (no DDL exacto — eso vive en migraciones) | Refrescado 2026-08-21 |
| `PRODUCT.md` | Producto: segmentos, propuesta de valor, principios | Refrescado 2026-08-21 (fix admin auth + tamaño api.js) |
| `DESIGN.md` | Sistema de diseño: paleta, tipografía, componentes | Vigente (2026-08-18), sin drift detectado |
| `CLAUDE.md` | Guía extensa para agentes/Claude Code trabajando en el repo (78KB) | Vigente (2026-08-16), es el doc más grande y detallado del repo |

## 2. Seguridad, RLS y migraciones (vigente)

| Doc | Rol |
|---|---|
| `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md` | Auditoría de pre-lanzamiento más reciente — **punto de partida si preguntan "qué falta"** |
| `docs/PLAN_TRABAJO_BRECHAS_2026-08-20.md` | Plan de trabajo derivado de esa auditoría |
| `docs/supabase-schema-baseline-2026-08-15.md` | Por qué existe la migración baseline `202604080002_initial_schema_baseline.sql` y qué problema de replay resolvió |
| `docs/supabase-memberships-baseline-schema-2026-08-14.md` | Schema de `memberships` en producción |
| `docs/supabase-migration-replay-debt-2026-08-14.md` | Deuda de orden/replay entre migraciones históricas |
| `docs/secrets-rotation-checklist.md` | Checklist de rotación de secretos (contrastar con nota Obsidian de rotación pendiente, sección 6) |
| `docs/card-scans-security-plan.md`, `docs/security-ops-blueprint.md` | Diseño de seguridad para scans NFC y blueprint general |

**Obsoletos — no usar como inventario actual:**
- `docs/supabase-migration-inventory.md` y `supabase/migrations/README.md`: ambos documentan solo el lote inicial de 11 migraciones (2026-04-09). Hoy hay **95 migraciones**, la más reciente `202608202000_...`. La convención de nombre también cambió de `YYYY-MM-DD-###-desc.sql` a `YYYYMMDDHHMM_desc.sql` en algún punto del camino. Fuente real: `ls supabase/migrations/`.

## 3. Testing E2E (vigente)

| Doc | Rol |
|---|---|
| `cypress/README-e2e.md` | **Doc canónico** de cómo correr la suite E2E — el más reciente y mejor estructurado |
| `docs/testing-e2e-route2-and-nfc.md` | Guardrails E2E específicos de perfiles/cards (Route 2) y NFC |
| `docs/testing-e2e-automation.md`, `docs/testing-e2e-env-conventions.md` | Pueden solaparse con `cypress/README-e2e.md` — revisar antes de citar, priorizar el de Cypress si hay conflicto |
| `docs/admin-profiles-validation-checklist.md`, `docs/admin-access-runbook.md` | Checklists operativas para admin/profiles |

## 4. KPIs y alertas ejecutivas (histórico — serie de 16 docs del 2026-05-14)

Cadena de desarrollo iterativo del mismo día: `KPI_ALERTS_MARGIN_QUALITY`, `KPI_AUTONOMOUS_EVALUATOR`, `KPI_AUTO_DISPATCH_AND_ROUTING`, `KPI_BAND_POLICY_AND_KILL_SWITCH`, `KPI_EXECUTIVE_ALERT_DISPATCH`, `KPI_EXECUTIVE_LAYER`, `KPI_GOVERNANCE_ALERT_READINESS`, `KPI_LOGIC_CONVERGENCE`, `KPI_MARGIN_SEGMENTATION`, `KPI_MODULE_CORRECTIONS`, `KPI_RUNTIME_ADMIN_AND_REMOTE_APPLY`, `KPI_RUNTIME_CONFIG_AND_EXEC_SCORE`, `KPI_SCALE_POLISH`, `KPI_TYPED_CONFIG_AND_ALERT_COOLDOWN` (todos `docs/`, 2026-05-14).

**Si necesitas entender el sistema de KPIs, lee solo estos dos** (son el estado terminal de la serie):
- `docs/KPI_HARDENING_FINAL_2026-05-14.md`
- `docs/KPI_INDUSTRIAL_CLOSEOUT_2026-05-14.md`

El resto son pasos intermedios de la misma sesión de trabajo — útiles solo para arqueología de decisiones, no como referencia de estado.

## 5. Route 2 — profiles / cards / orders (histórico — serie de 11 docs, sin fecha en nombre)

Trío plan+implementación+doc por sub-track: `route2-implementation-plan`, `route2-profiles-first`, `route2-profiles-implementation-plan`, `route2-profiles-restore-minimal`, `route2-profiles-snapshot-minimal`, `route2-cards-implementation-plan`, `route2-cards-lifecycle`, `route2-orders-payments-implementation-plan`, `route2-orders-payments`, `route2-orders-payments-ops-playbook`, `route2-audit-versioning-soft-delete` (todos `docs/`).

Documenta cómo se construyó el modelo actual de perfiles/cards/orders — útil si algo en esa área se comporta raro y hay que entender el diseño original. `route1-memberships-and-events-review.md` es el equivalente para la "Route 1" (memberships/events).

## 6. NFC "C3" (histórico — serie de 7 docs, sin fecha en nombre)

Cadena spec → plan → integración → bridge: `nfc-c3-backlog`, `nfc-c3-implementation-plan`, `nfc-c3-endpoint-implementation-spec`, `nfc-c3-endpoint-integration-current-stack`, `nfc-c3-public-endpoint`, `nfc-c3-supabase-endpoint-bridge`, `nfc-cards-phase-c3` (todos `docs/`). Documenta el diseño de activación NFC; `cards-activation-status-alignment.md` y `cards-edge-cases-next.md` son continuación directa.

## 7. Incidentes y hotfixes (histórico — mayo 2026)

Bitácora de incidentes puntuales ya cerrados, todos en `docs/`, fecha en el nombre: `2026-05-10-authz-hardening-log`, `ALERTA_PROACTIVA_OPERATIVA_2026-05-11`, `HOTFIX_ACTIVACION_Y_WEBHOOK_2026-05-08`, `HOTFIX_CTA_COPY_Y_DETECCION_PERFIL_2026-05-08`, `HOTFIX_DEPLOY_EJECUTADO_2026-05-08`, `HOTFIX_HOME_EMAIL_INPUT_2026-05-08`, `HOTFIX_LANDING_USUARIO_POST_COMPRA_2026-05-08`, `HOTFIX_UX_ORDEN_MODULOS_PERSONAL_EMPRESA_2026-05-08`, `INCIDENCIA_TRACKING_TOKEN_2026-05-08`, `ORDER_LIFECYCLE_HARDENING_2026-05-14`, `ORDER_RECONCILIATION_AND_ANOMALIES_2026-05-14`, `ORDER_RECONCILIATION_AUTOMATION_2026-05-14`, `PAYMENT_LEDGER_BACKFILL_2026-05-14`, `ORDERS_TEST_SEGREGATION_2026-05-13`. No requieren lectura salvo que estés investigando el origen histórico de una decisión específica.

Más recientes (agosto 2026): `docs/PAYMENT_LEDGER_TOOLING_RESOLUTION_2026-08-12.md`, `docs/CLOSE_404_ANALYTICS_CRASH_ZERO_TO_HERO_2026-08-11.md`, `docs/LINT_WARNINGS_CLEANUP_2026-08-11.md`.

## 8. Snapshots y planes ejecutivos superados

`docs/PROJECT_SNAPSHOT_2026-05-08.md`, `docs/ROADMAP_LANZAMIENTO_2026-05-08.md`, `docs/STATUS.md`, `docs/DOCUMENTACION_REPO_2026-05-08.md`, `BITACORA_ETAPA_2.md` a `BITACORA_ETAPA_9.md` (raíz): todos superados por el estado actual del código + `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md`. Se conservan como registro histórico, no como referencia operativa.

`SCHEMA.md` (raíz, versión anterior a este refresh), `DB_SCHEMA_SUPABASE.sql`, `DATABASE_SETUP.sql`, `ADD_COLUMNS.sql`, `ADD_COLUMNS_COVER.sql`: SQL/docs sueltos, anteriores a que `supabase/migrations/` fuera la fuente ordenada. No usar como referencia de schema — ver sección 2.

## 9. Otros documentos vivos en `docs/` no listados arriba

`architecture-option-c.md` (decisión de diseño histórica), `option3-admin-profile-history.md`, `phase-a-cards-admin-integration.md`, `phase-b-cards-lifecycle-tests.md`, `inventory-sku-rollout.md`, `product-inventory-expansion-plan.md`, `security-phase-b2.md`, `security-phase-b3.md`, `API_FRONTEND_ARCHITECTURE_2026-05-15.md`, `REFACTOR_PLAN_FASE1_2026-05-15.md`, `SLA_ETAPAS_Y_TENDENCIA_FUNNEL_2026-05-11.md`, `OBSERVABILIDAD_CAPA2_SERVER_SIDE_2026-05-11.md`, `OBSERVABILIDAD_POST_PAGO_ACTIVACION_2026-05-11.md`, `SMOKE_TEST_OBSERVABILIDAD_CAPA2_2026-05-11.md`, `TRANSPORTE_AUTOMATICO_PREPARADO_2026-05-11.md`, `DIGEST_OPERATIVO_REUTILIZABLE_2026-05-11.md`, `KPIS_ALERTAS_SLA_OBSERVABILIDAD_2026-05-11.md`, `FORMATOS_DELIVERY_LISTOS_2026-05-11.md`, `AUDITORIA_FLUJO_PERFIL_COMPRA_2026-05-08.md`, `AUDITORIA_TECNICA_2026-05-08.md`, `FASE0_DEPLOY_EJECUTADO_2026-05-08.md`, `FASE0_IMPLEMENTACION_2026-05-08.md`, `FEATURE_DOS_LINEAS_PERFIL_PROFESIONAL_Y_NEGOCIO_2026-05-09.md`, `IMPLEMENTACION_MVP_ACTIVACION_2026-05-08.md`, `PLAN_ACTIVACION_PERFIL_POST_PAGO_2026-05-08.md`. Todos son planes/registros puntuales de mayo 2026 — buscar aquí solo si investigas el origen de una feature específica.

SQL utilitario dentro de `docs/` (no son docs, es SQL de implementación que debería haber ido a `supabase/migrations/`): `cards-guardrails-next.sql`, `cards-hardening-assign-activate.sql`, `cards-hardening-revoke.sql`, `cards-lifecycle-rpcs.sql`, `inventory-rpc-and-sku-next-step.sql`, `order-cards-link.sql`, `reassign-card.sql`.

## 10. Archivo externo — `/Users/tars/Documents/NexCard/`

Fuera del repo, no versionado con el código. Contiene cierres de incidentes, auditorías y planes operativos de agosto 2026 (P1/P2/P3, CIERRE_100_NEXCARD, PLAN_REMEDIACION_AUDITORIA_CYBER_NEO, etc.) más subcarpetas `auditorias/` (33 items), `planes/` (17 docs), `evidencia/`, `security/strix/`, `backups/`, `research/`.

**Se indexa como referencia externa, no se migró al repo** (decisión explícita al hacer este refresh). El evento más reciente y autoritativo de esa carpeta es `nexcard-uptimerobot-observability-results-2026-08-19.md`; todo lo fechado 2026-08-01 a 2026-08-11 (la serie `auditorias/`/`planes/`) quedó superado por `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md` dentro del repo.

Nota: varios eventos de agosto quedaron documentados 2-3 veces (en `Documents/NexCard/`, en `docs/` del repo, y en Obsidian) — por ejemplo el cierre "404 Analytics Crash Zero-to-Hero" (2026-08-11) y "Strix LLM Config" (2026-08-11). No se consolidaron en este refresh; si se vuelve a tocar ese tema, la versión en `docs/` del repo es la que debería quedar como canónica.

## 11. Memoria operativa viva (fuera del repo)

- **Obsidian** (`/Users/tars/Documents/Obsidian Vault/Proyectos/NexCard/`) — decisiones, contexto, QA, runbooks, próximos pasos. Índice: `00 - Índice/NexCard - Mapa Operativo.md`. Ver nota de espejo agregada ahí mismo apuntando a este archivo.
- **Graphify** — mapa técnico vivo de dependencias/rutas de impacto. Reporte persistente en `/Users/tars/Documents/NexCard/graphify/latest/GRAPH_REPORT.md`.

Regla ya establecida: antes de cambios grandes, consultar Graphify para impacto técnico; después de decisiones/verificaciones, registrar síntesis en Obsidian. Documentación de **estado del sistema** (qué existe, cómo funciona) va en el repo (este índice y los docs raíz); documentación de **decisiones y contexto operativo** va en Obsidian.
