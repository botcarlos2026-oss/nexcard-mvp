#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const trigger = process.argv[2] || 'manual';

const loadEnvFile = (file) => {
  const fullPath = path.join(cwd, file);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  });
};

loadEnvFile('.env');
loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(JSON.stringify({ success: false, error: 'Faltan SUPABASE_URL/ANON_KEY o REACT_APP_SUPABASE_URL/ANON_KEY' }));
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/functions/v1/evaluate-executive-alert`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
  },
  body: JSON.stringify({ trigger }),
});

const data = await response.json().catch(() => ({}));
const output = {
  http_ok: response.ok,
  status: response.status,
  trigger,
  ...data,
};

console.log(JSON.stringify(output));
if (!response.ok || data?.error) process.exit(1);
