# NexCard — Checklist ejecutable de rotación de secretos

## Objetivo
Rotar credenciales sensibles detectadas en el workspace sin romper operación.

## Hallazgo importante
`nexcard-mvp/.env.local` aparece trackeado por git.
Eso es una mala práctica incluso si solo contiene variables de frontend públicas.
Debe revisarse y corregirse en una fase posterior.

---

# 1. Prioridad de rotación

## Prioridad crítica
1. Supabase Access Token
2. Supabase DB Password

## Prioridad alta
3. Vercel Token
4. GitHub PAT

---

# 2. Regla de ejecución
Para cada secreto:
1. crear nuevo
2. actualizar punto de uso
3. validar funcionamiento
4. revocar secreto viejo

No al revés.

---

# 3. Supabase Access Token

## Objetivo
Rotar el token administrativo usado para CLI/API.

## Pasos
- [ ] entrar a Supabase Account / Access Tokens
- [ ] crear nuevo token
- [ ] actualizar `.env.secrets`
- [ ] actualizar cualquier script/entorno que use `SUPABASE_ACCESS_TOKEN`
- [ ] validar acceso administrativo/CLI
- [ ] revocar token anterior

## Validación mínima
- [ ] listar proyecto / acceder vía CLI
- [ ] confirmar que herramientas administrativas siguen operando

---

# 4. Supabase DB Password

## Objetivo
Rotar password directo de la base.

## Pasos
- [ ] cambiar password de DB en Supabase
- [ ] actualizar `.env.secrets`
- [ ] actualizar cualquier DB URL o script dependiente
- [ ] validar conexión administrativa a DB
- [ ] revocar / invalidar valor anterior

## Validación mínima
- [ ] consultas administrativas vuelven a funcionar
- [ ] scripts DB siguen conectando

---

# 5. Vercel Token

## Objetivo
Rotar acceso a despliegue/plataforma.

## Pasos
- [ ] crear nuevo token Vercel
- [ ] actualizar `.env.secrets`
- [ ] actualizar CI/CD o scripts si aplica
- [ ] validar comando/deploy relevante
- [ ] revocar token anterior

## Validación mínima
- [ ] acceso a proyecto / deploy operativo

---

# 6. GitHub PAT

## Objetivo
Rotar acceso a GitHub minimizando scopes.

## Pasos
- [ ] inventariar qué uso real tiene el PAT (`gh`, push, workflow, repo)
- [ ] crear nuevo PAT con scopes mínimos
- [ ] actualizar `.env.secrets`
- [ ] actualizar tooling/CLI si aplica
- [ ] validar operación necesaria
- [ ] revocar token anterior

## Validación mínima
- [ ] `gh auth status` o flujo equivalente
- [ ] operación de repo necesaria sigue funcionando

---

# 7. Higiene posterior a la rotación

## `.env.secrets`
- [ ] conservar solo secretos vigentes
- [ ] eliminar secretos ya revocados

## `.env.local`
- [ ] revisar si debe seguir trackeado
- [ ] separar variables públicas de frontend de secretos operativos
- [ ] remover cualquier secreto privado si hubiera entrado ahí

## Repo
- [ ] revisar historial reciente si alguna credencial sensible fue commiteada antes
- [ ] si hubo exposición real, considerar invalidación inmediata adicional

---

# 8. Riesgos abiertos

## Riesgo 1
Rotar DB password y olvidar actualizar un script secundario.

### Mitigación
Checklist + validación inmediata.

## Riesgo 2
Mantener `.env.local` trackeado y mezclar variables públicas con material sensible.

### Mitigación
Separación explícita y limpieza posterior.

## Riesgo 3
PAT nuevo con scopes excesivos.

### Mitigación
Reducir permisos al mínimo necesario.

---

# 9. Recomendación ejecutiva
Hacer la rotación en este orden:
1. Supabase Access Token
2. Supabase DB Password
3. Vercel Token
4. GitHub PAT

Y dejar evidencia mínima en un changelog operativo interno de:
- fecha
- qué se rotó
- qué se validó
- quién lo hizo
