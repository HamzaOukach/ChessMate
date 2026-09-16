# Configurer le DNS interne

Pour permettre la résolution des noms de domaine internes (chessmate-preprod.fr, etc.), un serveur DNS local est configuré via dnsmasq.

## Installer dnsmasq

```bash
sudo apt update
sudo apt install dnsmasq
```

**Vérifiez l'installation** :

```bash
dnsmasq --version
```

## Créer le fichier de configuration

Créez un fichier de configuration pour l'environnement de préproduction :

```bash
sudo nano /etc/dnsmasq.d/chessmate-preprod.conf
```

Ajoutez le contenu suivant :

```
# Domaine principal
domain=chessmate-preprod.fr

# Résolution des sous-domaines vers l'IP du serveur
address=/chessmate-preprod.fr/172.31.60.32
address=/visu.chessmate-preprod.fr/172.31.60.32

# Serveur DNS de l'université (pour les autres résolutions)
server=172.31.21.35
```

**Explication des paramètres** :

* `domain` : définit le domaine local géré par dnsmasq
* `address` : associe un nom de domaine à une adresse IP. Toutes les requêtes vers ce domaine seront redirigées vers l'IP spécifiée
* `server` : définit le serveur DNS externe à utiliser pour les domaines non gérés localement (ici le DNS de l'université)

## Redémarrer dnsmasq

Après avoir modifié la configuration, redémarrez le service :

```bash
sudo systemctl restart dnsmasq
```

**Vérifiez que le service fonctionne** :

```bash
sudo systemctl status dnsmasq
```

## Tester la résolution DNS

Vérifiez que les domaines sont correctement résolus :

```bash
nslookup visu.chessmate-preprod.fr 127.0.0.1
```

Si la commande retourne l'IP configurée (172.31.60.32), le DNS est opérationnel.