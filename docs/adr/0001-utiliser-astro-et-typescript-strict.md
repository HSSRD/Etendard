# 0001. Utiliser Astro 7 et TypeScript strict, Vue seulement à la première île

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Étendard est une vitrine statique des projets IoT de HSSRD, développée presque entièrement par des agents IA. Il faut un framework qui envoie peu de JavaScript, valide le contenu au build, dispose d'une communauté et d'une documentation solides, et dont la syntaxe est stable pour les agents. Flo a choisi Vue pour l'interactivité. Aucune île n'est prévue à ce jour.

## Décision

- **Astro 7** (7.4.7), sortie 100 % statique. Contenu en collections validées par Zod (0014).
- **Îles en Vue** (choix de Flo), dans `src/islands/`. **`@astrojs/vue` et l'outillage Vue (`vue-tsc`, `@vue/test-utils`, `eslint-plugin-vue`) ne sont installés qu'avec la première île**, dans le ticket qui la demande.
- **TypeScript 6.0.x strict** : `astro/tsconfigs/strictest` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, alias `@/*`.
- **Node.js 26 LTS**, figé par `.nvmrc` et `engines`.
- Les agents consultent la doc via le serveur MCP officiel d'Astro (0012).

## Alternatives écartées

- **Vue + vite-ssg** : peu utilisé (~49 k téléchargements/sem.), envoie du JS inutile.
- **Nuxt** : les imports automatiques masquent l'origine du code aux agents.
- **Next.js** : surdimensionné ; deux routeurs coexistent, les agents mélangent les syntaxes.
- **SvelteKit** : la syntaxe Svelte 5 diffère de Svelte 4, que les agents produisent souvent.
- **Hugo** : templates Go peu lisibles, erreurs pauvres.
- **Installer Vue dès le départ** : outillage sans aucun composant à servir, contraire à la règle « pas de surplus ».
- **TypeScript 7** : `@astrojs/check` 0.9.12 déclare `typescript: ^5 || ^6` et `typescript-eslint` 8.72.1 `<6.1.0` (vérifié le 2026-11-07).
- **Node 24** : en maintenance depuis le 2026-10-20 ; Node 26 est LTS active depuis le 2026-10-28 et accepté par Astro (`>=22.23.4`), Vitest, dependency-cruiser et `eslint-plugin-astro`.
- **Bun, Deno** : moins éprouvés avec cet écosystème.

## Conséquences

- Zéro JS par défaut ; tout JS envoyé au navigateur est visible dans `src/islands/`.
- La première île porte le coût d'installation de Vue ; son ticket doit le prévoir.
- À rouvrir pour TypeScript 7 quand `@astrojs/check` et `typescript-eslint` l'accepteront. `vue-tsc` dépend de l'API JS de TypeScript ; sa compatibilité avec TS 7 sera à vérifier à ce moment.
- À réévaluer si Étendard devient une application interactive (ex. tableau de bord des objets).
