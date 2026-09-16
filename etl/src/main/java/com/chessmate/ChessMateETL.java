package com.chessmate;

import java.io.*;
import java.sql.*;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.time.*;

public class ChessMateETL {
    /*
        hashmap pour stocker les ouvertures et cadences au début
    */
    static Map<String, Integer> cadences = new HashMap<>();
    static Map<String, Integer> ouvertures = new HashMap<>();


    /**
     * Point d'entrée principal du programme ETL ChessMate.
     *
     * Cette méthode orchestre tout le processus d'importation des fichiers PGN :
     * - Connexion à la base PostgreSQL à partir des variables du fichier .env
     * - Préchargement des caches d'ouvertures et de cadences
     * - Lecture et parsing des fichiers PGN dans le dossier ../data
     * - Application de filtres de cohérence (ELO, résultat, etc.)
     * - Accumulation des parties valides en mémoire
     * - Insertion en base par lots à l'aide des commandes COPY
     *
     * Affiche un résumé final avec le nombre total de parties insérées,
     * celles ignorées et la durée totale d'exécution.
     *
     * @param args non utilisé
     * @throws Exception si une erreur survient lors du chargement, du parsing ou de l'insertion
     */
    public static void main(String[] args) throws Exception {
        //début du chronomètre
        Instant start = Instant.now();

        //connexion à la base
        Connection connection = DriverManager.getConnection(
                System.getenv("SPRING_DATASOURCE_URL"),
                System.getenv("SPRING_DATASOURCE_USERNAME"),
                System.getenv("SPRING_DATASOURCE_PASSWORD")
        );

        connection.setAutoCommit(false); // on commit nous même, pas de commit auto

        //remplissage des hashmap ouverture et cadence
        remplissageCache(connection);

        //initialisation de la taille des batch (insertion par batch_size)
        final int BATCH_SIZE = 100000;

        //pour stockage des parties avant insertion
        ETLData data = new ETLData();

        //lecture du fichier pgn
        BufferedReader reader = null;
        // On traite tous les fichiers qui sont dans le dossier data.
        java.io.File dir = new java.io.File("../data");
        java.io.File[] pgnFiles = dir.listFiles((d, name) ->
                name != null && name.toLowerCase().endsWith(".pgn"));
        if (pgnFiles == null || pgnFiles.length == 0) {
            System.err.println("Aucun fichier .pgn trouvé dans " + dir.getAbsolutePath());
            connection.close();
            return;
        }

        java.util.Arrays.sort(pgnFiles, java.util.Comparator
                .comparing(java.io.File::getName));


        //déclaration variables utiles pour la boucle principale
        int totalGames = 0;
        int skippedGames = 0;
        /**
         * Parcourt et traite l'ensemble des fichiers PGN du dossier source.
         *
         * Pour chaque fichier trouvé, le contenu est lu ligne par ligne afin
         * d'identifier successivement :
         * - les métadonnées des parties (balises entre crochets) ;
         * - la séquence de coups (lignes sans crochets) ;
         * - la fin de chaque partie (ligne vide).
         *
         * À chaque fin de partie, la méthode vérifie la validité des données :
         * présence des joueurs, cadence et ouverture connues, ELO corrects,
         * séquence de coups non vide, et résultat défini.
         *
         * Les parties valides sont stockées temporairement dans la mémoire
         * (via l'objet ETLData) jusqu'à atteindre la taille de lot fixée
         * par BATCH_SIZE. À ce seuil, les données sont insérées dans la
         * base PostgreSQL à l'aide de la méthode insertBatch.
         *
         * À la fin du parcours, le dernier lot restant est inséré, la
         * transaction est validée, et un résumé global affiche le nombre
         * total de parties insérées, celles ignorées et la durée totale.
         */
        for (java.io.File pgnFile : pgnFiles) {
            try {
                System.out.println("Lecture du fichier: " + pgnFile.getName());
                reader = new BufferedReader(new FileReader(pgnFile));
            } catch (IOException e) {
                System.err.println("Erreur lors de l'accès ou de la lecture du fichier : " + pgnFile.getAbsolutePath());
                e.printStackTrace();
                continue; // on passe au fichier suivant
            }

            // on repart sur une nouvelle game pour chaque fichier
            String ligne;
            Game gameActuelle = new Game();

            while ((ligne = reader.readLine()) != null) {

                if (ligne.startsWith("[")) { //chaque ligne commence par un "[" et se termine par un "]"
                    parseMetadata(ligne, gameActuelle); //parse les metadatas genre white, black, date etc

                    //sinon si la ligne commence pas par "[", ça sera la liste des coups joués
                } else if (!ligne.trim().isEmpty()) {
                    gameActuelle.moves.append(ligne).append("\n"); // stock les coups

                    //vérification si partie terminée->next partie (ligne vide, mais joueur white toujours stocké par ex)
                } else if (gameActuelle.white != null) {
                    Integer idCadence = getIdCadence(gameActuelle.timeControl);
                    Integer idOuverture = getIdOuverture(gameActuelle.eco, gameActuelle.opening);

                    //filtres - vérif si pgn non vide, et la game passe nos filtres (elo ..)
                    boolean okMoves = gameActuelle.moves != null &&
                            gameActuelle.moves.toString().trim().length() > 0;
                    boolean okFilter = filter(gameActuelle);

                    //si partie correcte, l'ajouter à la liste de parties à copier
                    if (okMoves && okFilter && idCadence != null && idOuverture != null) {
                        accumulerPartie(data, gameActuelle);
                        totalGames++;

                        //insertion par batch
                        if (totalGames % BATCH_SIZE == 0) {
                            System.out.println("  -> Insertion du batch (" + totalGames + " parties) et (" + skippedGames + " parties) ignorées...");
                            insertBatch(connection, data);
                            data = new ETLData(); //eéinitialiser pour le prochain batch
                            // Je laisse le garbage collector faire sa vie pour voir.
//                            System.gc(); //pour vider la mémoire de l'ancien batch

                        }


                    } else {
                        skippedGames++;
                    }
                    //réinitialisation de gameActuelle pour une nouvelle partie
                    gameActuelle = new Game();
                }
            }
        }

        //insert le dernier batch (parties restantes)
        if (!data.games.isEmpty()) {
            System.out.println("  → Insertion du batch (" + totalGames + " parties) et " + skippedGames + " ignorées...");
            insertBatch(connection, data);
        }

        connection.commit();

        //fin du chronomètre
        Instant end = Instant.now();
        Duration duration = Duration.between(start, end);
        System.out.println("\nTerminé : " + totalGames + " parties insérées, "
                + skippedGames + " ignorées");
        System.out.println("Durée : " + (duration.toMillis() / 1000.0) + " secondes");

        connection.close();
    }

