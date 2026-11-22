// Contrôle d'écart des pages de projet (ADR 0016, ticket #103) : compare chaque source de
// src/content/projets/ (chemin, SHA relevé) à la dernière version du fichier dans le repo du projet.
// Usage : pnpm dragon:ecart (réseau, donc hors de pnpm verify) ; .github/workflows/dragon-ecart.yml
// le lance chaque semaine et ouvre un ticket quand il sort en 1.
// Sortie : 0 à jour, 1 sections à relire, 2 contrôle impossible.
// Le rapport ne cite que des chemins et des SHA, jamais le contenu du repo source : ses fichiers
// contiennent aussi des données jamais publiées.
import { loadProjectContents } from './project-content.ts';

interface Source {
  /** Fichier de contenu du site. */
  file: string;
  section: string;
  path: string;
  sha: string;
}

export interface Project {
  /** Racine du repo source : https://github.com/<org>/<repo>. */
  repo: string;
  sources: Source[];
}

/** Réponse JSON d'un chemin de l'API GitHub ; lève une erreur si la requête échoue. */
export type Get = (path: string) => Promise<unknown>;

interface Tree {
  truncated: boolean;
  tree: { path: string; sha: string }[];
}

/** Sources de chaque projet, telles que loadProjectContents les lit (contenu validé au build). */
const projectsOf = (
  contents: Awaited<ReturnType<typeof loadProjectContents>>,
): Project[] =>
  contents.map(({ meta, pages }) => ({
    repo: (meta.data as { repo: string }).repo,
    sources: pages.flatMap(({ file, data }) =>
      (
        data as {
          sections: { id: string; source: { path: string; sha: string } }[];
        }
      ).sections.map(({ id, source }) => ({
        file,
        section: id,
        path: source.path,
        sha: source.sha,
      })),
    ),
  }));

/** Sections dont le fichier source a changé, a disparu ou manque au commit relevé. */
const gaps = async ({ repo, sources }: Project, get: Get) => {
  const name = repo.replace('https://github.com/', '');
  const api = `/repos/${name}`;
  // Empreinte de chaque fichier à un commit : égale d'un commit à l'autre si le fichier n'a pas changé.
  const trees = new Map<string, Promise<Map<string, string>>>();
  const blobs = (ref: string) => {
    const known = trees.get(ref);
    if (known) return known;
    const loaded = get(`${api}/git/trees/${ref}?recursive=1`).then((data) => {
      const { truncated, tree } = data as Tree;
      // Un arbre tronqué ferait passer un fichier absent pour supprimé.
      if (truncated)
        throw new Error(`arbre de ${repo} au commit ${ref} tronqué`);
      return new Map(tree.map((entry) => [entry.path, entry.sha]));
    });
    trees.set(ref, loaded);
    return loaded;
  };
  const latest = await blobs('HEAD');
  const lines: string[] = [];
  for (const { file, section, path, sha } of sources) {
    const read = (await blobs(sha)).get(path);
    const now = latest.get(path);
    if (read !== undefined && read === now) continue;
    const query = new URLSearchParams({ path, per_page: '1' });
    const [last] = (await get(`${api}/commits?${query}`)) as { sha: string }[];
    const change =
      read === undefined
        ? `absent du commit relevé \`${sha}\``
        : `relevé au commit \`${sha}\`, ${now === undefined ? 'supprimé' : 'modifié'} depuis`;
    // Entre accents graves : GitHub ne fait pas d'un SHA un lien vers son diff, qui montrerait le contenu.
    lines.push(
      `- ${file}, section « ${section} » : \`${path}\` de ${name}, ${change} (dernier commit : \`${last?.sha ?? 'aucun'}\`).`,
    );
  }
  return lines;
};

/** Rapport du contrôle et code de sortie. */
export const checkSources = async (projects: Project[], get: Get) => {
  try {
    const lines = (
      await Promise.all(projects.map((project) => gaps(project, get)))
    ).flat();
    if (lines.length === 0) {
      const count = projects.reduce(
        (sum, { sources }) => sum + sources.length,
        0,
      );
      return {
        code: 0,
        report: `Sources à jour : aucune section à relire sur ${count}.`,
      };
    }
    return {
      code: 1,
      report: [
        `Sections à relire : ${lines.length}.`,
        ...lines,
        'Pour chacune : relis la source au dernier commit, mets à jour le contenu, puis le SHA et la date du relevé (AGENTS.md, pnpm dragon:ecart).',
      ].join('\n'),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      code: 2,
      report: `Contrôle impossible : ${reason}. Aucune source n’est vérifiée.`,
    };
  }
};

/** API GitHub ; le jeton, facultatif en local, évite la limite des requêtes anonymes sur la CI. */
export const github =
  (token: string | undefined): Get =>
  async (path) => {
    const url = `https://api.github.com${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      throw new Error(`api.github.com injoignable (${code ?? String(error)})`, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new Error(`${url} a répondu ${response.status}`);
    }
    return response.json();
  };

if (import.meta.main) {
  const { code, report } = await checkSources(
    projectsOf(await loadProjectContents()),
    github(process.env['GITHUB_TOKEN']),
  );
  (code === 2 ? console.error : console.log)(report);
  process.exitCode = code;
}
