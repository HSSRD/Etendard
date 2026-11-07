# 0009. Suivre les tâches dans GitHub Issues avec des formulaires et des étiquettes

- Statut : Proposé
- Date : 2026-11-07

## Contexte

**Choix de Flo** : GitHub Issues est l'unique outil de suivi. Ses événements (ticket ouvert, étiquette, commentaire) déclenchent directement les workflows d'agents (0010).

## Décision

- **Formulaires de ticket** : `.github/ISSUE_TEMPLATE/idee.yml` (un seul champ obligatoire, « Idée ») et `bug.yml` sur le même principe.
- **Format structuré**, rédigé par l'agent rédacteur, l'idée d'origine citée en tête :
  `Objectif` · `Contexte` · `Critères d'acceptation` (numérotés, Étant donné / Quand / Alors, chacun = un test Playwright) · `Hors périmètre` · `Scénarios de démonstration` · `Contraintes` · `Définition de terminé` · `Notes pour l'agent` (repliées).
- **Étiquettes** : `idee` · `a-preciser` · `pret` · `en-cours` · `agent` · `bug` · `bloque` (l'agent explique pourquoi en commentaire et s'arrête).
- Branches nommées `issue-<numéro>-<slug>` ; PR avec `Fixes #<numéro>`.
- GitHub Projects optionnel, alimenté par les étiquettes.

## Alternatives écartées

- **Linear, Jira, Notion** : n'émettent pas d'événements GitHub Actions natifs ; écartés par choix de Flo.

## Conséquences

- Tout l'historique (idée, questions, PR, déploiement) reste dans GitHub.
- Les étiquettes sont la machine à états du workflow : les renommer impose de modifier les workflows.
- Le « Hors périmètre » est le principal garde-fou contre le surplus de code.
