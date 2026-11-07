# 0001. Utiliser Astro 7, TypeScript strict et Vue pour les îles

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Étendard est une vitrine statique des projets IoT de HSSRD, développée presque entièrement par des agents IA. Il faut un framework qui envoie peu de JavaScript, valide le contenu au build, dispose d'une communauté et d'une documentation solides, et dont la syntaxe est stable pour les agents. Flo souhaitait Vue.

## Décision

- **Astro 7** (7.4.7), sortie 100 % statique. Interactivité uniquement par îles (`client:visible`, `client:load`), écrites en **Vue** (`@astrojs/vue`) et rangées dans `src/islands/`.
- Contenu en collections Astro validées par des schémas **Zod** : une fiche invalide fait échouer le build.
- **TypeScript strict** : `astro/tsconfigs/strictest` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, alias `@/*`.
- **TypeScript 6.0.x**, pas 7.x (voir Points de vigilance).
- **Node.js LTS** figé par `.nvmrc` et `engines` (version à trancher, voir Points de vigilance).
- Les agents consultent la doc via le serveur MCP officiel d'Astro (voir 0012).

## Alternatives écartées

- **Vue + vite-ssg** : peu utilisé (~49 k téléchargements/sem.), envoie du JS inutile.
- **Nuxt** : les imports automatiques masquent l'origine du code aux agents.
- **Next.js** : surdimensionné ; deux routeurs coexistent, les agents mélangent les syntaxes.
- **SvelteKit** : la syntaxe Svelte 5 diffère de Svelte 4, que les agents produisent souvent.
- **Hugo** : templates Go peu lisibles, erreurs pauvres.
- **TypeScript 7** : incompatible avec l'outillage à date.
- **Bun, Deno** : moins éprouvés avec cet écosystème.

## Conséquences

- Zéro JS par défaut ; tout JS envoyé au navigateur est visible dans `src/islands/`.
- L'outillage Vue (`vue-tsc`, `@vue/test-utils`) s'ajoute à celui d'Astro.
- À réévaluer si Étendard devient une application interactive (ex. tableau de bord des objets).

## Points de vigilance

- **TypeScript 7 exclu, vérifié** : `@astrojs/check` 0.9.12 déclare `typescript: ^5.0.0 || ^6.0.0` et `typescript-eslint` 8.72.1 déclare `typescript: >=4.8.4 <6.1.0`. La dernière 6.x est 6.0.3. `vue-tsc` 3.3.14 accepte `>=5.0.0` mais repose sur l'API JS de TypeScript via `@volar/typescript` ; sa compatibilité réelle avec TS 7 n'est pas établie. À rouvrir quand `@astrojs/check` et `typescript-eslint` élargiront leurs `peerDependencies`.
- **Node 24 n'est plus la LTS active** : d'après le calendrier officiel, Node 24 est en maintenance depuis le 2026-10-20 (fin de vie 2028-04-30) et Node 26 est LTS active depuis le 2026-10-28. Astro (`>=22.23.4`), Vitest, dependency-cruiser et `eslint-plugin-astro` acceptent Node 26 d'après leurs `engines`. Node 26 donnerait 12 mois de support en plus ; un essai de build complet le confirmerait.
