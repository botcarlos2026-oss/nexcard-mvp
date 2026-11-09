import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/202611082341_close_profiles_public_base_read.sql'
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const normalizedMigration = migration.replace(/^\s*--\s?/gm, '').replace(/\s+/g, ' ');
const executableSql = migration
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*--.*$/gm, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

describe('close profiles public base read migration', () => {
  it('revoca anon en la tabla base y conserva SELECT solo en la vista pública', () => {
    expect(executableSql).toContain('begin;');
    expect(executableSql).toContain(
      'drop policy if exists "profiles_public_read" on public.profiles;'
    );
    expect(executableSql).toContain('revoke select on table public.profiles from anon;');
    expect(executableSql).toContain(
      'grant select on table public.profiles_public to anon, authenticated;'
    );
    expect(executableSql).toContain("notify pgrst, 'reload schema';");
  });

  it('prohíbe reversas inseguras y exige una recuperación roll-forward', () => {
    expect(executableSql).not.toMatch(/create\s+policy\s+"profiles_public_read"/i);
    expect(executableSql).not.toMatch(
      /grant\s+select\s+on\s+table\s+public\.profiles\s+to\s+anon/i
    );
    expect(migration).toContain('NO INSECURE ROLLBACK');
    expect(migration).toContain('ROLL FORWARD ONLY');
    expect(migration).toContain('repair or recreate public.profiles_public');
    expect(migration).toContain('restore its SELECT grant to anon and authenticated');
    expect(normalizedMigration).toContain('reload the PostgREST schema cache');
    expect(migration).not.toMatch(
      /grant\s+select\s+on\s+table\s+public\.profiles\s+to\s+anon/i
    );
    expect(migration).not.toMatch(/create\s+policy\s+"profiles_public_read"/i);
  });
});