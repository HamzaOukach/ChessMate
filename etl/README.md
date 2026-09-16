# Démarrage d'un projet Spring Boot en local

---

Le squelette du projet est récupéré depuis le **Spring Boot Initializr** avec la configuration suivante :

- Project `Maven`
- Language `Java`
- Spring Boot `3.5.6`
- Project Metadata ...
- Packaging `Jar`
- Java `21`
- Dependencies :
  
  - Spring Web

👉 *Si le projet est déjà créé et initialisé, se rendre à l'**étape 3** directement.*

### 1. Générer le projet
### 2. Extraire le projet
### 3. Ouvrir une invite de commande à la racine du projet `.../demo/`
### 4. Compiler le projet et exécuter le serveur web
```bash
./mvnw spring-boot:run
```
Il est possible de l'exécuter en silance avec le flag `--quiet` à la fin
```bash
./mvnw spring-boot:run --quiet
```
### 5. Tester le bon fonctionnement du serveur
Se rendre à l'adresse web [http://localhost:8080/greeting](http://localhost:8080/greeting) pour voir afficher la réponse de l'API.