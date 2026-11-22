// Contenu des pages de projet (ADR 0016) : chaque dossier de src/content/projets/ avec sa fiche
// (projet.ts) et ses pages (les autres fichiers .ts), lus par check-content.ts, Vitest, Playwright
// et dragon-ecart.ts. Ce dernier tourne sans dépendances installées (dragon-ecart.yml) : ce fichier
// et le contenu n'importent à l'exécution que des modules de Node.
import { readdirSync } from 'node:fs';

const root = new URL('../src/content/projets/', import.meta.url);

const load = async (url: URL): Promise<unknown> =>
  ((await import(url.href)) as { default: unknown }).default;

export const loadProjectContents = async () =>
  Promise.all(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(async ({ name: dir }) => {
        const folder = new URL(`${dir}/`, root);
        const files = readdirSync(folder).filter(
          (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
        );
        const file = (name: string) => `src/content/projets/${dir}/${name}`;
        return {
          dir,
          meta: {
            file: file('projet.ts'),
            data: await load(new URL('projet.ts', folder)),
          },
          pages: await Promise.all(
            files
              .filter((name) => name !== 'projet.ts')
              .map(async (name) => ({
                file: file(name),
                data: await load(new URL(name, folder)),
              })),
          ),
        };
      }),
  );
