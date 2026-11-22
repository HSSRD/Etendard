// Valide le contenu avant l'export (première étape de `pnpm build`, ADR 0015 et 0016) :
// une fiche ou une page de projet invalide arrête le build avec la liste des problèmes.
import fiches from '../src/content/projects.ts';
import { validateProjectContent } from '../src/lib/validate-project-pages.ts';
import { validateProjects } from '../src/lib/validate-projects.ts';
import { loadProjectContents } from './project-content.ts';

const errors: string[] = [];
const check = (validate: () => unknown) => {
  try {
    validate();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
};

check(() => validateProjects(fiches));
for (const content of await loadProjectContents()) {
  check(() => validateProjectContent(content));
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
