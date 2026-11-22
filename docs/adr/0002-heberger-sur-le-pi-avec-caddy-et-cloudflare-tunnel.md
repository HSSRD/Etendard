# 0002. Héberger sur le Raspberry Pi avec Caddy natif et Cloudflare Tunnel, sans Docker

- Statut : Proposé, adapté par [0015](0015-construire-le-site-et-les-apps-avec-expo.md) (cache sur `/_expo/static/*` et `script-src 'self'`) et par [0017](0017-durcir-le-serveur-avant-la-mise-en-ligne.md) (mise en ligne sur un serveur durci, configuration dans `infra/pi/`)
- Date : 2026-11-07

## Contexte

Choix de Flo : héberger chez lui sur son Raspberry Pi, sans cloud payant. Le site est un ensemble de fichiers statiques (0001, puis 0015).

**Ce Pi héberge déjà d'autres services.** Son état constaté n'est pas décrit ici : le repo est public (0017).

## Décision

- Héberger Étendard sur ce Pi. Flo prévoit de déplacer les autres services sur un autre appareil : le Pi sera alors dédié à Étendard. La mise en ligne publique précède ce déménagement, sur un serveur durci (0017).
- Après le déménagement, réinstaller le Pi : Raspberry Pi OS Lite 64 bits sur un nouveau support (SSD de préférence), préparé avec Raspberry Pi Imager (utilisateur, clé SSH, connexion par mot de passe désactivée). L'ancien support est conservé comme retour arrière. Date laissée à Flo.
- **Caddy installé directement**, sous un utilisateur dédié, écoute uniquement sur `127.0.0.1:8080`. En-têtes : CSP stricte, `nosniff`, `Referrer-Policy`, `Permissions-Policy` ; HSTS posé par Cloudflare, où se termine le HTTPS (#25). Cache d'un an sur `/_expo/static/*` (`/_astro/*` avant 0015) ; pages HTML revalidées à chaque visite (`no-cache`) et `version.txt` jamais en cache (`no-store`, #52). Logs JSON avec rotation.
- **Cloudflare Tunnel** (`cloudflared`) pour l'exposition publique, dirigé vers `127.0.0.1:8080` uniquement : aucun port ouvert sur la box.
- Durcissement : SSH par clé uniquement, pare-feu entrant par défaut en refus, mises à jour de sécurité automatiques (détaillé par 0017).
- Configuration du Pi en code, dans `infra/pi/` (0017 ; un playbook Ansible dans un repo `HSSRD/infra` était prévu).
- Surveillance externe (Uptime Kuma sur une autre machine, ou UptimeRobot). Statistiques : Cloudflare Web Analytics (sans cookie).

## Alternatives écartées

- **Docker pour Étendard** : inutile pour servir des fichiers statiques.
- **Ouverture de ports sur la box** : expose le réseau domestique.
- **Plausible / Umami auto-hébergés** : base de données à maintenir. **Google Analytics** : cookies.

## Conséquences

- Aucun coût d'hébergement ; disponibilité liée au Pi, au réseau local, à la box et au courant.
- TLS terminé chez Cloudflare, qui voit le trafic en clair.
- Étendard ajoute peu de charge (pas de build sur le Pi, Node absent et inutile).
- Le déploiement est décrit en 0006.

## Points de vigilance

- **Service public sur la machine des autres services, tant qu'ils n'ont pas déménagé** : un défaut dans Caddy ou `cloudflared` donnerait un point d'appui sur leur hôte. Risque réduit par le durcissement de 0017, levé par le déménagement prévu par Flo.
- **La réinstallation prévue** règle aussi le système, l'usure du support et la surface d'attaque des logiciels inutiles.
- **CSP stricte** : CSP fixe dans le `Caddyfile`, sans hash ni `unsafe-inline` (`script-src 'self'`, `style-src 'self'`). Expo écrit des `<style>` et `<script>` dans la page : `scripts/export-web.js` les sort en fichiers de `/_expo/static/` (0015). À revoir avec le script de Cloudflare Web Analytics.
  - Historique (#25, avec Astro) : le site n'envoyait aucun script et Astro écrivait son CSS en fichiers (`inlineStylesheets: 'never'`). L'option `security.csp` d'Astro, qui calcule des hashes au build, avait été écartée.
