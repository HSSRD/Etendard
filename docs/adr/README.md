# Architecture Decision Records (ADR)

Un ADR consigne une décision d'architecture : son contexte, la décision, les alternatives écartées et ses conséquences.
Une décision par fichier, nommé `NNNN-titre-en-kebab-case.md`, une page maximum.
Un ADR est créé au statut **Proposé** ; seul Flo le passe en **Accepté**.
Un ADR accepté n'est jamais modifié : pour changer d'avis, on écrit un nouvel ADR qui le remplace (statut « Remplacé par NNNN »).
Avant toute modification structurelle, lire les ADR acceptés et ne jamais les contredire.

## Index

| N° | Titre | Statut |
|---|---|---|
| 0001 | [Utiliser Astro 7, TypeScript strict et Vue pour les îles](0001-utiliser-astro-typescript-strict-et-vue-pour-les-iles.md) | Proposé |
| 0002 | [Héberger sur le Raspberry Pi avec Caddy natif et Cloudflare Tunnel, sans Docker](0002-heberger-sur-le-pi-avec-caddy-et-cloudflare-tunnel.md) | Proposé |
| 0003 | [Tester avec Vitest, la Container API et Playwright visuel, sans Storybook](0003-tester-avec-vitest-container-api-et-playwright-sans-storybook.md) | Proposé |
| 0004 | [Écrire le CSS en natif avec des design tokens, BEM et un Stylelint strict](0004-ecrire-le-css-en-natif-avec-tokens-et-bem.md) | Proposé |
| 0005 | [Faire de `pnpm verify` la définition unique de « terminé »](0005-faire-de-pnpm-verify-la-definition-de-termine.md) | Proposé |
| 0006 | [Déployer par GitHub Actions, Tailscale et SSH à commande forcée, avec rollback automatique](0006-deployer-via-tailscale-et-ssh-a-commande-forcee.md) | Proposé |
| 0007 | [Prévisualiser chaque PR sur Cloudflare Pages](0007-previsualiser-les-pr-sur-cloudflare-pages.md) | Proposé |
| 0008 | [Identifier les agents par la GitHub App `hssrd-bot`, sans permission `workflows`](0008-identifier-les-agents-par-une-github-app-sans-permission-workflows.md) | Proposé |
| 0009 | [Suivre les tâches dans GitHub Issues avec des formulaires et des étiquettes](0009-suivre-les-taches-dans-github-issues.md) | Proposé |
| 0010 | [Enchaîner les agents dans GitHub Actions, du ticket au merge humain](0010-enchainer-les-agents-dans-github-actions.md) | Proposé |
| 0011 | [Sécuriser les agents : déclenchement par Flo seul, contenu non fiable, aucun secret de production](0011-securiser-les-agents.md) | Proposé |
| 0012 | [Outiller les agents : AGENTS.md, MCP, hooks, skills et Graphify](0012-outiller-les-agents.md) | Proposé |
| 0013 | [Gérer les dépendances avec pnpm et Renovate, avec merge automatique des mineures](0013-gerer-les-dependances-avec-pnpm-et-renovate.md) | Proposé |
