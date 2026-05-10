# Runbook — Accesos Admin NexCard

## Fuente de verdad
- **La fuente de verdad real debe ser `public.memberships`.**
- La whitelist frontend solo debe existir como resguardo transitorio de UI, no como modelo permanente de autorización.

## Alta de admin
1. Agregar/validar usuario en Auth.
2. Insertar membresía admin en `public.memberships`.
3. Validar acceso real a:
   - `/admin`
   - órdenes
   - cards
   - inventory
4. Verificar que el cambio quede auditado/documentado.

## Baja de admin
1. Revocar o soft-delete de la fila en `public.memberships`.
2. Verificar que ya no pueda entrar a `/admin`.
3. Verificar que ya no pueda ejecutar escrituras privilegiadas.
4. Registrar fecha, motivo y actor del cambio.

## Cambio de correo
1. No asumir que la UI basta.
2. Actualizar memberships según corresponda.
3. Revisar whitelist frontend si todavía sigue activa.
4. Probar login real post-cambio.

## Checklist mínimo post-cambio
- [ ] acceso UI correcto
- [ ] RLS admin efectiva
- [ ] sin acceso residual por memberships antiguas
- [ ] sin drift entre frontend y DB

## Revisión periódica
- Revisar tablas con policies amplias (`authenticated all`).
- Revisar Edge Functions que usan `SUPABASE_SERVICE_ROLE_KEY`.
- Revisar helpers `has_role()` e `is_org_member()` después de cada cambio de permisos.

## Prioridad técnica pendiente
1. Eliminar drift entre whitelist UI y memberships.
2. Filtrar `deleted_at is null` en helpers de autorización.
3. Reducir client writes privilegiadas.
4. Exigir validación explícita de JWT + rol admin en Edge Functions sensibles.
