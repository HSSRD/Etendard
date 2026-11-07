# 0012. Outiller les agents : AGENTS.md, MCP, hooks, skills et Graphify

- Statut : Proposé
- Date : 2026-11-07

## Contexte

L'architecture doit permettre à un agent de travailler, se vérifier et livrer seul (exigence de Flo, qui cite Graphify en exemple). Les mêmes règles doivent s'appliquer en local et dans Actions.

## Décision

- **`AGENTS.md`** racine, source unique (< 150 lignes, à l'impératif : stack, commandes, interdits, définition de terminé). **`CLAUDE.md`** ne contient que `@AGENTS.md`. `AGENTS.md` locaux dans `src/components/` et `src/content/`. Règle incluse : « Lis `docs/adr/` avant toute modification structurelle. Ne contredis jamais un ADR accepté : propose un nouvel ADR. »
- **`.mcp.json`** committé : doc Astro (MCP officiel), Playwright MCP, Context7. GitHub via `gh`.
- **Hooks Claude Code** (`.claude/settings.json`), actifs en local et dans Actions :
  - PostToolUse : Prettier + lint du fichier modifié ;
  - Stop : `pnpm verify:fast`, l'agent ne peut pas finir si c'est rouge ;
  - PreToolUse : interdit de modifier les captures de référence, les ADR acceptés et `.github/workflows/`.
- **Skills** (`.claude/skills/`) : `/ticket`, `/livrer`, `/nouveau-composant`, `/nouveau-projet`, `/adr`, `/verifier-visuel`. **Agent relecteur** : `.claude/agents/relecteur.md` (0010).
- **Graphify** (paquet PyPI `graphifyy`) : graphe de connaissances du code, local. `GRAPH_REPORT.md` committé, `graph.json` ignoré. Installé par `uv tool install graphifyy`. Jamais requis pour le build ni la CI.

## Alternatives écartées

- **Instructions dupliquées par outil** (`CLAUDE.md` complet, `.cursorrules`…) : divergent avec le temps.
- **Base vectorielle / RAG sur le code** : infrastructure à maintenir pour un petit repo.

## Conséquences

- Les règles sont appliquées mécaniquement (hooks), pas seulement écrites.
- Python (`uv`) s'ajoute aux outils de développement, pas à la chaîne de build.
- Graphify apporte peu sur Étendard seul ; son intérêt est le graphe couvrant Étendard, Hussard, Overwatch et Sentry pour rédiger des fiches exactes.

## Points de vigilance

- **Graphify et `.astro` / `.vue`, vérifié dans le code source** (`graphifyy` 0.9.103, ~144 k étoiles, actif) : aucune grammaire tree-sitter dédiée. Les `.vue` sont bien gérés (le `<script>` est extrait et analysé avec la grammaire TypeScript). Les `.astro` ne le sont que partiellement : une passe par expressions régulières récupère les imports du frontmatter et des `<script>`, mais pas l'usage des composants dans le template. Le graphe d'Étendard sera donc incomplet sur les relations entre composants Astro.
- **`GRAPH_REPORT.md` committé** : régénéré à la main, il se périme vite et peut induire les agents en erreur. Le régénérer dans un hook ou ne pas le committer.
