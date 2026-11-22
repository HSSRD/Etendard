// Contrôle d'écart des pages de projet (ADR 0016, ticket #103) : compare chaque source de
// src/content/projets/ (chemin, SHA relevé) à la dernière version du fichier dans le repo du projet.
// Usage : pnpm dragon:ecart (réseau, donc hors de pnpm verify) ; .github/workflows/dragon-ecart.yml
// le lance chaque semaine et ouvre un ticket quand il sort en 1.
// Sortie : 0 à jour, 1 sections à relire, 2 contrôle impossible.
// Le rapport ne cite que des chemins et des SHA, jamais le contenu du repo source : ses fichiers
// contiennent aussi des données jamais publiées.
import type {
  ProjectMeta,
  ProjectPage,
} from '../src/lib/validate-project-pages.ts';
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
    repo: (meta.data as ProjectMeta).repo,
    sources: pages.flatMap(({ file, data }) =>
      (data as ProjectPage).sections.map(({ id, source }) => ({
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
  const blobs = async (ref: string) => {
    const { truncated, tree } = (await get(
      `${api}/git/trees/${ref}?recursive=1`,
    )) as Tree;
    // Un arbre tronqué ferait passer un fichier absent pour supprimé.
    if (truncated) throw new Error(`arbre de ${repo} au commit ${ref} tronqué`);
    return new Map(tree.map((entry) => [entry.path, entry.sha]));
  };
  const shas = [...new Set(sources.map(({ sha }) => sha))];
  const [latest, ...trees] = await Promise.all(['HEAD', ...shas].map(blobs));
  const atRead = new Map(shas.map((sha, index) => [sha, trees[index]]));
  // Dernier commit de chaque fichier, demandé une fois même s'il est cité par plusieurs sections.
  const commits = new Map<string, Promise<string | undefined>>();
  const lastCommit = (path: string) => {
    const query = new URLSearchParams({ path, per_page: '1' });
    const known =
      commits.get(path) ??
      get(`${api}/commits?${query}`).then(
        (data) => (data as { sha: string }[])[0]?.sha,
      );
    commits.set(path, known);
    return known;
  };
  const lines = await Promise.all(
    sources.map(async ({ file, section, path, sha }) => {
      const read = atRead.get(sha)?.get(path);
      const now = latest?.get(path);
      if (read !== undefined && read === now) return [];
      const last = await lastCommit(path);
      const change =
        read === undefined
          ? `absent du commit relevé \`${sha}\``
          : `relevé au commit \`${sha}\`, ${now === undefined ? 'supprimé' : 'modifié'} depuis`;
      // Entre accents graves : GitHub ne fait pas d'un SHA un lien vers son diff, qui montrerait le contenu.
      return [
        `- ${file}, section « ${section} » : \`${path}\` de ${name}, ${change} (dernier commit : \`${last ?? 'aucun'}\`).`,
      ];
    }),
  );
  return lines.flat();
};

/** Rapport du contrôle et code de sortie. */
export const checkSources = async (
  load: Project[] | Promise<Project[]>,
  get: Get,
) => {
  try {
    // Lu ici : un contenu illisible sort en 2, pas en 1 comme une erreur non rattrapée de Node.
    const projects = await load;
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
        // Lignes vides : en Markdown (ticket du workflow), la phrase suivante resterait dans la liste.
        '',
        ...lines,
        '',
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
    loadProjectContents().then(projectsOf),
    github(process.env['GITHUB_TOKEN']),
  );
  (code === 2 ? console.error : console.log)(report);
  process.exitCode = code;
}
