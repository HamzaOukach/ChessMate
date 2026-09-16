---
switcher-label: OS
---

# Guide d’installation de ChessMate sous Linux

Les instructions d'installation de la plateforme web ChessMate pour l'hébergement sous Linux.

---

## Avant de commencer

Pour installer Docker et Docker Compose, consultez la
page [](installer-docker-et-docker-compose.md).


---

## Étapes d’installation

Cette section détaille la procédure pour installer ChessMate.

---

### Créer un **GitLab Personal Access Token**

1. Ouvrir **GitLab** → **Preferences** → **Access Tokens**.
2. Cliquer sur **Add new token** et choisir un nom explicite.
3. Cocher les permissions :

    * ✅ `api`
    * ✅ `read_registry`
    * ✅ `write_registry`
4. Cliquer sur **Create personal access token** et **copier immédiatement** le token affiché.

> Conservez ce token en sécurité ; il pourra être référencé via le `.env` si nécessaire. Avec Git en HTTPS, il peut
> aussi être demandé comme **mot de passe** lors des opérations `clone/pull/push`.

---

### Cloner le dépôt

> **Note** : le serveur GitLab peut avoir un certificat SSL mal configuré. Deux options :
>
> **Option A – Désactiver globalement (rapide mais non recommandé)**
>
> ```bash
> git config --global http.sslVerify false
> git clone https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026.git
> cd lichess-2025-2026
> ```
>
> **Option B – Désactiver au cas par cas (recommandé)**
>
> ```bash
> git -c http.sslVerify=false clone https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026.git
> cd lichess-2025-2026
> ```
>
> Pensez à réactiver la vérification SSL plus tard si vous avez utilisé l’option A :
>
> ```bash
> git config --global http.sslVerify true
> ```

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

### Générer les certificats de développement (Traefik)

Se placer dans le répertoire `traefik`:

```bash
cd traefik
```

Générer la clé privée RSA:

```bash
openssl genrsa -out private.key 2048
```

Générer le certificat auto-signé (remplacez `docker.localhost` par votre domaine si nécessaire):

```bash
openssl req -new -x509 -key private.key -out cert.pem -days 365 -subj "/CN=docker.localhost"
```

> **Remarque :** Les navigateurs signaleront un avertissement (connexion non sécurisée) car le certificat n’est pas
> signé par une autorité de confiance. Pour un usage **développement**, cela reste suffisant.

---

### Construire les images et lancer les conteneurs

Après avoir rempli le `.env`, construire et lancer :

```bash
docker compose up --build
```

---

## Notes & dépannage (rapide)

* Si `docker ps` échoue sans `sudo`, vérifiez votre appartenance au groupe `docker` et reconnectez votre session.
* En cas d’alerte SSL dans le navigateur, c’est attendu en **dev** avec un certificat auto-signé.
* Assurez-vous que toutes les valeurs sensibles de `.env` sont bien définies avant `docker compose up`.
* Si vous êtes sur windows attention au retour de ligne. Pour bien configurer votre projet, utilisez les commandes
  ci-dessous.
  git config core.autocrlf input
  git rm --cached -r .
  git reset --hard

---