    /**
     * Accumule les informations d'une partie d'échecs dans l'objet ETLData fourni.
     *
     * Cette méthode effectue les actions suivantes :
     * - Ajoute les joueurs de la partie (blanc et noir) à la map des joueurs s'ils
     *   n'y sont pas déjà.
     * - Ajoute le tournoi de la partie à la map des tournois si le nom du tournoi
     *   est défini et non présent.
     * - Nettoie la suite de coups de la partie et l'ajoute à la map des suites de
     *   coups si elle n'y est pas déjà.
     * - Ajoute la partie elle-même à la liste des parties.
     *
     * @param data l'objet ETLData dans lequel accumuler les informations de la partie
     * @param game la partie d'échecs à accumuler
     */
    static void accumulerPartie(ETLData data, Game game) {
        //accumuler joueurs
        if (!data.joueurs.containsKey(game.white)) {
            data.joueurs.put(game.white, new JoueurDTO(
                    game.white, game.whiteElo, game.whiteTeam, game.whiteFideId));
        }
        if (!data.joueurs.containsKey(game.black)) {
            data.joueurs.put(game.black, new JoueurDTO(
                    game.black, game.blackElo, game.blackTeam, game.blackFideId));
        }

        //accumuler tournoi
        if (game.broadcastName != null && !data.tournois.containsKey(game.broadcastName)) {
            data.tournois.put(game.broadcastName, new TournoiDTO(
                    game.broadcastName, game.site, game.broadcastUrl, parseDate(game.utcDate)));
        }

        //ajout de la partie à la liste
        data.games.add(game);
    }


