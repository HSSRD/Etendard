# 0002. Héberger sur le Raspberry Pi avec Caddy natif et Cloudflare Tunnel, sans Docker

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Choix de Flo : héberger chez lui sur son Raspberry Pi, sans cloud payant. Le site est un ensemble de fichiers statiques (0001).

Constat sur le Pi le 2026-11-07 (compte en lecture seule) : Raspberry Pi 4 Model B, 2 Go de RAM, carte SD de 64 Go, Wi-Fi seul (Ethernet débranché), Raspberry Pi OS **avec bureau** sur Debian 12. **Ce Pi héberge déjà Sentry** (`sentry_hub.py`, `servo_controller.py`), dans deux conteneurs Docker exécutés en root. Deux services HTTP écoutent sur toutes les interfaces, ports 5000 (Flask) et 8000 (uvicorn), vraisemblablement ceux de Sentry.

## Décision

- Héberger Étendard sur ce Pi, à côté de Sentry.
- **Caddy installé directement**, sous un utilisateur dédié, écoute uniquement sur `127.0.0.1:8080`. En-têtes : CSP stricte, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Cache d'un an sur `/_astro/*`. Logs JSON avec rotation.
- **Cloudflare Tunnel** (`cloudflared`) pour l'exposition publique, dirigé vers `127.0.0.1:8080` uniquement : aucun port ouvert sur la box.
- Durcissement : SSH par clé uniquement, pare-feu entrant par défaut en refus, mises à jour de sécurité automatiques.
- Configuration du Pi en code : playbook Ansible dans un repo `HSSRD/infra` partagé avec Hussard.
- Surveillance externe (Uptime Kuma sur une autre machine, ou UptimeRobot). Statistiques : Cloudflare Web Analytics (sans cookie).

## Alternatives écartées

- **Docker pour Étendard** : inutile pour servir des fichiers statiques (Docker reste utilisé par Sentry).
- **Ouverture de ports sur la box** : expose le réseau domestique.
- **Plausible / Umami auto-hébergés** : base de données à maintenir. **Google Analytics** : cookies.

## Conséquences

- Aucun coût d'hébergement ; disponibilité liée au Pi, au Wi-Fi, à la box et au courant.
- TLS terminé chez Cloudflare, qui voit le trafic en clair.
- Étendard ajoute peu de charge (pas de build sur le Pi, Node absent et inutile).
- Le déploiement est décrit en 0006.

## Points de vigilance

- **Service public sur la machine de Sentry** (risque concret sur un choix de Flo) : l'idée initiale de « VLAN entre le serveur et les caméras » ne s'applique plus, puisque c'est la même machine. Un défaut dans Caddy ou `cloudflared` donnerait un point d'appui sur l'hôte de Sentry. Le risque reste faible pour un site statique derrière un tunnel, à condition d'isoler Caddy (utilisateur sans droits) et de fermer les ports de Sentry au réseau. L'autre option est un appareil dédié à Étendard (question à Flo).
- **État actuel du Pi, constaté** :
  - SSH accepte encore les mots de passe ;
  - aucune mise à jour automatique n'est installée ;
  - aucun pare-feu de type `ufw` ; les règles `nftables` sont illisibles sans root ;
  - le port 5000 est servi sur toutes les interfaces par le serveur de développement de Flask (Werkzeug), non prévu pour la production ;
  - VNC (RealVNC et wayvnc), l'impression, le Bluetooth et la découverte réseau (Avahi) sont installés.

  Rien de cela ne vient d'Étendard, mais ces points sont à corriger avant d'exposer le Pi.
- **Debian 12 n'est plus en support complet** depuis le 2026-07-11 ; il reste en LTS jusqu'au 2028-06-30 (debian.org). Une réinstallation (OS Lite récent, démarrage sur SSD, Ethernet, playbook Ansible) réglerait d'un coup l'OS, l'usure de la carte SD et la surface d'attaque du bureau.
- **CSP stricte et Astro** : Astro produit des scripts et styles en ligne (hydratation des îles). Une CSP fixe dans Caddy sans `unsafe-inline` les bloquerait. L'option `security.csp` d'Astro (stable depuis la 6.0) calcule des hashes au build. À articuler au scaffolding avec les en-têtes Caddy et le script de Cloudflare Web Analytics.
