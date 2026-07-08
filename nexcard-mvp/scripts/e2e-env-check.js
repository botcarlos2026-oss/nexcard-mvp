#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'local';

const loadEnvFile = (file) => {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  });
};

['.env', '.env.local', '.env.e2e.local'].forEach(loadEnvFile);

const readEnv = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

const groups = {
  local: ['CYPRESS_login_email', 'CYPRESS_login_password'],
  smoke: ['CYPRESS_login_email', 'CYPRESS_login_password'],
  nfc: ['CYPRESS_nfc_token', 'CYPRESS_nfc_expected_slug'],
  'soft-delete': ['CYPRESS_deleted_profile_slug'],
  'cards-lifecycle': [
    'CYPRESS_login_email',
    'CYPRESS_login_password',
    'CYPRESS_revoked_nfc_token',
    'CYPRESS_revoked_expected_status',
    'CYPRESS_archived_nfc_token',
    'CYPRESS_archived_expected_status',
  ],
  'admin-profiles': [
    'CYPRESS_login_email',
    'CYPRESS_login_password',
    'CYPRESS_active_profile_slug',
    'CYPRESS_active_profile_status',
    'CYPRESS_active_profile_versions',
    'CYPRESS_active_profile_last_event',
    'CYPRESS_archived_profile_slug',
    'CYPRESS_archived_profile_status',
    'CYPRESS_archived_profile_versions',
    'CYPRESS_archived_profile_last_event',
  ],
};

const required = groups[mode] || groups.local;
const missing = required.filter((name) => !readEnv(name));

const warnings = [];
if (!readEnv('REACT_APP_SUPABASE_URL')) warnings.push('REACT_APP_SUPABASE_URL is empty; login/public profile specs may fail if the app depends on Supabase.');
if (!readEnv('REACT_APP_SUPABASE_ANON_KEY')) warnings.push('REACT_APP_SUPABASE_ANON_KEY is empty; auth/network flows may fail before Cypress assertions.');

if (missing.length) {
  console.error(`[e2e:env-check] Missing required env for mode "${mode}":`);
  missing.forEach((name) => console.error(`- ${name}`));
  console.error('\nTip: copy .env.e2e.example to .env.e2e.local and fill the seeded values.');
  process.exit(1);
}

console.log(`[e2e:env-check] OK for mode "${mode}"`);
if (warnings.length) {
  console.log('[e2e:env-check] Warnings:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
