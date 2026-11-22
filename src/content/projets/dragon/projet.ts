// Projet Dragon (ADR 0016) : fiche et navigation de ses pages. Une sous-page ajoute ici sa ligne,
// son fichier de contenu à côté et sa route dans src/app/projets/dragon/.
import type { ProjectMeta } from '../../../lib/validate-project-pages';

export default {
  id: 'dragon',
  title: 'Dragon',
  status: 'en-cours',
  repo: 'https://github.com/HSSRD/Dragon',
  pages: [
    { slug: '', label: 'Présentation' },
    { slug: 'materiel', label: 'Matériel' },
    { slug: 'decisions', label: 'Décisions' },
    { slug: 'achats', label: 'Achats' },
    { slug: 'architecture', label: 'Architecture' },
  ],
} satisfies ProjectMeta;
