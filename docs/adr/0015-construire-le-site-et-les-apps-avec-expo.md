# 0015. Construire le site et les apps avec Expo et React Native

- Statut : Accepté
- Date : 2026-11-20
- Remplace : 0001, 0004, 0014. Adapte : 0003.

## Contexte

Étendard devient aussi une application iOS et Android : d'abord la vitrine, puis un tableau de suivi avec comptes et notifications (#77, #78). Flo a choisi une **seule base** pour le web et les deux plateformes, plutôt qu'un monorepo Astro + Expo (#76). Le site reste servi en statique par le Pi (0002, 0006).

## Décision

- **Expo SDK 58** (58.0.26), **Expo Router** (58.0.32), **React Native 0.88.1**, **React 19.3.0**, **React Native Web 0.21.4** : dernière version stable, vérifiée le 2026-11-20, après le délai de 3 jours (0013). TypeScript 6.0.x, celui du SDK.
- **Web en rendu statique** (`web.output: "static"`) : `pnpm build` = `scripts/check-content.ts`, `expo export --platform web`, puis `scripts/export-web.js`. Chaque route a son HTML pré-rendu, lisible sans JavaScript ; le JavaScript hydrate ensuite la page.
- **CSP sans `unsafe-inline`** : `scripts/export-web.js` sort en fichiers de `/_expo/static/` les `<style>` et `<script>` qu'Expo écrit dans la page. Les composants n'écrivent aucun attribut `style` : tout style passe par `StyleSheet.create` (ou `themedStyles`), compilé en classes. Le Caddyfile ajoute `script-src 'self'`.
- **Structure** : routes dans `src/app/` (`+html.tsx` : gabarit HTML du web), composants dans `src/components/`, `BaseLayout` dans `src/layouts/` (`.web.tsx` pour le web), utilitaires dans `src/lib/`, thème dans `src/theme/`, contenu dans `src/content/`. Variante d'une plateforme : `X.web.tsx` à côté de `X.tsx`.
- **Styles** (remplace 0004) : tokens TypeScript dans `src/theme/tokens.ts`, seule source des valeurs visuelles ; `StyleSheet` de React Native, aucune valeur en dur (règle ESLint sur `StyleSheet.create` et `themedStyles`). Thème clair et sombre : sur le web, chaque couleur est une variable CSS (`light-dark()`), le thème suit donc `prefers-color-scheme` dès le HTML ; sur iOS et Android, `useColorScheme`. Ce que `StyleSheet` ne sait pas écrire (focus visible, survol, défilement vers les ancres, lien d'évitement) est dans une feuille web générée depuis les tokens (`src/theme/web-css.ts`), accrochée par des attributs `data-*`. Plus de BEM ni de Stylelint.
- **Sémantique** : `role` et `aria-*` de React Native, que React Native Web rend en balises HTML (`role="heading"` + `aria-level` → `<h1>`…, `banner` → `<header>`, `main`, `contentinfo` → `<footer>`, `region` → `<section>`, `article`, `list`/`listitem` → `<ul>`/`<li>`, `paragraph` → `<p>`, lien `href` → `<a>`).
- **Contenu** (remplace 0014) : fiches typées dans `src/content/projects.ts`, validées par **Zod** au build (`scripts/check-content.ts`) et dans Vitest. Zod n'est jamais envoyé au navigateur ni embarqué dans les apps.
- **Tests** (adapte 0003) : inchangés dans leur principe ; les pages `/styleguide` sont rendues par l'export web, servi par `expo serve` pour Playwright. `pnpm verify` (0005) garde le même périmètre, `astro check` devient `tsc`. Il exporte aussi les bundles iOS et Android (`pnpm build:natif`) : une erreur du bundle natif fait échouer la vérification. `expo-doctor` reste hors de `pnpm verify` : il interroge l'API d'Expo.
- **pnpm** avec le `node-linker` par défaut (isolé) : Expo SDK 58 le prend en charge, rien à configurer.

## Alternatives écartées

- **Monorepo Astro (web) + Expo (apps)** : deux piles, deux styles de composants et le contenu à partager ; écarté par Flo.
- **Rendu côté client seul** (`web.output: "single"`) : page vide sans JavaScript, mauvais pour le référencement et le premier affichage.
- **`'unsafe-inline'` ou empreintes dans la CSP** : la première affaiblit la CSP, les secondes changent à chaque build et le Caddyfile ne part pas avec le site.
- **Media queries ou `useWindowDimensions`** pour la mise en page : le HTML pré-rendu ne connaît pas la largeur de la fenêtre. Les deux colonnes de cartes viennent d'un `flexBasis` calculé depuis les tokens.
- **NativeWind (Tailwind)** : ajoute une compilation et une convention de plus, alors que `StyleSheet` suffit à la vitrine.

## Conséquences

- Le site envoie du JavaScript : environ 310 Ko compressés (gzip) sur la one page, dont 294 Ko pour le moteur commun (React, React Native Web, Expo Router), mesuré au 2026-11-20. Sans JavaScript, la page reste complète.
- Les tailles sont en px : la taille de police choisie dans le navigateur n'agrandit plus le texte (le zoom, si).
- Le thème sombre des apps et du web peut diverger : ils ne lisent pas la même source (`useColorScheme`, `prefers-color-scheme`).
- Les captures de référence sont toutes à refaire. Un `<style>` ou un attribut `style` en ligne fait échouer `tests/csp.spec.ts`.
- La publication sur les stores, les builds EAS et les mises à jour OTA (`updates.enabled: false`) arrivent avec #78.