    /**
     * Insère en base de données un batch de parties à partir des données ETL fournies.
     *
     * Cette méthode effectue les étapes suivantes :
     * - Vérifie si la liste de parties est vide ; si oui, elle retourne immédiatement.
     * - Copie les joueurs dans la base et récupère leurs identifiants générés.
     * - Copie les tournois dans la base et récupère leurs identifiants générés.
     * - Copie les suites de coups dans la base et récupère leurs identifiants générés.
     * - Copie les parties en utilisant les identifiants des joueurs, tournois et suites de coups.
     * - Effectue un commit pour valider toutes les insertions du batch.
     *
     * @param conn la connexion JDBC vers la base de données
     * @param data l'objet ETLData contenant les parties, joueurs, tournois et suites de coups à insérer
     * @throws SQLException si une erreur SQL survient lors des insertions ou du commit
     * @throws IOException  si une erreur d'entrée/sortie survient lors du traitement des données
     */
    static void insertBatch(Connection conn, ETLData data) throws SQLException, IOException {
        if (data.games.isEmpty()) return;

        Instant t0 = Instant.now();
        Map<String, Integer> joueurIds = copyJoueurs(conn, data.joueurs);
        Instant t1 = Instant.now();
        Map<String, Integer> tournoiIds = copyTournois(conn, data.tournois);
        Instant t2 = Instant.now();
        copyParties(conn, data.games, joueurIds, tournoiIds);
        Instant t3 = Instant.now();

        conn.commit();  // Commit après chaque batch

        System.out.println("Temps copyJoueurs  : " + Duration.between(t0, t1).toMillis() + " ms");
        System.out.println("Temps copyTournois : " + Duration.between(t1, t2).toMillis() + " ms");
        System.out.println("Temps copyParties  : " + Duration.between(t2, t3).toMillis() + " ms");
    }


    /**
     * Copie les joueurs fournis dans la base de données et retourne une map de leurs identifiants.
     *
     * Cette méthode effectue les étapes suivantes :
     * - Vérifie si la map de joueurs est vide ; si oui, retourne une map vide.
     * - Crée une table temporaire pour stocker les joueurs du batch.
     * - Écrit les joueurs dans un fichier CSV temporaire.
     * - Utilise la commande COPY de PostgreSQL pour insérer les données dans la table temporaire.
     * - Insère dans la table principale les joueurs nouveaux uniquement (gestion des doublons par ON CONFLICT DO NOTHING).
     * - Récupère les identifiants des joueurs insérés ou déjà existants et les retourne sous forme de map pseudonyme → id.
     *
     * @param conn la connexion JDBC vers la base de données
     * @param joueurs la map des joueurs à copier (pseudonyme → JoueurDTO)
     * @return une map associant chaque pseudonyme à l'identifiant correspondant dans la base
     * @throws SQLException si une erreur SQL survient lors des insertions ou des requêtes
     * @throws IOException si une erreur d'entrée/sortie survient lors de la création ou lecture du fichier CSV temporaire
     */
    static Map<String, Integer> copyJoueurs(Connection conn, Map<String, JoueurDTO> joueurs)
            throws SQLException, IOException {
        if (joueurs.isEmpty()) return new HashMap<>();

        //Créer une table temporaire (pour nettoyer d'abord avant d'insérer)
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS temp_joueur");
            stmt.execute("CREATE TEMP TABLE temp_joueur (LIKE Joueur INCLUDING DEFAULTS)");
        }

        //COPY vers la table temporaire
        File tempFile = File.createTempFile("joueurs", ".csv");
        tempFile.deleteOnExit();

        try (PrintWriter writer = new PrintWriter(new FileWriter(tempFile))) {
            for (JoueurDTO j : joueurs.values()) {
                writer.println(escapeCsv(j.pseudonyme) + "," +
                        (j.elo != null ? j.elo : "\\N") + "," +
                        escapeCsv(j.equipe) + "," +
                        escapeCsv(j.fideId));
            }
        }

        org.postgresql.copy.CopyManager copyManager =
                new org.postgresql.copy.CopyManager((org.postgresql.core.BaseConnection) conn);

        //du csv ->table temporaire
        String sql = "COPY temp_joueur (pseudonyme, elo, equipe, fide_id) " +
                "FROM STDIN WITH (FORMAT CSV, NULL '\\N')";

