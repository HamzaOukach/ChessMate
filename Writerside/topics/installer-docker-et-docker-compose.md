# Installer Docker et Docker Compose

Pour installer Docker et Docker Compose, suivez les instructions officielles :

* [Installation de Docker](https://docs.docker.com/engine/install/)
* [Installation de Docker Compose sur Linux](https://docs.docker.com/compose/install/linux/)

**Vérifiez l'installation** :

```bash
docker --version
docker compose version
```

## Ajouter l'utilisateur au groupe `docker`

Pour exécuter les commandes Docker sans utiliser `sudo` à chaque fois :

```bash
sudo usermod -aG docker $USER
```

Ensuite, **déconnectez-vous et reconnectez-vous** (ou redémarrez votre machine) pour que la modification prenne effet.

**Vérifiez que ça fonctionne** :

```bash
docker ps
```

Si la commande s’exécute sans erreur, vous êtes bien dans le groupe `docker`.