import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/claim-profile/index.ts'),
  'utf8'
);

describe('claim-profile logging safety', () => {
  it('no registra el claim token ni siquiera parcialmente cuando no encuentra el claim', () => {
    expect(source).not.toContain('token_prefix');
    expect(source).not.toContain('token.slice');
    expect(source).not.toContain('{ token, error: claimError?.message || null }');
  });
});
