// Valide le contenu avant l'export (première étape de `pnpm build`, ADR 0015) :
// une fiche invalide arrête le build avec la liste des problèmes.
import fiches from '../src/content/projects.ts';
import { validateProjects } from '../src/lib/validate-projects.ts';

try {
  validateProjects(fiches);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
