import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const landingPath = path.join(repoRoot, 'src/components/LandingPage.jsx');
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('landing profile slug security', () => {
  it('usa un path interno validado antes de navegar a un perfil', () => {
    const source = read(landingPath);

    expect(source).toContain('export const buildSafeProfilePath');
    expect(source).toContain('isSafeProfileSlug(normalized) ? `/${normalized}` : null');
    expect(source).toContain('window.location.assign(path)');
    expect(source).not.toContain('window.location.href = `/${slug.trim()}`');
  });
});
