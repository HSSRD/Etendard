# 0016. Publier des pages de projet en copie rédigée et datée de leurs sources

- Statut : Proposé
- Date : 2026-11-21
- Complète : 0015 (routes et contenu)

## Contexte

Le projet Dragon (https://github.com/HSSRD/Dragon, public) a sa place sur le site : une carte sur la one page et des pages dédiées (#96). Sa documentation vit dans son propre repo, en Markdown, et change souvent (statuts, prix, achats). Certains de ses fichiers contiennent des données que le site ne publie jamais. Jusqu'ici, le site n'a qu'une page et des fiches de projet en texte simple (0015). Ce lot pose le socle des pages de projet (#97) ; les lots suivants y ajoutent chacun une page.

## Décision

- **Routes statiques** dans `src/app/projets/<projet>/` : `index.tsx` pour l'accueil du projet (`/projets/dragon`), puis un fichier par sous-page (`/projets/dragon/materiel`, `/achats`, `/decisions`, `/architecture`, plus tard `/journal`). Chaque route est pré-rendue en HTML (0015) et se contente de passer son contenu à `ProjectLayout` (`src/layouts/`). Pas de route générique `[id]` tant qu'un seul projet a des pages.
- **Contenu : copie rédigée et datée.** Chaque page est un fichier TypeScript de `src/content/projets/<projet>/`, à côté de `projet.ts` (titre, statut, repo, liste des sous-pages). Le texte est réécrit et relu, pas recopié. Chaque section porte sa **source** : chemin dans le repo du projet, SHA complet du commit lu et date du relevé. Le build ne lit jamais le repo source : ni réseau, ni sous-module, ni rendu Markdown.
- **Modèle enrichi**, validé par Zod au build (`scripts/check-content.ts`) et dans Vitest (`src/lib/validate-project-pages.ts`) : section (titre, statut facultatif, source, blocs), blocs paragraphe, liste, tableau et liens ; cellule de tableau en texte, statut ou prix. Un statut vient d'une liste fermée. Un **prix** est une fourchette `{ min, max, date }`, affichée « X à Y €, relevé le AAAA-MM-JJ » ; un montant en euros dans un texte libre est refusé. Chaque sous-page de `projet.ts` a son fichier de contenu et sa route, et inversement.
- **Liens vers le repo source** : la racine du repo, et des fichiers à leur SHA (`/blob/<sha>/…`). Jamais vers un fichier qui contient des données exclues (pour Dragon : `bom.md`, `ordre-achat.md`, `commandes/`) : une section qui en vient cite son chemin sans lien. Le modèle le vérifie.
- **Jamais publié** : numéros et références de commande, prix réellement payés, factures, codes promo ; numéro d'exploitant, identifiant de balise, numéro d'enregistrement, lieu de vol, assurance ; contraintes personnelles ; liens d'affiliation ; images de tiers. Un test Vitest parcourt `src/content/` et échoue sur les motifs génériques de ces données (numéro `FRA…`, « commande n° », « n° de commande », « facture », « code promo », paramètres d'affiliation), en nommant le fichier et le motif. Le reste de la liste se vérifie à la relecture.
- **Contrôle d'écart** : un workflow planifié comparera le SHA relevé de chaque source à la dernière version du fichier dans le repo source et ouvrira un ticket en cas d'écart. Il touche `.github/workflows/` : réalisé par le lot 6 (#103), mergé par Flo. La date du relevé reste affichée sur chaque section.

## Alternatives écartées

- **Lire les `.md` du repo source au build** (sous-module ou téléchargement à un SHA figé) : les fichiers publiables contiennent eux-mêmes des données exclues, il faudrait un filtre fragile ; il faudrait aussi une dépendance de rendu Markdown sous React Native et un accès réseau dans le build et la CI.
- **Blocs balisés « publiable » dans le repo source** : suppose de modifier Dragon, hors périmètre.
- **Route générique `/projets/[id]`** : utile seulement quand plusieurs projets auront des pages ; les routes statiques se convertiront alors sans changer d'URL.
- **Prix ponctuels** : un prix seul se périme vite et se confond avec un prix payé.

## Conséquences

- **Zod** reste hors du navigateur et des apps : les routes importent le contenu et ses types, jamais le validateur (0015).
- **CSP** : rien en ligne ; le tableau passe en liste sous la largeur de ses colonnes par une requête de conteneur de la feuille générée (`web-css.ts`), sans `useWindowDimensions`. Sur iOS et Android, le tableau est toujours en liste.
- **Bundle natif** : composants en React Native seul, aucune dépendance ajoutée ; `pnpm build:natif` construit les nouvelles routes.
- **Rendu** : pas de Markdown, donc pas de lien ni de mise en forme dans un paragraphe ; les liens sont des blocs.
- Le contenu se met à jour à la main ; un écart entre le site et le repo source n'apparaît qu'au contrôle planifié (lot 6) ou à la date affichée.
- Le Caddy du Pi doit servir une page sans extension (`/projets/dragon/materiel` → `materiel.html`) : `try_files`, ticket #106, avant la première sous-page.
- Chaque lot ajoute sa route, son fichier de contenu, une ligne dans `projet.ts` et une dans l'index du styleguide s'il crée un composant.
