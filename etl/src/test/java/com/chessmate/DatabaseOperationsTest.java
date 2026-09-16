package com.chessmate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.sql.SQLException;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests d'intégration PostgreSQL avec Testcontainers.
 * Ces tests appellent les VRAIES méthodes ChessMateETL qui utilisent PostgreSQL
 * COPY.
 */
@DisplayName("Tests PostgreSQL des opérations base de données")
class DatabaseOperationsPostgresTest extends BaseIntegrationTest {

    @Test
    @DisplayName("copyJoueurs insère correctement avec PostgreSQL COPY")
    void copyJoueursInsertsPlayersWithPostgreSQL() throws SQLException, IOException {
        Map<String, JoueurDTO> joueurs = new HashMap<>();
        joueurs.put("Magnus", new JoueurDTO("Magnus", 2850, "Norway", "12345"));
        joueurs.put("Hikaru", new JoueurDTO("Hikaru", 2800, "USA", "67890"));

        // Appel de la VRAIE méthode ChessMateETL avec PostgreSQL COPY
        Map<String, Integer> ids = ChessMateETL.copyJoueurs(connection, joueurs);

        assertThat(ids).hasSize(2);
        assertThat(ids).containsKey("Magnus");
        assertThat(ids).containsKey("Hikaru");

        connection.commit();
    }

    @Test
    @DisplayName("copyJoueurs gère les doublons (idempotence) avec PostgreSQL")
    void copyJoueursIdempotencyWithPostgreSQL() throws SQLException, IOException {
        Map<String, JoueurDTO> joueurs = new HashMap<>();
        joueurs.put("Magnus", new JoueurDTO("Magnus", 2850, "Norway", "12345"));

        // Première insertion
        Map<String, Integer> ids1 = ChessMateETL.copyJoueurs(connection, joueurs);
        connection.commit();

        // Deuxième insertion (doit retourner le même ID)
        Map<String, Integer> ids2 = ChessMateETL.copyJoueurs(connection, joueurs);
        connection.commit();

        assertThat(ids1.get("Magnus")).isEqualTo(ids2.get("Magnus"));
    }

    @Test
    @DisplayName("copyTournois insère correctement avec PostgreSQL")
    void copyTournoisInsertsTournamentsWithPostgreSQL() throws SQLException, IOException {
        Map<String, TournoiDTO> tournois = new HashMap<>();
        tournois.put("Tata Steel",
                new TournoiDTO("Tata Steel", "Wijk aan Zee", "url", java.sql.Date.valueOf("2024-01-01")));

        // Appel de la VRAIE méthode ChessMateETL
        Map<String, Integer> ids = ChessMateETL.copyTournois(connection, tournois);
        connection.commit();

        assertThat(ids).hasSize(1);
        assertThat(ids).containsKey("Tata Steel");
    }

    @Test
    @DisplayName("copyParties insère correctement avec PostgreSQL COPY")
    void copyPartiesInsertsGamesWithPostgreSQL() throws SQLException, IOException {
        // Insérer joueurs et tournois
        Map<String, JoueurDTO> joueurs = new HashMap<>();
        joueurs.put("WhitePlayer", new JoueurDTO("WhitePlayer", 2000, null, null));
        joueurs.put("BlackPlayer", new JoueurDTO("BlackPlayer", 2000, null, null));
        Map<String, Integer> joueurIds = ChessMateETL.copyJoueurs(connection, joueurs);

        Map<String, TournoiDTO> tournois = new HashMap<>();
        tournois.put("Test Event", new TournoiDTO("Test Event", "Site", "url", null));
        Map<String, Integer> tournoiIds = ChessMateETL.copyTournois(connection, tournois);

        connection.commit();

        // Créer parties
        List<Game> games = new ArrayList<>();
        Game g = createBasicGame("WhitePlayer", "BlackPlayer", "1-0");
        g.broadcastName = "Test Event";
        games.add(g);

        // Appel de la VRAIE méthode ChessMateETL avec PostgreSQL COPY
        ChessMateETL.copyParties(connection, games, joueurIds, tournoiIds);
        connection.commit();

        // Vérifier l'insertion
        try (var stmt = connection.createStatement();
                var rs = stmt.executeQuery("SELECT count(*) FROM Partie")) {
            rs.next();
            assertThat(rs.getInt(1)).isEqualTo(1);
        }
    }

    @Test
    @DisplayName("copyParties gère de multiples parties")
    void copyPartiesInsertsMultipleGames() throws SQLException, IOException {
        // Insérer joueurs
        Map<String, JoueurDTO> joueurs = new HashMap<>();
        joueurs.put("Player1", new JoueurDTO("Player1", 2500, "Team A", "111"));
        joueurs.put("Player2", new JoueurDTO("Player2", 2600, "Team B", "222"));
        joueurs.put("Player3", new JoueurDTO("Player3", 2700, "Team C", "333"));
        Map<String, Integer> joueurIds = ChessMateETL.copyJoueurs(connection, joueurs);

        Map<String, TournoiDTO> tournois = new HashMap<>();
        tournois.put("Big Tournament", new TournoiDTO("Big Tournament", "Paris", "url", null));
        Map<String, Integer> tournoiIds = ChessMateETL.copyTournois(connection, tournois);

        connection.commit();

        // Créer 3 parties différentes
        List<Game> games = new ArrayList<>();

        Game g1 = createBasicGame("Player1", "Player2", "1-0");
        g1.broadcastName = "Big Tournament";
        games.add(g1);

        Game g2 = createBasicGame("Player2", "Player3", "0-1");
        g2.broadcastName = "Big Tournament";
        games.add(g2);

        Game g3 = createBasicGame("Player3", "Player1", "1/2-1/2");
        g3.broadcastName = "Big Tournament";
        games.add(g3);

        ChessMateETL.copyParties(connection, games, joueurIds, tournoiIds);
        connection.commit();

        // Vérifier que 3 parties ont été insérées
        try (var stmt = connection.createStatement();
                var rs = stmt.executeQuery("SELECT count(*) FROM Partie")) {
            rs.next();
            assertThat(rs.getInt(1)).isEqualTo(3);
        }
    }
}
