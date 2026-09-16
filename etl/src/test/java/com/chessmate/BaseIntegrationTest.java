package com.chessmate;

import org.junit.jupiter.api.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.*;

/**
 * Classe de base pour les tests d'intégration PostgreSQL avec Testcontainers.
 * Démarre un conteneur PostgreSQL réel pour tester les méthodes natives.
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class BaseIntegrationTest {

    @Container
    protected static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    protected Connection connection;

    @BeforeAll
    public void setupDatabase() throws Exception {
        // Connexion au conteneur PostgreSQL
        connection = DriverManager.getConnection(
                postgres.getJdbcUrl(),
                postgres.getUsername(),
                postgres.getPassword());

        connection.setAutoCommit(false);

        // Créer le schéma PostgreSQL
        createSchema();
        connection.commit();
    }

    @AfterAll
    public void tearDown() throws Exception {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
    }

    @BeforeEach
    public void prepareTestData() throws SQLException {
        // Reset caches
        ChessMateETL.cadences.clear();
        ChessMateETL.ouvertures.clear();

        // Nettoyer les tables et réinitialiser les séquences SERIAL
        try (Statement stmt = connection.createStatement()) {
            // TRUNCATE cascade supprime toutes les données et reset les séquences
            stmt.execute(
                    "TRUNCATE TABLE Partie, Tournoi, Joueur, Ouverture, Cadence, Organisateur RESTART IDENTITY CASCADE");
            connection.commit();
        }

        // Ré-insertion des données de référence
        insertReferenceData();
        connection.commit();
    }

    private void createSchema() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("CREATE TABLE Organisateur (" +
                    "id SERIAL PRIMARY KEY, " +
                    "nom VARCHAR(255))");

            stmt.execute("CREATE TABLE Cadence (" +
                    "id SERIAL PRIMARY KEY, " +
                    "libelle VARCHAR(50) UNIQUE NOT NULL)");

            stmt.execute("CREATE TABLE Ouverture (" +
                    "id SERIAL PRIMARY KEY, " +
                    "code VARCHAR(10) NOT NULL, " +
                    "libelle VARCHAR(255) NOT NULL, " +
                    "UNIQUE(code, libelle))");

            stmt.execute("CREATE TABLE Joueur (" +
                    "id SERIAL PRIMARY KEY, " +
                    "pseudonyme VARCHAR(255) UNIQUE NOT NULL, " +
                    "elo INTEGER, " +
                    "equipe VARCHAR(255), " +
                    "fide_id VARCHAR(50))");

            stmt.execute("CREATE TABLE Tournoi (" +
                    "id SERIAL PRIMARY KEY, " +
                    "libelle VARCHAR(255) UNIQUE NOT NULL, " +
                    "site VARCHAR(255), " +
                    "broadcast_url TEXT, " +
                    "date_debut DATE, " +
                    "id_organisateur INTEGER, " +
                    "id_cadence INTEGER, " +
                    "FOREIGN KEY (id_organisateur) REFERENCES Organisateur(id), " +
                    "FOREIGN KEY (id_cadence) REFERENCES Cadence(id))");

            stmt.execute("CREATE TABLE Partie (" +
                    "id SERIAL PRIMARY KEY, " +
                    "title VARCHAR(255), " +
                    "resultat SMALLINT, " +
                    "pgn TEXT, " +
                    "date_heure_utc TIMESTAMP, " +
                    "elo_blanc SMALLINT, " +
                    "elo_noir SMALLINT, " +
                    "score_blanc_diff SMALLINT, " +
                    "score_noir_diff SMALLINT, " +
                    "titre_blanc VARCHAR(5), " +
                    "titre_noir VARCHAR(5), " +
                    "type_resultat VARCHAR(50), " +
                    "round VARCHAR(20), " +
                    "broadcast_url TEXT, " +
                    "game_url TEXT, " +
                    "variant VARCHAR(50), " +
                    "id_ouverture INTEGER, " +
                    "id_cadence INTEGER, " +
                    "id_joueur_blanc INTEGER NOT NULL, " +
                    "id_joueur_noir INTEGER NOT NULL, " +
                    "id_tournoi INTEGER, " +
                    "FOREIGN KEY (id_ouverture) REFERENCES Ouverture(id), " +
                    "FOREIGN KEY (id_cadence) REFERENCES Cadence(id), " +
                    "FOREIGN KEY (id_joueur_blanc) REFERENCES Joueur(id), " +
                    "FOREIGN KEY (id_joueur_noir) REFERENCES Joueur(id), " +
                    "FOREIGN KEY (id_tournoi) REFERENCES Tournoi(id))");
        }
    }

    private void insertReferenceData() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            // Organisateur
            stmt.execute("INSERT INTO Organisateur (nom) VALUES ('Test Org')");

            // Cadences
            stmt.execute("INSERT INTO Cadence (libelle) VALUES ('180+2')");
            stmt.execute("INSERT INTO Cadence (libelle) VALUES ('300+0')");
            stmt.execute("INSERT INTO Cadence (libelle) VALUES ('600+5')");

            // Ouvertures
            stmt.execute("INSERT INTO Ouverture (code, libelle) VALUES ('C42', 'Petrov Defense')");
            stmt.execute("INSERT INTO Ouverture (code, libelle) VALUES ('E60', 'King''s Indian Defense')");
            stmt.execute("INSERT INTO Ouverture (code, libelle) VALUES ('C65', 'Ruy Lopez, Berlin Defense')");
        }
    }

    protected Game createBasicGame(String white, String black, String result) {
        Game g = new Game();
        g.white = white;
        g.black = black;
        g.result = result;
        g.event = "Test Event";
        g.whiteElo = 2000;
        g.blackElo = 2000;
        g.utcDate = "2024.01.15";
        g.utcTime = "14:30:00";
        g.eco = "C42";
        g.opening = "Petrov Defense";
        g.timeControl = "180+2";
        g.moves = new StringBuilder("1. e4 e5");
        return g;
    }
}
