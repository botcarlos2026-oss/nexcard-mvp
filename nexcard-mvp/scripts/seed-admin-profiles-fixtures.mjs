#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

['.env', '.env.local', '.env.e2e.local', '.env.secrets', '../.env.secrets', '../../.env.secrets']
  .map((name) => path.resolve(process.cwd(), name))
  .forEach(loadEnv);

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.log(JSON.stringify({ success: false, error: 'missing_supabase_service_env', has_url: !!supabaseUrl, has_service_role: !!serviceKey }, null, 2));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const now = new Date().toISOString();
const fixtures = [
  {
    kind: 'smoke',
    slug: 'qa-smoke-profile',
    full_name: 'QA Smoke Profile',
    profession: 'Perfil público QA NexCard',
    bio: 'Fixture estable para smoke público real de NexCard.',
    whatsapp: '56911111111',
    website: 'https://www.nexcard.cl',
    status: 'active',
    deleted_at: null,
    versions: 1,
    event: 'profile_snapshot',
  },
  {
    kind: 'active',
    slug: 'qa-active-profile',
    full_name: 'QA Active Profile',
    profession: 'Fixture activo NexCard',
    bio: 'Fixture estable para admin profiles activo.',
    whatsapp: '56922222222',
    website: 'https://www.nexcard.cl',
    status: 'active',
    deleted_at: null,
    versions: 2,
    event: 'profile_snapshot',
  },
  {
    kind: 'archived',
    slug: 'qa-archived-profile',
    full_name: 'QA Archived Profile',
    profession: 'Fixture archivado NexCard',
    bio: 'Fixture estable para admin profiles archivado.',
    whatsapp: '56933333333',
    website: 'https://www.nexcard.cl',
    status: 'active',
    deleted_at: now,
    versions: 3,
    event: 'profile_soft_delete',
  },
];

const results = [];
for (const fixture of fixtures) {
  const baseProfile = {
    slug: fixture.slug,
    full_name: fixture.full_name,
    profession: fixture.profession,
    bio: fixture.bio,
    theme_color: '#10B981',
    is_dark_mode: true,
    whatsapp: fixture.whatsapp,
    website: fixture.website,
    vcard_enabled: true,
    bank_enabled: false,
    view_count: 0,
    status: fixture.status,
    account_type: 'individual',
    deleted_at: fixture.deleted_at,
    updated_at: now,
  };

  const { data: profile, error: upsertError } = await supabase
    .from('profiles')
    .upsert(baseProfile, { onConflict: 'slug' })
    .select('id, slug, status, deleted_at')
    .single();

  if (upsertError) {
    results.push({ kind: fixture.kind, slug: fixture.slug, success: false, error: upsertError.message });
    continue;
  }

  await supabase.from('profile_versions').delete().eq('profile_id', profile.id);
  const versionRows = Array.from({ length: fixture.versions }, (_, index) => ({
    profile_id: profile.id,
    version: index + 1,
    snapshot: { ...baseProfile, fixture: 'admin_profiles_e2e', version: index + 1 },
    created_by: null,
  }));
  const { error: versionsError } = await supabase.from('profile_versions').insert(versionRows);

  await supabase.from('audit_log').delete().eq('entity_type', 'profile').eq('entity_id', profile.id);
  const { error: auditError } = await supabase.from('audit_log').insert({
    actor_user_id: null,
    actor_role: 'qa_fixture',
    entity_type: 'profile',
    entity_id: profile.id,
    action: fixture.event,
    before: null,
    after: { slug: fixture.slug, status: fixture.status },
    context: { fixture: 'admin_profiles_e2e', kind: fixture.kind },
  });

  results.push({
    kind: fixture.kind,
    slug: fixture.slug,
    success: !versionsError && !auditError,
    id: profile.id,
    status: profile.status,
    deleted: profile.deleted_at ? 'Sí' : 'No',
    versions: fixture.versions,
    event: fixture.event,
    versions_error: versionsError?.message || null,
    audit_error: auditError?.message || null,
  });
}

const success = results.every((result) => result.success);
console.log(JSON.stringify({ success, mode: 'qa_fixture_seed', results }, null, 2));
if (!success) process.exit(1);
