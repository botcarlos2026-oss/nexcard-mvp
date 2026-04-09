# NexCard — Route 2 manual test playbook

## Objetivo
Acelerar validaciones manuales en Supabase para snapshot, soft delete y restore de perfiles.

---

# Perfil de prueba recomendado
Usar un perfil de test/no crítico.
Ejemplo usado en la sesión:
- `79e43d7c-a769-4d0a-994e-a1ee9f436c8d` (`bot-carlos`)

---

# 1. Crear snapshot
```sql
select public.snapshot_profile(
  '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid,
  null::uuid
);
```

# 2. Ver versiones
```sql
select profile_id, version, created_by, created_at
from public.profile_versions
where profile_id = '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid
order by version desc;
```

# 3. Soft delete
```sql
select public.soft_delete_profile(
  '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid,
  null::uuid
);
```

# 4. Confirmar soft delete
```sql
select id, slug, full_name, status, deleted_at
from public.profiles
where id = '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid;
```

# 5. Restore versión 1
```sql
select public.restore_profile_version(
  '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid,
  1,
  null::uuid
);
```

# 6. Confirmar restore
```sql
select id, slug, full_name, status, deleted_at
from public.profiles
where id = '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid;
```

# 7. Audit trail
```sql
select entity_type, entity_id, action, created_at, context
from public.audit_log
where entity_id = '79e43d7c-a769-4d0a-994e-a1ee9f436c8d'::uuid
order by created_at desc;
```
