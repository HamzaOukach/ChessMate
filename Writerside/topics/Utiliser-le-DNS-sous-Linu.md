# Configurer le DNS client sur Linux

Pour utiliser le serveur DNS interne de ChessMate (172.31.60.32) sur votre machine Linux, plusieurs méthodes sont disponibles selon votre distribution.

## Méthode 1 : Via NetworkManager (recommandée)

Cette méthode est la plus courante sur les distributions desktop (Ubuntu, Fedora, Debian avec interface graphique).

### Identifier votre connexion

```bash
nmcli con show
```

Notez le nom de votre connexion active (ex: "Wired connection 1", "Wi-Fi", etc.).

### Configurer le DNS

```bash
# Remplacez "Nom-de-ta-connexion" par le nom de votre connexion
nmcli con mod "Nom-de-ta-connexion" ipv4.dns "172.31.60.32"
nmcli con mod "Nom-de-ta-connexion" ipv4.ignore-auto-dns yes
```

### Appliquer les changements

```bash
nmcli con down "Nom-de-ta-connexion" && nmcli con up "Nom-de-ta-connexion"
```

## Méthode 2 : Via systemd-resolved

Cette méthode est utilisée sur les distributions récentes utilisant systemd (Ubuntu 18.04+, Fedora, Arch Linux).

### Modifier la configuration

```bash
sudo nano /etc/systemd/resolved.conf
```

Ajoutez ou modifiez la section `[Resolve]` :

```ini
[Resolve]
DNS=172.31.60.32
```

### Redémarrer le service

```bash
sudo systemctl restart systemd-resolved
```

## Vérification

Pour confirmer que le DNS est correctement configuré :

```bash
# Afficher le contenu de resolv.conf
cat /etc/resolv.conf

# Ou avec systemd-resolved
resolvectl status
```

### Tester la résolution

```bash
# Test avec nslookup
nslookup chessmate-preprod.fr

# Test avec dig
dig chessmate-preprod.fr

# Test avec ping
ping chessmate-preprod.fr
```

Si la résolution retourne l'IP 172.31.60.32, la configuration est opérationnelle.

## Dépannage

Si la résolution ne fonctionne pas :

1. Vérifiez que vous êtes bien connecté au réseau de l'université
2. Assurez-vous que le serveur DNS (172.31.60.32) est accessible : `ping 172.31.60.32`
3. Vérifiez qu'aucun autre service ne bloque la configuration DNS (ex: VPN)