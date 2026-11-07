# 0012. Outiller les agents : AGENTS.md, MCP, hooks et skills ; Graphify repoussé

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
- **Graphify n'est pas installé pour l'instant.** Il sera réexaminé par un nouvel ADR quand il faudra rédiger des fiches à partir du code de Hussard, Overwatch et Sentry.

## Alternatives écartées

- **Instructions dupliquées par outil** (`CLAUDE.md` complet, `.cursorrules`…) : divergent avec le temps.
- **Graphify dès le départ** : vérifié dans son code source (`graphifyy` 0.9.103), il lit les `.vue` mais ne récupère des `.astro` que les imports, pas l'usage des composants dans les templates. Sur un petit repo surtout fait de `.astro`, il apporte peu, ajoute Python (`uv`) aux outils et un `GRAPH_REPORT.md` qui se périme s'il n'est pas régénéré.
- **Base vectorielle / RAG sur le code** : infrastructure à maintenir pour un petit repo.

## Conséquences

- Les règles sont appliquées mécaniquement (hooks), pas seulement écrites.
- Chaîne d'outils 100 % Node : rien à installer en dehors de pnpm.
- La structure du code est décrite par `AGENTS.md`, les ADR et les règles dependency-cruiser (0005), qui servent de carte aux agents.
- Graphify reste le candidat naturel pour un graphe couvrant toute l'organisation HSSRD.
