import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  checkSources,
  github,
  type Get,
  type Project,
} from './dragon-ecart.ts';

const read = 'a'.repeat(40);
const last = 'b'.repeat(40);
const api = '/repos/HSSRD/Dragon';

/** Projet d'essai : une section qui cite `path` au commit relevé. */
const project = (path: string): Project => ({
  repo: 'https://github.com/HSSRD/Dragon',
  sources: [
    {
      file: 'src/content/projets/dragon/achats.ts',
      section: 'budget',
      path,
      sha: read,
    },
  ],
});

/** Dragon simulé : l'empreinte de chaque fichier au commit relevé et à HEAD. */
const dragon =
  (atRead: Record<string, string>, atHead: Record<string, string>): Get =>
  async (path) => {
    const tree = (blobs: Record<string, string>) => ({
      truncated: false,
      tree: Object.entries(blobs).map(([file, sha]) => ({ path: file, sha })),
    });
    if (path === `${api}/git/trees/HEAD?recursive=1`) return tree(atHead);
    if (path === `${api}/git/trees/${read}?recursive=1`) return tree(atRead);
    if (path.startsWith(`${api}/commits?`)) return [{ sha: last }];
    throw new Error(`requête inattendue : ${path}`);
  };

afterEach(() => vi.unstubAllGlobals());

describe('pnpm dragon:ecart', () => {
  test('un fichier modifié après son relevé : section, fichier, SHA relevé et dernier SHA, en échec', async () => {
    const { code, report } = await checkSources(
      [project('docs/ordre-achat.md')],
      dragon({ 'docs/ordre-achat.md': '1' }, { 'docs/ordre-achat.md': '2' }),
    );
    expect(code).toBe(1);
    expect(report).toContain(
      `- src/content/projets/dragon/achats.ts, section « budget » : \`docs/ordre-achat.md\` de HSSRD/Dragon, relevé au commit \`${read}\`, modifié depuis (dernier commit : \`${last}\`).`,
    );
  });

  test('un fichier supprimé ou absent du commit relevé est à relire', async () => {
    const deleted = await checkSources(
      [project('README.md')],
      dragon({ 'README.md': '1' }, {}),
    );
    expect(deleted.code).toBe(1);
    expect(deleted.report).toContain('supprimé depuis');
    const missing = await checkSources([project('README.md')], dragon({}, {}));
    expect(missing.code).toBe(1);
    expect(missing.report).toContain(`absent du commit relevé \`${read}\``);
  });

  test('des sources à jour : une ligne, en succès', async () => {
    const { code, report } = await checkSources(
      [project('README.md')],
      dragon(
        { 'README.md': '1', 'bom.md': '1' },
        { 'README.md': '1', 'bom.md': '2' },
      ),
    );
    expect(code).toBe(0);
    expect(report).toBe('Sources à jour : aucune section à relire sur 1.');
  });

  test('Dragon injoignable : le contrôle le dit et ne conclut pas « à jour »', async () => {
    // Erreur de fetch de Node quand le DNS ne répond pas.
    vi.stubGlobal('fetch', () =>
      Promise.reject(
        new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }),
      ),
    );
    const { code, report } = await checkSources(
      [project('README.md')],
      github(undefined),
    );
    expect(code).toBe(2);
    expect(report).toBe(
      'Contrôle impossible : api.github.com injoignable (ENOTFOUND). Aucune source n’est vérifiée.',
    );
    expect(report).not.toMatch(/à jour/);
  });

  test('une réponse en erreur de GitHub rend le contrôle impossible', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('', { status: 403 })),
    );
    const { code, report } = await checkSources(
      [project('README.md')],
      github(undefined),
    );
    expect(code).toBe(2);
    expect(report).toContain('a répondu 403');
  });

  test('un contenu illisible rend le contrôle impossible, pas « à relire »', async () => {
    const { code } = await checkSources(
      Promise.reject(new Error('module introuvable')),
      dragon({}, {}),
    );
    expect(code).toBe(2);
  });

  test('un fichier cité par plusieurs sections : son dernier commit demandé une fois', async () => {
    const requests: string[] = [];
    const get = dragon({ 'README.md': '1' }, { 'README.md': '2' });
    const twice = project('README.md');
    const [first] = twice.sources;
    if (!first) throw new Error('source d’essai attendue');
    twice.sources.push({ ...first, section: 'methode' });
    const { code, report } = await checkSources([twice], (path) => {
      requests.push(path);
      return get(path);
    });
    expect(code).toBe(1);
    expect(report).toContain('section « methode »');
    expect(requests.filter((path) => path.includes('/commits?'))).toHaveLength(
      1,
    );
  });

  test('un arbre tronqué rend le contrôle impossible', async () => {
    const { code } = await checkSources([project('README.md')], () =>
      Promise.resolve({ truncated: true, tree: [] }),
    );
    expect(code).toBe(2);
  });
});
