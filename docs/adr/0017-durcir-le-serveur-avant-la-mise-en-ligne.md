# 0017. Durcir le serveur et le mettre en ligne avant le départ des autres services

- Statut : Proposé
- Date : 2026-11-22

## Contexte

0002 conditionnait la mise en ligne publique au départ des autres services hébergés sur le Pi, puis à sa réinstallation. Le 2026-11-21, Flo a choisi de **mettre en ligne avant**, sur un serveur durci ; le départ des autres services et la réinstallation viendront plus tard (#113).

Le site est exposé par Cloudflare Tunnel (0002) : aucun port n'est ouvert vers Internet, et le tunnel ne transmet qu'au serveur web local. Le risque à réduire est donc surtout celui d'une faille dans le serveur web ou le tunnel, puis d'une élévation de privilèges sur la machine.

Le repo est public : il décrit l'état visé du serveur, jamais son état constaté.

## Décision

État visé, appliqué par `infra/pi/install.sh` (idempotent, lancé par Flo en root) et contrôlé par `infra/pi/verify.sh pi` :

- **Mises à jour automatiques** des correctifs de sécurité du système, du noyau en cours et de son firmware, et des logiciels exposés (Caddy, Tailscale ; `cloudflared` avec le tunnel). Pas de redémarrage automatique : `verify.sh pi` signale celui qui est en attente.
- **Serveur web isolé** par une surcharge systemd, jamais par l'unité du paquet : aucun nouveau privilège, système en lecture seule sauf ses dossiers d'écriture, ni dossiers personnels ni périphériques, familles d'adresses et appels système restreints, aucune capacité root. Le tunnel recevra la même isolation.
- **Pare-feu d'entrée** refusant tout par défaut : n'entrent que SSH et les ports des services existants, depuis le réseau local et le tailnet, plus le trafic local et les réponses aux connexions établies. Il vit dans sa propre table, chargée avant le réseau : les services qui réécrivent leurs règles ne l'effacent pas et ne peuvent pas l'outrepasser. Un port redirigé avant la chaîne d'entrée, qui échapperait au filtre, arrête l'installation.
- **SSH par clé uniquement**, connexion root refusée. Le script s'arrête si aucune clé n'est autorisée pour le compte d'administration.
- **Rien d'inutile** : démarrage sans environnement graphique, services inutiles masqués.
- Les valeurs propres au serveur (ports des services existants, services à désactiver, dépôts à exclure des mises à jour) sont lues dans un fichier local, hors du repo. La sortie de `verify.sh pi` ne contient ni adresse, ni nom de machine, ni port, ni liste de logiciels.
- **La configuration du serveur vit dans `infra/pi/`**, à côté du site qu'elle sert, et non dans un playbook Ansible d'un repo `HSSRD/infra` (0002) : un seul serveur, des scripts testés par `pnpm test:infra` et relus avec le code.

## Alternatives écartées

- **Attendre le départ des autres services** (0002) : repousse la mise en ligne sans date.
- **`ufw` ou `nftables.service`** : leur rechargement efface les règles des autres services, ou les leurs sont effacées par ceux-ci.
- **Redémarrage automatique après une mise à jour du noyau** : couperait le site et les services existants à une heure non choisie.
- **Ansible** : un outil et un inventaire de plus pour une seule machine.

## Conséquences

- Flo applique `install.sh` après chaque modification de `infra/pi/` (#69 pour l'automatiser) et redémarre le Pi quand `verify.sh pi` le demande.
- Un service existant n'est joignable que par les ports déclarés dans le fichier local ; un changement de réseau local demande de relancer `install.sh`.

## Risque restant

- **Le site partage la machine des autres services**, avec leurs propres faiblesses : une faille du serveur web ou du tunnel qui franchirait l'isolation y donnerait un point d'appui. Levé par leur départ et la réinstallation prévus par 0002.
- **Le noyau n'est à jour qu'après un redémarrage**, laissé à Flo.
- **SSH et les services existants restent joignables depuis le réseau local et le tailnet** (choix de Flo) : un appareil compromis de l'un ou de l'autre peut les atteindre.
- **Le pare-feu ne protège que l'entrée** : un service compromis peut encore se connecter vers l'extérieur.
