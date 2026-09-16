package com.chessmate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

/**
 * Tests unitaires pour le filtre de parties
 */
@DisplayName("Tests du filtre de parties")
class FilterTest {

    @Test
    @DisplayName("Accepte une partie valide")
    void acceptValidGame() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO blanc null")
    void rejectNullWhiteElo() {
        Game game = new Game();
        game.whiteElo = null;
        game.blackElo = 2400;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO noir null")
    void rejectNullBlackElo() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = null;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO blanc < 800")
    void rejectLowWhiteElo() {
        Game game = new Game();
        game.whiteElo = 799;
        game.blackElo = 2400;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO noir < 800")
    void rejectLowBlackElo() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 799;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Accepte une partie avec ELO = 800 exactement")
    void acceptEloExactly800() {
        Game game = new Game();
        game.whiteElo = 800;
        game.blackElo = 800;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Accepte une partie avec ELO très élevé")
    void acceptHighElo() {
        Game game = new Game();
        game.whiteElo = 2900;
        game.blackElo = 2850;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Rejette une partie sans résultat")
    void rejectNullResult() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = null;

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec résultat *")
    void rejectAsteriskResult() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "*";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Accepte une partie nulle (1/2-1/2)")
    void acceptDrawResult() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "1/2-1/2";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Accepte une victoire des blancs (1-0)")
    void acceptWhiteWin() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Accepte une victoire des noirs (0-1)")
    void acceptBlackWin() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "0-1";

        assertThat(ChessMateETL.filter(game)).isTrue();
    }

    @Test
    @DisplayName("Rejette une partie avec les deux ELO null")
    void rejectBothEloNull() {
        Game game = new Game();
        game.whiteElo = null;
        game.blackElo = null;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec les deux ELO < 800")
    void rejectBothEloLow() {
        Game game = new Game();
        game.whiteElo = 700;
        game.blackElo = 750;
        game.result = "1-0";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO valide mais résultat vide")
    void rejectEmptyResult1() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = null;

        assertThat(ChessMateETL.filter(game)).isFalse();
    }

    @Test
    @DisplayName("Rejette une partie avec ELO valide mais résultat vide (*)")
    void rejectEmptyResult2() {
        Game game = new Game();
        game.whiteElo = 2500;
        game.blackElo = 2400;
        game.result = "*";

        assertThat(ChessMateETL.filter(game)).isFalse();
    }
}