        try (FileReader reader = new FileReader(tempFile)) {
            copyManager.copyIn(sql, reader);
        }

        //insérer uniquement les nouveaux joueurs (pseudo unique)
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(
                    "INSERT INTO Joueur (pseudonyme, elo, equipe, fide_id) " +
                            "SELECT pseudonyme, elo, equipe, fide_id FROM temp_joueur " +
                            "ON CONFLICT (pseudonyme) DO NOTHING"
            );
        }

        //récupérer les IDs des joueurs du batch
        Map<String, Integer> ids = new HashMap<>();
        StringBuilder pseudos = new StringBuilder();
        for (String pseudo : joueurs.keySet()) {
            if (pseudos.length() > 0) pseudos.append(",");
            pseudos.append("'").append(pseudo.replace("'", "''")).append("'");
        }

        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT pseudonyme, id FROM Joueur WHERE pseudonyme IN (" + pseudos + ")")) {
            while (rs.next()) {
                ids.put(rs.getString("pseudonyme"), rs.getInt("id"));
            }
        }

        return ids;
    }


    /**
     * Copie les tournois fournis dans la base de données et retourne une map de leurs identifiants.
     *
     * Cette méthode réalise les étapes suivantes :
     * - Vérifie si la map de tournois est vide ; si oui, retourne une map vide.
     * - Crée une table temporaire pour stocker les tournois du batch.
     * - Écrit les tournois dans un fichier CSV temporaire.
     * - Utilise la commande COPY de PostgreSQL pour insérer les données dans la table temporaire.
     * - Insère dans la table principale les tournois nouveaux uniquement
     *   (gestion des doublons via ON CONFLICT DO NOTHING).
     * - Récupère les identifiants des tournois insérés ou déjà existants et les retourne sous forme de map libelle → id.
     *
     * @param conn la connexion JDBC vers la base de données
     * @param tournois la map des tournois à copier (libelle → TournoiDTO)
     * @return une map associant chaque libellé de tournoi à l'identifiant correspondant dans la base
     * @throws SQLException si une erreur SQL survient lors des insertions ou des requêtes
     * @throws IOException  si une erreur d'entrée/sortie survient lors de la création ou lecture du fichier CSV temporaire
     */
    static Map<String, Integer> copyTournois(Connection conn, Map<String, TournoiDTO> tournois)
            throws SQLException, IOException {
        if (tournois.isEmpty()) return new HashMap<>();
        //meme principe que copyJoueurs
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS temp_tournoi");
            stmt.execute("CREATE TEMP TABLE temp_tournoi (LIKE Tournoi INCLUDING DEFAULTS)");
        }

        File tempFile = File.createTempFile("tournois", ".csv");
        tempFile.deleteOnExit();

        try (PrintWriter writer = new PrintWriter(new FileWriter(tempFile))) {
            for (TournoiDTO t : tournois.values()) {
                writer.println(escapeCsv(t.libelle) + "," +
                        escapeCsv(t.site) + "," +
                        escapeCsv(t.broadcastUrl) + "," +
                        (t.dateDebut != null ? t.dateDebut.toString() : "\\N") + "," +
                        "1," +
                        "1");
            }
        }

        org.postgresql.copy.CopyManager copyManager =
                new org.postgresql.copy.CopyManager((org.postgresql.core.BaseConnection) conn);

        String sql = "COPY temp_tournoi (libelle, site, broadcast_url, date_debut, Id_Organisateur, id_cadence) " +
                "FROM STDIN WITH (FORMAT CSV, NULL '\\N')";

        try (FileReader reader = new FileReader(tempFile)) {
            copyManager.copyIn(sql, reader);
        }

        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(
                    "INSERT INTO Tournoi (libelle, site, broadcast_url, date_debut, Id_Organisateur, id_cadence) " +
                            "SELECT libelle, site, broadcast_url, date_debut, Id_Organisateur, id_cadence FROM temp_tournoi " +
                            "ON CONFLICT (libelle) DO NOTHING"
            );
        }

        Map<String, Integer> ids = new HashMap<>();
        StringBuilder libelles = new StringBuilder();
        for (String lib : tournois.keySet()) {
            if (libelles.length() > 0) libelles.append(",");
            libelles.append("'").append(lib.replace("'", "''")).append("'");
        }

        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT libelle, id FROM Tournoi WHERE libelle IN (" + libelles + ")")) {
            while (rs.next()) {
                ids.put(rs.getString("libelle"), rs.getInt("id"));
            }
        }

        return ids;
    }

    /**
     * Copie les parties fournies dans la base de données en utilisant les identifiants
     * des joueurs, tournois et suites de coups préalablement insérés.
     *
     * Cette méthode réalise les étapes suivantes :
     * - Vérifie si la liste de parties est vide ; si oui, retourne immédiatement.
     * - Crée un fichier CSV temporaire contenant les données des parties à insérer.
     * - Pour chaque partie, récupère les identifiants des joueurs, du tournoi et de la suite de coups.
     * - Convertit les informations comme le résultat, la date/heure et gère les valeurs nulles.
     * - Utilise la commande COPY de PostgreSQL pour insérer rapidement toutes les parties.
     *
     * @param conn la connexion JDBC vers la base de données
     * @param parties la liste des parties à copier
     * @param joueurIds la map pseudonyme → id des joueurs déjà insérés
     * @param tournoiIds la map libelle → id des tournois déjà insérés
     * @throws SQLException si une erreur SQL survient lors de l'insertion
     * @throws IOException si une erreur d'entrée/sortie survient lors de la création ou lecture du fichier CSV temporaire
     */
    static void copyParties(Connection conn, List<Game> parties,
                            Map<String, Integer> joueurIds,
                            Map<String, Integer> tournoiIds)
            throws SQLException, IOException {
        if (parties.isEmpty()) return;

        Instant t0 = Instant.now();

        File tempFile = File.createTempFile("parties", ".csv");
        tempFile.deleteOnExit();

        // --- MESURE : écriture CSV ---
        Instant tCsvStart = Instant.now();

        try (PrintWriter writer = new PrintWriter(new FileWriter(tempFile))) {
            for (Game g : parties) {
                Integer idBlanc = joueurIds.get(g.white);
                Integer idNoir = joueurIds.get(g.black);

                // Ignorer si données manquantes
                if (idBlanc == null || idNoir == null) continue;

                Integer idTournoi = g.broadcastName != null ? tournoiIds.get(g.broadcastName) : null;

                Integer idOuverture = getIdOuverture(g.eco, g.opening);
                Integer idCadence = getIdCadence(g.timeControl);

                // Convertir le résultat
                int resultat = g.result.equals("1-0") ? 2 : g.result.equals("0-1") ? 0 : 1;

                writer.println(
                        escapeCsv(truncate(g.event, 255)) + "," +
                                resultat + "," +
                                (parseTimestamp(g.utcDate, g.utcTime) != null ?
                                        parseTimestamp(g.utcDate, g.utcTime).toString() : "\\N") + "," +
                                (g.whiteElo != null ? g.whiteElo : "\\N") + "," +
                                (g.blackElo != null ? g.blackElo : "\\N") + "," +
                                escapeCsv(g.whiteTitle) + "," +
                                escapeCsv(g.blackTitle) + "," +
                                escapeCsv(g.round) + "," +
                                escapeCsv(g.broadcastUrl) + "," +
                                escapeCsv(g.gameUrl) + "," +
                                escapeCsv(g.variant) + "," +
                                idBlanc + "," +
                                idNoir + "," +
                                (idOuverture != null ? idOuverture : "\\N") + "," +
                                (idCadence != null ? idCadence : "\\N") + "," +
                                (idTournoi != null ? idTournoi : "\\N") + "," +
                                escapeCsv(cleanPgn(g.moves.toString()))
                );
            }
        }

        Instant tCsvEnd = Instant.now();
        System.out.println("Temps écriture CSV parties : " +
                Duration.between(tCsvStart, tCsvEnd).toMillis() + " ms");


        // --- MESURE : COPY ---
        Instant tCopyStart = Instant.now();

        org.postgresql.copy.CopyManager copyManager =
                new org.postgresql.copy.CopyManager((org.postgresql.core.BaseConnection) conn);

        String sql = "COPY Partie (title, resultat, date_heure_utc, elo_blanc, elo_noir, " +
                "titre_blanc, titre_noir, round, broadcast_url, game_url, variant, " +
                "Id_Joueur_Blanc, Id_Joueur_Noir, id_ouverture, " +
                "id_cadence, id_tournoi, pgn) " +
                "FROM STDIN WITH (FORMAT CSV, NULL '\\N')";

        try (FileReader reader = new FileReader(tempFile)) {
            copyManager.copyIn(sql, reader);
        }

        Instant tCopyEnd = Instant.now();
        System.out.println("Temps COPY parties : " +
                Duration.between(tCopyStart, tCopyEnd).toMillis() + " ms");


        // --- MESURE totale ---
        System.out.println("Temps total copyParties : " +
                Duration.between(t0, Instant.now()).toMillis() + " ms");
    }


    /**
     * Échappe une valeur pour l'écriture dans un fichier CSV compatible PostgreSQL.
     *
     * Cette méthode effectue les actions suivantes :
     * - Si la valeur est null, retourne la chaîne spéciale "\N" pour représenter NULL.
     * - Si la valeur contient une virgule, un guillemet ou un saut de ligne, elle est entourée
     *   de guillemets doubles et les guillemets internes sont doublés.
     * - Sinon, retourne la valeur telle quelle.
     *
     * @param value la chaîne à échapper pour le CSV
     * @return la chaîne échappée prête à être insérée dans un fichier CSV
     */
    static String escapeCsv(String value) {
        if (value == null) return "\\N";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    /**
     * Analyse une ligne de métadonnées d'un fichier PGN et met à jour les champs correspondants de l'objet {@link Game}.
     * <p>
     * Exemple de ligne PGN : [White "MagnusCarlsen"]
     * <p>
     * Étapes :
     * - Extrait la clé ("White") et la valeur ("MagnusCarlsen")
     * - Met à jour le bon attribut de l'objet Game selon la clé
     *
     * @param line Ligne extraite du fichier PGN (doit commencer par un crochet ouvrant '[')
     * @param game Instance de Game dans laquelle les informations doivent être enregistrées
     */
    static void parseMetadata(String line, Game game) {
        //trouve la position de la fin de le clé, dès qu'on trouve un espace
        int finCle = line.indexOf(" ");
        //trouve la position de début et fin de "valeur" entre guillemets
        int valStart = line.indexOf("\"") + 1;
        int valEnd = line.lastIndexOf("\"");

        //ignorer les cas non complets
        if (finCle == -1 || valStart == -1 || valEnd == -1) return;

        String key = line.substring(1, finCle);  //recuperation cle
        String val = line.substring(valStart, valEnd);      //recuperation valeur

        switch (key) { //switch case pour remplir les infos de la game
            //infos sur la game
            case "Event":
                game.event = val;
                break;
            case "Date":
                game.date = val;
                break;
            case "Round":
                game.round = val;
                break;
            case "White":
                game.white = val;
                break;
            case "Black":
                game.black = val;
                break;
            case "Result":
                game.result = val;
                break;
            case "Variant":
                game.variant = val;
                break;
            case "ECO":
                game.eco = val;
                break;
            case "Opening":
                game.opening = val;
                break;
            case "TimeControl":
                game.timeControl = val;
                break;

            //infos sur joueur blanc
            case "WhiteElo":
                game.whiteElo = parseInt(val);
                break;
            case "WhiteTitle":
                game.whiteTitle = val;
                break;
            case "WhiteTeam":
                game.whiteTeam = val;
                break;
            case "WhiteFideId":
                game.whiteFideId = val;
                break;

            //infos sur joueur noir
            case "BlackElo":
                game.blackElo = parseInt(val);
                break;
            case "BlackTitle":
                game.blackTitle = val;
                break;
            case "BlackTeam":
                game.blackTeam = val;
                break;
            case "BlackFideId":
                game.blackFideId = val;
                break;

            //liens et datage
            case "UTCDate":
                game.utcDate = val;
                break;
            case "UTCTime":
                game.utcTime = val;
                break;
            case "BroadcastName":
                game.broadcastName = val;
                break;
            case "BroadcastURL":
                game.broadcastUrl = val;
                break;
            case "GameURL":
                game.gameUrl = val;
                break;
            case "Site":
                game.site = val;
                break;
        }
    }


    /**
     * Filtre les parties non valides selon certains critères de cohérence.
     * <p>
     * Une partie est considérée valide si :
     * - Les deux joueurs ont un ELO défini et supérieur ou égal à 800
     * - Le résultat est renseigné et différent de "*"
     *
     * @param g L'objet {@link Game} représentant une partie
     * @return true si la partie passe le filtre, false sinon
     */
    static boolean filter(Game g) {

        return g.whiteElo != null && g.blackElo != null
                && g.whiteElo >= 800 && g.blackElo >= 800
                && g.result != null && !g.result.equals("*");
    }


    /**
     * Convertit une chaîne en entier tout en gérant les exceptions.
     * Si la conversion échoue, retourne {@code null} au lieu de lever une erreur.
     *
     * @param s La chaîne à convertir en entier.
     * @return Un objet {@link Integer} correspondant à la valeur entière de {@code s}, ou {@code null} en cas d’erreur.
     */
    static Integer parseInt(String s) {
        try {
            return Integer.parseInt(s);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Retourne l'identifiant de la cadence correspondant au code de contrôle du temps fourni.
     *
     * Cette méthode normalise la chaîne de contrôle du temps (par exemple "300+2")
     * puis recherche l'identifiant correspondant dans la map des cadences.
     *
     * @param timeControl la chaîne représentant le contrôle du temps (ex. "300+2")
     * @return l'identifiant de la cadence correspondante, ou null si non trouvée
     */
    static Integer getIdCadence(String timeControl) {
        if (timeControl == null) return null;
        String normalized = normalizeCadence(timeControl);
        return cadences.get(normalized);
    }


    /**
     * Retourne l'identifiant d'une ouverture à partir de son code ECO et éventuellement de son libellé.
     *
     * Cette méthode tente d'abord de trouver une correspondance exacte entre le code ECO et le libellé
     * au format "code|libelle" dans le cache des ouvertures. Si aucune correspondance exacte n'est trouvée,
     * elle renvoie le premier identifiant correspondant au code ECO seul.
     *
     * @param eco le code ECO de l'ouverture (par exemple "C65")
     * @param opening le libellé de l'ouverture (par exemple "Ruy Lopez, Berlin Defense")
     * @return l'identifiant de l'ouverture si trouvée, sinon null
     */
    static Integer getIdOuverture(String eco, String opening) {
        if (eco == null) return null;

        //tentative 1 : Chercher avec code|libelle exact
        if (opening != null && !opening.isEmpty()) {
            String key = eco + "|" + opening;
            Integer id = ouvertures.get(key);
            if (id != null) return id;
        }

        //tentative 2 : Chercher juste le premier du code ECO
        for (Map.Entry<String, Integer> entry : ouvertures.entrySet()) {
            if (entry.getKey().startsWith(eco + "|")) {
                return entry.getValue();
            }
        }

        return null;
    }


    /**
     * Précharge les caches en mémoire à partir de la base de données.
     *
     * Cette méthode remplit deux tables de correspondance :
     * - le cache des cadences, associant chaque libellé de cadence à son identifiant ;
     * - le cache des ouvertures, associant chaque combinaison code|libellé à son identifiant.
     *
     * Elle effectue des requêtes SQL simples sur les tables Cadence et Ouverture,
     * puis affiche le nombre d'éléments chargés dans la console.
     *
     * @param conn la connexion à la base de données utilisée pour lire les données
     * @throws SQLException si une erreur survient lors de l'exécution des requêtes SQL
     */
    static void remplissageCache(Connection conn) throws SQLException {
        System.out.println("Préchargement des caches...");

        //hash des cadences
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT id, libelle FROM Cadence")) {
            while (rs.next()) {
                cadences.put(rs.getString("libelle"), rs.getInt("id"));
            }
        }
        System.out.println(cadences.size() + " cadences chargées");

        //hash des ouvertures
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT id, code, libelle FROM Ouverture")) {
            while (rs.next()) {
                ouvertures.put(rs.getString("code") + "|" + rs.getString("libelle"), rs.getInt("id"));
            }
        }
        System.out.println(ouvertures.size() + " ouvertures chargées");
    }

    /**
     * Convertit une date au format PGN (ex: "2024.09.18") en objet SQL Date.
     * <p>
     * Si le format est invalide ou absent, la méthode renvoie null.
     *
     * @param s chaîne de date PGN
     * @return java.sql.Date correspondante, ou null en cas d’erreur de parsing
     */
    static Date parseDate(String s) {
        if (s == null) return null;
        try {
            return Date.valueOf(s.replace('.', '-'));
        } catch (Exception e) {
            return null;
        }
    }


    /**
     * Convertit une date et une heure sous forme de chaînes en un objet {@link Timestamp}.
     * Si l'heure est nulle, elle est remplacée par "00:00:00".
     * Le format de date attendu est "YYYY.MM.DD" ou "YYYY-MM-DD".
     *
     * @param date La date au format chaîne (ex. "2025.10.30").
     * @param time L'heure au format chaîne (ex. "14:30:00"), ou null pour minuit.
     * @return Un {@link Timestamp} représentant la date et l'heure combinées, ou null si la conversion échoue.
     */
    static Timestamp parseTimestamp(String date, String time) {
        if (date == null) return null;
        try {
            String datetime = date.replace('.', '-') + " " + (time != null ? time : "00:00:00");
            return Timestamp.valueOf(datetime);
        } catch (Exception e) {
            return null;
        }
    }


    /**
     * Tronque une chaîne de caractères à une longueur maximale spécifiée.
     * <p>
     * Utile pour éviter les erreurs SQL sur des champs trop longs
     * (par exemple, les noms de tournois ou les URLs très longues).
     *
     * @param s   chaîne d’entrée
     * @param maxLength longueur maximale autorisée
     * @return chaîne tronquée à la longueur max, ou null si l’entrée était null
     */
    static String truncate(String s, int maxLength) {
        if (s == null) return null;
        return s.length() > maxLength ? s.substring(0, maxLength) : s;
    }


    /**
     * Nettoie une chaîne PGN (Portable Game Notation) en remplaçant tous les espaces
     * multiples et retours à la ligne par un seul espace, et en supprimant les espaces
     * en début et fin de chaîne.
     *
     * @param rawPGN La chaîne PGN brute à nettoyer.
     * @return La chaîne PGN nettoyée, ou null si l'entrée est nulle.
     */
    static String cleanPgn(String rawPGN) {
        if (rawPGN == null) return null;
        StringBuilder sb = new StringBuilder(rawPGN.length());
        boolean inSpace = false;

        for (int i = 0; i < rawPGN.length(); i++) {
            char c = rawPGN.charAt(i);
            if (Character.isWhitespace(c)) {
                if (!inSpace) {
                    sb.append(' ');
                    inSpace = true;
                }
            } else {
                sb.append(c);
                inSpace = false;
            }
        }

        // trim
        int start = 0, end = sb.length();
        while (start < end && sb.charAt(start) == ' ') start++;
        while (end > start && sb.charAt(end - 1) == ' ') end--;
        return sb.substring(start, end);
    }



    /**
     * Normalise une chaîne représentant la cadence d'une partie (TimeControl)
     * en supprimant les caractères non numériques et en gardant uniquement
     * les chiffres et le signe '+' entre le temps principal et l'incrément.
     * <p>
     * Exemple d'utilisation :
     * - "90minutes + 30 seconds"  -> "90+30"
     * - "3 min + 2s"              -> "3+2"
     * - "10+0"                    -> "10+0"
     * <p>
     * Cette méthode est utilisée avant la recherche d'une cadence
     * dans la base de données, afin de rendre les valeurs cohérentes
     * avec les formats stockés dans la table Cadence.
     *
     * @param rawCadence Chaîne brute issue du PGN (champ TimeControl)
     * @return Chaîne normalisée au format "temps+incrément",
     * ou null si l'entrée est nulle.
     */
    static String normalizeCadence(String rawCadence) {
        if (rawCadence == null) return null;
        rawCadence = rawCadence.toLowerCase().replaceAll("[^0-9+]", "");
        return rawCadence; // ex: "90minutes + 30 seconds" → "90+30"
    }


}

