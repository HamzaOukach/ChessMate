# Déploiement de ChessMate en production (ou préproduction) sur une VM Debian

## Aperçu

Ce guide explique **comment déployer** ChessMate sur une VM Debian en **production** (ou préproduction), tout en
respectant les contraintes suivantes :

- Un **utilisateur unique** `chessmate` fait tourner les conteneurs Docker.
- Cet **utilisateur** ne doit **pas** être accessible directement en SSH (pour des raisons de sécurité).
- Les développeurs ou administrateurs se connectent en SSH sous un **autre utilisateur**, puis utilisent leurs droits (
  ou `sudo`) pour gérer le projet.
- Le déploiement peut être **automatisé** via **GitLab Runner** (CI/CD), avec reverse proxy (Traefik) pour le HTTPS.

---

## Pré-requis

### Mettre à jour le système

Avant toute installation, mettez à jour votre système pour garantir l'installation des dernières versions de paquets et
correctifs de sécurité :

```bash
sudo apt update && sudo apt upgrade -y
```

### Installer Docker et Docker Compose

[](installer-docker-et-docker-compose.md)

## Création de l'utilisateur `chessmate`

1. **Créez l’utilisateur** `chessmate` avec un shell restreint :

    ```bash
    sudo adduser --system --home /home/chessmate --shell /usr/sbin/nologin --ingroup docker chessmate
    ```

   > L’option `--ingroup docker` suppose que le groupe `docker` existe déjà (créé par l’installation de Docker). Ainsi,
   `chessmate` pourra lancer des conteneurs Docker sans droits root.

---

## Préparation de l’arborescence du projet

1. **Attribuez les permissions** :

    ```bash
    sudo chown -R chessmate:docker /home/chessmate
    ```

---

## Génération de l'Access Token GitLab pour la production

Avant de générer le token, **connectez-vous en tant qu'utilisateur `chessmate`** pour assurer que les configurations Git
sont appliquées correctement.

### Se connecter à l'utilisateur `chessmate`

1. **Ouvrez une session shell en tant que `chessmate`** :

    ```bash
    sudo -u chessmate -s /bin/bash
    ```

   > L'utilisateur `chessmate` est configuré avec un shell restreint (`/usr/sbin/nologin`). La commande ci-dessus permet
   d'obtenir temporairement un shell interactif pour effectuer les configurations nécessaires.

2. **Placer vous dans le répertoire /home/chessmate**:
   ```bash
   cd /home/chessmate
   ```

### Générez un token d'accès personnel

1. **Connectez-vous** à [Gitlabvigan](https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026/).
2. **Cliquez Settings** en bas à droite, puis sur *Access tokens*.
3. **Nommez votre token** (par exemple, `chessmate-prod`).
4. **Sélectionnez l'expiration souhaitée**.
5. **Cochez la permission suivante** : `read_repository`.
6. **Cliquez sur** *Créer un token* et **copiez immédiatement** la clé affichée.

### Cloner le dépôt en utilisant un token d’accès personnel (PAT)

1. **Clonez le dépôt GitLab** sans inclure le token dans l’URL :

   ```bash
   git config --global http.sslVerify false
   git clone https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026.git /home/chessmate/chessmate
   ```

2. Lorsque Git vous demandera un **nom d’utilisateur**, entrez simplement votre identifiant GitLab.
   Lorsqu’il vous demandera un **mot de passe**, entrez votre **token d’accès personnel** (PAT) à la place.

---

### Configurer Git pour mémoriser le token en toute sécurité

Pour éviter de devoir saisir le token à chaque opération Git (comme `git pull`), vous pouvez configurer Git pour
mémoriser les identifiants en mémoire temporairement :

   ```bash
   git config --global credential.helper cache
   ```

> Par défaut, les identifiants sont mémorisés pendant 15 minutes. Vous pouvez prolonger ce délai (en secondes) :

```bash
git config --global credential.helper 'cache --timeout=3600'
```

Ensuite, effectuez une commande nécessitant une authentification (par exemple un `pull`) :

```bash
git -C /home/chessmate/chessmate pull origin main
```

Une fois votre nom d’utilisateur et le token saisis, Git les conservera temporairement en mémoire pour les prochaines
opérations.

### Remarque

Il est **déconseillé** de stocker le token en clair via `credential.helper store`, car cela l’enregistre sans
chiffrement dans `~/.git-credentials`.
Pour une sécurité optimale, utilisez plutôt :

* `cache` (temporaire, en mémoire)
* ou les outils de gestion de mots de passe du système d’exploitation (Gnome Keyring, macOS Keychain, etc.).

### Générer les certificats de développement (Traefik)

Se placer dans le répertoire `traefik`:

```bash
cd traefik
```

Générer la clé privée RSA :

```bash
openssl genrsa -out private.key 2048
```

Générer le certificat auto-signé (remplacez `docker.localhost` par votre domaine si nécessaire) :

```bash
openssl req -new -x509 -key private.key -out cert.pem -days 365 -subj "/CN=docker.localhost"
```

> **Remarque :** Les navigateurs signaleront un avertissement (connexion non sécurisée) car le certificat n’est pas
> signé par une autorité de confiance. Pour un usage **développement**, cela reste suffisant.

Revenir à la racine du projet :

```bash
cd ..
```

---

### Configuration de l’environnement – fichier `.env`

Le fichier `.env` centralise les variables de configuration du projet (ports, URLs, identifiants, secrets, etc.).

1. Copier le modèle fourni :

   ```bash
   cp .env.example .env
   ```
2. Ouvrir `.env` et adapter **les valeurs** à votre contexte local (domaines, ports, mots de passe, clés d’API…).
3. Conserver `.env` **en local** (ne pas le committer si le repository est public) car il contient des secrets.

> **Note :** Plusieurs services (Traefik, etc.) lisent leurs paramètres depuis ce fichier. Vérifiez que **toutes
** les clés requises sont renseignées avant de démarrer.

---

### Construire les images et lancer les conteneurs

Après avoir rempli le `.env`, build les conteneurs :

```bash
docker compose build
```

Puis lancer le docker compose :

```bash
docker compose -f compose.yml up -d
```

---

### Télécharger les pgn Lichess

Dans le dossier data en attendant que la config pour Minio soit OK (exemple pour le fichier octobre 2025) :

```bash
mkdir -p /home/chessmate/chessmate/data
nohup bash -c 'cd /home/chessmate/chessmate/data && \
                                  wget https://database.lichess.org/standard/lichess_db_standard_rated_2025-10.pgn.zst && \
                                  unzstd lichess_db_standard_rated_2025-10.pgn.zst && \
                                  rm lichess_db_standard_rated_2025-10.pgn.zst' > download.log 2>&1 &

```

### Lancer l'ETL sur le serveur de production ou préproduction

```bash
docker compose -f compose.yml --profile jobs run etl
```

## Voir aussi

- [Documentation Docker officielle](https://docs.docker.com/get-started/)
- [Bonnes pratiques Docker Compose](https://docs.docker.com/compose/best-practices/)
- [Sécurisation des conteneurs Docker](https://docs.docker.com/engine/security/)