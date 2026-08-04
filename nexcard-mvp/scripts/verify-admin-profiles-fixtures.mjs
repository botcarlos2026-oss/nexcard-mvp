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

const readEnv = (name) => (typeof process.env[name] === 'string' ? process.env[name].trim() : '');

const formatEventLabel = (value) => {
  if (!value) return 'Sin eventos';
  const labels = {
    profile_restore: 'Restore ejecutado',
    profile_snapshot: 'Snapshot generado',
    profile_soft_delete: 'Soft delete ejecutado',
  };
  return labels[value] || String(value).replace(/_/g, ' ');
};

const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('REACT_APP_SUPABASE_URL');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY') || readEnv('SUPABASE_SERVICE_KEY');
const requiredBase = ['CYPRESS_active_profile_slug', 'CYPRESS_archived_profile_slug'];
const missing = [
  ...requiredBase,
  ...['active', 'archived'].flatMap((kind) => [
    `CYPRESS_${kind}_profile_status`,
    `CYPRESS_${kind}_profile_versions`,
    `CYPRESS_${kind}_profile_last_event`,
  ]),
].filter((name) => !readEnv(name));

if (!supabaseUrl || !serviceKey || missing.length) {
  console.log(JSON.stringify({
    success: false,
    error: 'missing_env',
    has_supabase_url: Boolean(supabaseUrl),
    has_service_role: Boolean(serviceKey),
    missing,
  }, null, 2));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const slugs = ['active', 'archived'].map((kind) => readEnv(`CYPRESS_${kind}_profile_slug`));

const { data: profiles, error: profilesError } = await supabase
  .from('profiles')
  .select('id, slug, full_name, status, deleted_at, updated_at')
  .in('slug', slugs);
if (profilesError) throw profilesError;

const profileIds = (profiles || []).map((profile) => profile.id);
const [{ data: versions, error: versionsError }, { data: events, error: eventsError }] = await Promise.all([
  profileIds.length
    ? supabase.from('profile_versions').select('profile_id, version').in('profile_id', profileIds)
    : { data: [], error: null },
  profileIds.length
    ? supabase.from('audit_log').select('entity_id, action, created_at').eq('entity_type', 'profile').in('entity_id', profileIds).order('created_at', { ascending: false })
    : { data: [], error: null },
]);
if (versionsError) throw versionsError;
if (eventsError) throw eventsError;

const bySlug = new Map((profiles || []).map((profile) => [profile.slug, profile]));
const versionCounts = (versions || []).reduce((acc, version) => {
  acc[version.profile_id] = (acc[version.profile_id] || 0) + 1;
  return acc;
}, {});
const lastEvents = (events || []).reduce((acc, event) => {
  if (!acc[event.entity_id]) acc[event.entity_id] = event;
  return acc;
}, {});

const failures = [];
const fixtureResults = [];
for (const kind of ['active', 'archived']) {
  const slug = readEnv(`CYPRESS_${kind}_profile_slug`);
  const profile = bySlug.get(slug);
  const expectedStatus = readEnv(`CYPRESS_${kind}_profile_status`);
  const expectedDeleted = readEnv(`CYPRESS_${kind}_profile_deleted`) || (kind === 'archived' ? 'Sí' : 'No');
  const expectedFullName = readEnv(`CYPRESS_${kind}_profile_full_name`);
  const expectedVersions = Number(readEnv(`CYPRESS_${kind}_profile_versions`));
  const expectedLastEvent = readEnv(`CYPRESS_${kind}_profile_last_event`);

  if (!profile) {
    failures.push(`${kind}: slug ${slug} not found`);
    fixtureResults.push({ kind, slug, found: false });
    continue;
  }

  const actualDeleted = profile.deleted_at ? 'Sí' : 'No';
  const actualVersions = versionCounts[profile.id] || 0;
  const actualEventAction = lastEvents[profile.id]?.action || '';
  const actualEventLabel = formatEventLabel(actualEventAction);

  const actualStatus = profile.deleted_at ? 'archived' : profile.status;
  if (actualStatus !== expectedStatus) failures.push(`${kind}: status ${actualStatus} != ${expectedStatus}`);
  if (expectedFullName && profile.full_name !== expectedFullName) failures.push(`${kind}: full_name ${profile.full_name} != ${expectedFullName}`);
  if (actualDeleted !== expectedDeleted) failures.push(`${kind}: deleted ${actualDeleted} != ${expectedDeleted}`);
  if (actualVersions !== expectedVersions) failures.push(`${kind}: versions ${actualVersions} != ${expectedVersions}`);
  if (actualEventAction !== expectedLastEvent && actualEventLabel !== expectedLastEvent) {
    failures.push(`${kind}: last_event ${actualEventAction || actualEventLabel || 'none'} != ${expectedLastEvent}`);
  }

  fixtureResults.push({
    kind,
    slug,
    found: true,
    status: profile.status,
    deleted: actualDeleted,
    versions: actualVersions,
    last_event_action: actualEventAction || null,
    last_event_label: actualEventLabel,
  });
}

const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
if (duplicateSlugs.length) failures.push(`duplicate fixture slugs: ${[...new Set(duplicateSlugs)].join(', ')}`);

console.log(JSON.stringify({
  success: failures.length === 0,
  mode: 'read_only',
  checked_at: new Date().toISOString(),
  fixtures: fixtureResults,
  failures,
}, null, 2));

if (failures.length) process.exit(1);
