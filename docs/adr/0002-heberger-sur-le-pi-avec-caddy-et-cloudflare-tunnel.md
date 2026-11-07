# 0002. Héberger sur le Raspberry Pi avec Caddy natif et Cloudflare Tunnel, sans Docker

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Choix de Flo : héberger chez lui sur un Raspberry Pi, sans cloud payant. Le réseau domestique héberge les caméras de Hussard : l'exposition du Pi doit être minimale. Le site est un ensemble de fichiers statiques (0001).

## Décision

- Raspberry Pi (5, un 4 suffit), démarrage sur SSD, Raspberry Pi OS Lite 64 bits.
- **Caddy installé directement**, écoute uniquement sur `127.0.0.1:8080`. En-têtes : CSP stricte, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Cache d'un an sur `/_astro/*`. Logs JSON.
- **Cloudflare Tunnel** (`cloudflared`) pour l'exposition publique : aucun port ouvert sur la box.
- Durcissement : SSH par clé uniquement, `ufw` (tout entrant refusé), `unattended-upgrades`, utilisateur dédié sans privilèges, idéalement VLAN séparant le Pi des caméras.
- Configuration du Pi en code : playbook Ansible dans un repo `HSSRD/infra` partagé avec Hussard.
- Surveillance externe (Uptime Kuma sur une autre machine, ou UptimeRobot). Statistiques : Cloudflare Web Analytics (sans cookie).

## Alternatives écartées

- **Docker sur le Pi** : inutile pour servir des fichiers statiques.
- **Ouverture de ports sur la box** : expose le réseau des caméras.
- **Plausible / Umami auto-hébergés** : base de données à maintenir. **Google Analytics** : cookies.

## Conséquences

- Aucun coût d'hébergement ; disponibilité liée au Pi, à la box et au courant.
- TLS terminé chez Cloudflare, qui voit le trafic en clair.
- Reconstruction du Pi en quelques minutes si le playbook est tenu à jour ; le contenu reste dans Git.
- Le déploiement est décrit en 0006.

## Points de vigilance

- **CSP stricte et Astro** : Astro produit des scripts et styles en ligne (hydratation des îles notamment). Une CSP fixe dans Caddy sans `unsafe-inline` les bloquerait. Astro propose `security.csp` (stable depuis Astro 6.0, d'après sa doc) qui calcule des hashes au build. À vérifier au scaffolding : sous quelle forme ces hashes sont émis en sortie statique, et comment les combiner avec les en-têtes Caddy et le script de Cloudflare Web Analytics.
