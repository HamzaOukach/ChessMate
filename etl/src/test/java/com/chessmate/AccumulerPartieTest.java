package com.chessmate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

/**
 * Tests unitaires pour l'accumulation de parties/joueurs
 */
@DisplayName("Tests d'accumulation de parties")
class AccumulerPartieTest {

    @Test
    @DisplayName("Accumule correctement les joueurs")
    void accumulateJoueurs() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.whiteElo = 2850;
        game.whiteTeam = "Norway";
        game.whiteFideId = "1503014";
        game.black = "Hikaru";
        game.blackElo = 2789;
        game.blackTeam = "USA";
        game.blackFideId = "2016192";

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.joueurs).hasSize(2);
        assertThat(data.joueurs).containsKey("Magnus");
        assertThat(data.joueurs).containsKey("Hikaru");

        JoueurDTO magnus = data.joueurs.get("Magnus");
        assertThat(magnus.pseudonyme).isEqualTo("Magnus");
        assertThat(magnus.elo).isEqualTo(2850);
        assertThat(magnus.equipe).isEqualTo("Norway");
        assertThat(magnus.fideId).isEqualTo("1503014");

        JoueurDTO hikaru = data.joueurs.get("Hikaru");
        assertThat(hikaru.pseudonyme).isEqualTo("Hikaru");
        assertThat(hikaru.elo).isEqualTo(2789);
        assertThat(hikaru.equipe).isEqualTo("USA");
        assertThat(hikaru.fideId).isEqualTo("2016192");
    }

    @Test
    @DisplayName("N'ajoute pas deux fois le même joueur")
    void noDuplicateJoueur() {
        ETLData data = new ETLData();

        Game game1 = new Game();
        game1.white = "Magnus";
        game1.whiteElo = 2850;
        game1.black = "Hikaru";
        game1.blackElo = 2789;

        Game game2 = new Game();
        game2.white = "Magnus";
        game2.whiteElo = 2850;
        game2.black = "Fabiano";
        game2.blackElo = 2800;

        ChessMateETL.accumulerPartie(data, game1);
        ChessMateETL.accumulerPartie(data, game2);

        assertThat(data.joueurs).hasSize(3);
        assertThat(data.joueurs).containsKey("Magnus");
        assertThat(data.joueurs).containsKey("Hikaru");
        assertThat(data.joueurs).containsKey("Fabiano");
    }

    @Test
    @DisplayName("Accumule correctement les tournois")
    void accumulateTournois() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.black = "Hikaru";
        game.broadcastName = "Tata Steel 2024";
        game.site = "Wijk aan Zee";
        game.broadcastUrl = "https://lichess.org/broadcast";
        game.utcDate = "2024.01.15";

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.tournois).hasSize(1);
        assertThat(data.tournois).containsKey("Tata Steel 2024");

        TournoiDTO tournoi = data.tournois.get("Tata Steel 2024");
        assertThat(tournoi.libelle).isEqualTo("Tata Steel 2024");
        assertThat(tournoi.site).isEqualTo("Wijk aan Zee");
        assertThat(tournoi.broadcastUrl).isEqualTo("https://lichess.org/broadcast");
    }

    @Test
    @DisplayName("N'ajoute pas deux fois le même tournoi")
    void noDuplicateTournoi() {
        ETLData data = new ETLData();

        Game game1 = new Game();
        game1.white = "Magnus";
        game1.black = "Hikaru";
        game1.broadcastName = "Tata Steel 2024";
        game1.site = "Wijk aan Zee";

        Game game2 = new Game();
        game2.white = "Fabiano";
        game2.black = "Alireza";
        game2.broadcastName = "Tata Steel 2024";
        game2.site = "Wijk aan Zee";

        ChessMateETL.accumulerPartie(data, game1);
        ChessMateETL.accumulerPartie(data, game2);

        assertThat(data.tournois).hasSize(1);
    }

    @Test
    @DisplayName("N'ajoute pas de tournoi si broadcastName est null")
    void noTournoiWhenBroadcastNameNull() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.black = "Hikaru";
        game.broadcastName = null;

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.tournois).isEmpty();
    }

    @Test
    @DisplayName("Ajoute la partie à la liste")
    void addGameToList() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.black = "Hikaru";

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.games).hasSize(1);
        assertThat(data.games.get(0)).isEqualTo(game);
    }

    @Test
    @DisplayName("Ajoute plusieurs parties à la liste")
    void addMultipleGames() {
        ETLData data = new ETLData();

        Game game1 = new Game();
        game1.white = "Magnus";
        game1.black = "Hikaru";

        Game game2 = new Game();
        game2.white = "Fabiano";
        game2.black = "Alireza";

        Game game3 = new Game();
        game3.white = "Wesley";
        game3.black = "Levon";

        ChessMateETL.accumulerPartie(data, game1);
        ChessMateETL.accumulerPartie(data, game2);
        ChessMateETL.accumulerPartie(data, game3);

        assertThat(data.games).hasSize(3);
        assertThat(data.games).containsExactly(game1, game2, game3);
    }

    @Test
    @DisplayName("Gère les joueurs avec données nulles")
    void handleJoueurWithNullData() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.whiteElo = null;
        game.whiteTeam = null;
        game.whiteFideId = null;
        game.black = "Hikaru";
        game.blackElo = null;

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.joueurs).hasSize(2);

        JoueurDTO magnus = data.joueurs.get("Magnus");
        assertThat(magnus.pseudonyme).isEqualTo("Magnus");
        assertThat(magnus.elo).isNull();
        assertThat(magnus.equipe).isNull();
        assertThat(magnus.fideId).isNull();
    }

    @Test
    @DisplayName("Gère les tournois avec données nulles")
    void handleTournoiWithNullData() {
        ETLData data = new ETLData();
        Game game = new Game();
        game.white = "Magnus";
        game.black = "Hikaru";
        game.broadcastName = "Tournoi Test";
        game.site = null;
        game.broadcastUrl = null;
        game.utcDate = null;

        ChessMateETL.accumulerPartie(data, game);

        assertThat(data.tournois).hasSize(1);

        TournoiDTO tournoi = data.tournois.get("Tournoi Test");
        assertThat(tournoi.libelle).isEqualTo("Tournoi Test");
        assertThat(tournoi.site).isNull();
        assertThat(tournoi.broadcastUrl).isNull();
    }

    @Test
    @DisplayName("Accumule des joueurs jouant plusieurs fois")
    void accumulateSamePlayerMultipleTimes() {
        ETLData data = new ETLData();

        Game game1 = new Game();
        game1.white = "Magnus";
        game1.whiteElo = 2850;
        game1.black = "Hikaru";
        game1.blackElo = 2789;

        Game game2 = new Game();
        game2.white = "Hikaru";
        game2.whiteElo = 2789;
        game2.black = "Magnus";
        game2.blackElo = 2850;

        ChessMateETL.accumulerPartie(data, game1);
        ChessMateETL.accumulerPartie(data, game2);

        // Vérifie qu'il n'y a que 2 joueurs uniques
        assertThat(data.joueurs).hasSize(2);
        assertThat(data.games).hasSize(2);
    }
}