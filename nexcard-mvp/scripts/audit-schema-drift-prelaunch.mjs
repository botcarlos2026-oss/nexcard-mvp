#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('usage: node scripts/audit-schema-drift-prelaunch.mjs /path/to/prod_schema_public.sql');
  process.exit(2);
}
const migrationsDir = path.join(root, 'supabase', 'migrations');
const dump = fs.readFileSync(dumpPath, 'utf8');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

const cleanIdent = (s) => s.replace(/^IF NOT EXISTS\s+/i, '').replace(/"/g, '').replace(/;$/g, '').trim();
const normalizeName = (schema, name) => `${(schema || 'public').replace(/"/g, '')}.${name.replace(/"/g, '').split('(')[0]}`.toLowerCase();
const add = (map, type, schema, name, file) => {
  name = cleanIdent(name || '');
  if (!name || name.startsWith('(')) return;
  let full;
  if (name.includes('.')) {
    const parts = name.split('.');
    full = normalizeName(parts.slice(0, -1).join('.'), parts[parts.length - 1]);
  } else {
    full = normalizeName(schema || 'public', name);
  }
  if (!map.has(`${type}:${full}`)) map.set(`${type}:${full}`, { type, name: full, files: [] });
  map.get(`${type}:${full}`).files.push(file);
};

const expected = new Map();
for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  let m;
  const specs = [
    ['table', /CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)/gi],
    ['view', /CREATE\s+(?:OR\s+REPLACE\s+)?(?:SECURITY\s+INVOKER\s+)?VIEW\s+([\w".]+)/gi],
    ['materialized_view', /CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)/gi],
    ['function', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w".]+)\s*\(/gi],
    ['trigger', /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([\w"]+)/gi],
    ['policy', /CREATE\s+POLICY\s+"?([^"\n]+?)"?\s+ON\s+([\w".]+)/gi],
    ['index', /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)/gi],
    ['type', /CREATE\s+TYPE\s+([\w".]+)/gi],
    ['sequence', /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)/gi],
  ];
  for (const [type, re] of specs) {
    while ((m = re.exec(sql))) {
      if (type === 'policy') add(expected, type, m[2], m[1], file);
      else add(expected, type, 'public', m[1], file);
    }
  }
}

const existsInDump = (obj) => {
  const unq = obj.name.replace(/^public\./, '');
  const escaped = unq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = `(?:(?:public|"public")\\.|"public"\\.)?"?${escaped}"?`;
  const has = (re) => re.test(dump);
  if (obj.type === 'table') return has(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${namePattern}\\b`, 'i'));
  if (obj.type === 'view') return has(new RegExp(`CREATE (?:OR REPLACE )?VIEW ${namePattern}\\b`, 'i'));
  if (obj.type === 'materialized_view') return has(new RegExp(`CREATE MATERIALIZED VIEW ${namePattern}\\b`, 'i'));
  if (obj.type === 'function') return has(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION ${namePattern}\\s*\\(`, 'i'));
  if (obj.type === 'trigger') return has(new RegExp(`CREATE (?:OR REPLACE )?TRIGGER "?${escaped}"?\\b`, 'i'));
  if (obj.type === 'policy') {
    const policyName = obj.name.split('.').pop();
    const policyEscaped = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return has(new RegExp(`CREATE POLICY "?${policyEscaped}"?\\b`, 'i'));
  }
  if (obj.type === 'index') {
    // Unique constraints (ADD CONSTRAINT ... UNIQUE) create a backing index without a
    // literal CREATE INDEX statement — check both forms.
    if (has(new RegExp(`CREATE (?:UNIQUE )?INDEX .*"?${escaped}"?\\b`, 'i'))) return true;
    return has(new RegExp(`ADD CONSTRAINT "?${escaped}"?\\s+UNIQUE\\b`, 'i'));
  }
  if (obj.type === 'type') return has(new RegExp(`CREATE TYPE ${namePattern}\\b`, 'i'));
  if (obj.type === 'sequence') return has(new RegExp(`CREATE SEQUENCE (?:IF NOT EXISTS )?${namePattern}\\b`, 'i'));
  return false;
};

const all = [...expected.values()];
const missing = all.filter((o) => !existsInDump(o));

const sourceFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage', 'cypress/screenshots', 'cypress/videos'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(ent.name)) sourceFiles.push(p);
  }
}
walk(root);
const consumers = new Map();
for (const f of sourceFiles) {
  const rel = path.relative(root, f);
  const s = fs.readFileSync(f, 'utf8');
  const patterns = [
    // `.storage.from('bucket')` targets a Storage bucket, not a public-schema table —
    // excluded below since it's out of scope for a public-schema SQL diff.
    [/\.storage\.from\(\s*['"]([^'"]+)['"]\s*\)/g, true],
    [/\.from\(\s*['"]([^'"]+)['"]\s*\)/g, false],
    [/\.rpc\(\s*['"]([^'"]+)['"]\s*[,)]/g, false],
    [/supabase\.channel\(\s*['"]([^'"]+)['"]\s*\)/g, false],
  ];
  const storageBuckets = new Set();
  for (const [re, isStorage] of patterns) {
    let m;
    while ((m = re.exec(s))) {
      const key = m[1].toLowerCase();
      if (isStorage) { storageBuckets.add(key); continue; }
      if (!consumers.has(key)) consumers.set(key, []);
      consumers.get(key).push(rel);
    }
  }
  for (const bucket of storageBuckets) consumers.delete(bucket);
}
const consumerMissing = [...consumers.entries()].filter(([name]) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = `(?:(?:public|"public")\\.|"public"\\.)?"?${escaped}"?`;
  return !new RegExp(`CREATE (?:TABLE|(?:OR REPLACE )?VIEW|(?:OR REPLACE )?FUNCTION) (?:IF NOT EXISTS )?${namePattern}(?:\\b|\\s*\\()`, 'i').test(dump);
}).map(([name, files]) => ({ name, files: [...new Set(files)].slice(0, 12) }));

const byType = all.reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
const missingByType = missing.reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
const report = {
  generated_at: new Date().toISOString(),
  migrations_scanned: migrationFiles.length,
  expected_objects: all.length,
  expected_by_type: byType,
  missing_count: missing.length,
  missing_by_type: missingByType,
  missing: missing.map((o) => ({ ...o, files: [...new Set(o.files)].slice(0, 5) })),
  note_policies: 'Policy names are matched by literal name only. A later migration that DROPs/renames a policy (e.g. consolidating into role-based has_role() policies) will show the old name as "missing" even though an equivalent policy exists under a new name. Verify remaining policy entries manually against the target table before treating them as drift.',
  app_consumers_scanned: sourceFiles.length,
  consumer_missing_count: consumerMissing.length,
  consumer_missing: consumerMissing,
};
console.log(JSON.stringify(report, null, 2));
process.exit(missing.length || consumerMissing.length ? 1 : 0);
