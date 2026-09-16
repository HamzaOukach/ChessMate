package com.chessmate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;

/**
 * Tests unitaires pour le parsing des métadonnées PGN
 */
@DisplayName("Tests de parsing des métadonnées PGN")
class ParseMetadataTest {

    private Game game;

    @BeforeEach
    void setUp() {
        game = new Game();
    }

    @Test
    @DisplayName("Parse correctement le nom du joueur blanc")
    void parseWhitePlayer() {
        ChessMateETL.parseMetadata("[White \"MagnusCarlsen\"]", game);
        assertThat(game.white).isEqualTo("MagnusCarlsen");
    }

    @Test
    @DisplayName("Parse correctement le nom du joueur noir")
    void parseBlackPlayer() {
        ChessMateETL.parseMetadata("[Black \"HikaruNakamura\"]", game);
        assertThat(game.black).isEqualTo("HikaruNakamura");
    }

    @Test
    @DisplayName("Parse correctement l'ELO du joueur blanc")
    void parseWhiteElo() {
        ChessMateETL.parseMetadata("[WhiteElo \"2850\"]", game);
        assertThat(game.whiteElo).isEqualTo(2850);
    }

    @Test
    @DisplayName("Parse correctement l'ELO du joueur noir")
    void parseBlackElo() {
        ChessMateETL.parseMetadata("[BlackElo \"2789\"]", game);
        assertThat(game.blackElo).isEqualTo(2789);
    }

    @Test
    @DisplayName("Parse correctement le résultat 1-0")
    void parseResultWhiteWin() {
        ChessMateETL.parseMetadata("[Result \"1-0\"]", game);
        assertThat(game.result).isEqualTo("1-0");
    }

    @Test
    @DisplayName("Parse correctement le résultat 0-1")
    void parseResultBlackWin() {
        ChessMateETL.parseMetadata("[Result \"0-1\"]", game);
        assertThat(game.result).isEqualTo("0-1");
    }

    @Test
    @DisplayName("Parse correctement le résultat 1/2-1/2")
    void parseResultDraw() {
        ChessMateETL.parseMetadata("[Result \"1/2-1/2\"]", game);
        assertThat(game.result).isEqualTo("1/2-1/2");
    }

    @Test
    @DisplayName("Parse correctement l'événement")
    void parseEvent() {
        ChessMateETL.parseMetadata("[Event \"World Chess Championship\"]", game);
        assertThat(game.event).isEqualTo("World Chess Championship");
    }

    @Test
    @DisplayName("Parse correctement le code ECO")
    void parseECO() {
        ChessMateETL.parseMetadata("[ECO \"C65\"]", game);
        assertThat(game.eco).isEqualTo("C65");
    }

    @Test
    @DisplayName("Parse correctement l'ouverture")
    void parseOpening() {
        ChessMateETL.parseMetadata("[Opening \"Ruy Lopez, Berlin Defense\"]", game);
        assertThat(game.opening).isEqualTo("Ruy Lopez, Berlin Defense");
    }

    @Test
    @DisplayName("Parse correctement le TimeControl")
    void parseTimeControl() {
        ChessMateETL.parseMetadata("[TimeControl \"300+2\"]", game);
        assertThat(game.timeControl).isEqualTo("300+2");
    }

    @Test
    @DisplayName("Parse correctement la date UTC")
    void parseUTCDate() {
        ChessMateETL.parseMetadata("[UTCDate \"2024.09.18\"]", game);
        assertThat(game.utcDate).isEqualTo("2024.09.18");
    }

    @Test
    @DisplayName("Parse correctement l'heure UTC")
    void parseUTCTime() {
        ChessMateETL.parseMetadata("[UTCTime \"14:30:00\"]", game);
        assertThat(game.utcTime).isEqualTo("14:30:00");
    }

    @Test
    @DisplayName("Parse correctement le titre du joueur blanc")
    void parseWhiteTitle() {
        ChessMateETL.parseMetadata("[WhiteTitle \"GM\"]", game);
        assertThat(game.whiteTitle).isEqualTo("GM");
    }

    @Test
    @DisplayName("Parse correctement le titre du joueur noir")
    void parseBlackTitle() {
        ChessMateETL.parseMetadata("[BlackTitle \"IM\"]", game);
        assertThat(game.blackTitle).isEqualTo("IM");
    }

    @Test
    @DisplayName("Parse correctement l'équipe blanche")
    void parseWhiteTeam() {
        ChessMateETL.parseMetadata("[WhiteTeam \"Norway\"]", game);
        assertThat(game.whiteTeam).isEqualTo("Norway");
    }

    @Test
    @DisplayName("Parse correctement l'équipe noire")
    void parseBlackTeam() {
        ChessMateETL.parseMetadata("[BlackTeam \"USA\"]", game);
        assertThat(game.blackTeam).isEqualTo("USA");
    }

    @Test
    @DisplayName("Parse correctement le FIDE ID du joueur blanc")
    void parseWhiteFideId() {
        ChessMateETL.parseMetadata("[WhiteFideId \"1503014\"]", game);
        assertThat(game.whiteFideId).isEqualTo("1503014");
    }

    @Test
    @DisplayName("Parse correctement le FIDE ID du joueur noir")
    void parseBlackFideId() {
        ChessMateETL.parseMetadata("[BlackFideId \"2016192\"]", game);
        assertThat(game.blackFideId).isEqualTo("2016192");
    }

    @Test
    @DisplayName("Parse correctement le round")
    void parseRound() {
        ChessMateETL.parseMetadata("[Round \"5\"]", game);
        assertThat(game.round).isEqualTo("5");
    }

    @Test
    @DisplayName("Parse correctement la variante")
    void parseVariant() {
        ChessMateETL.parseMetadata("[Variant \"Standard\"]", game);
        assertThat(game.variant).isEqualTo("Standard");
    }

    @Test
    @DisplayName("Parse correctement le site")
    void parseSite() {
        ChessMateETL.parseMetadata("[Site \"Wijk aan Zee\"]", game);
        assertThat(game.site).isEqualTo("Wijk aan Zee");
    }

    @Test
    @DisplayName("Parse correctement le BroadcastName")
    void parseBroadcastName() {
        ChessMateETL.parseMetadata("[BroadcastName \"Tata Steel Chess 2024\"]", game);
        assertThat(game.broadcastName).isEqualTo("Tata Steel Chess 2024");
    }

    @Test
    @DisplayName("Parse correctement le BroadcastURL")
    void parseBroadcastURL() {
        ChessMateETL.parseMetadata("[BroadcastURL \"https://lichess.org/broadcast\"]", game);
        assertThat(game.broadcastUrl).isEqualTo("https://lichess.org/broadcast");
    }

    @Test
    @DisplayName("Parse correctement le GameURL")
    void parseGameURL() {
        ChessMateETL.parseMetadata("[GameURL \"https://lichess.org/abc123\"]", game);
        assertThat(game.gameUrl).isEqualTo("https://lichess.org/abc123");
    }

    @Test
    @DisplayName("Ignore les lignes mal formatées sans espace")
    void parseMalformedLineWithoutSpace() {
        ChessMateETL.parseMetadata("[MalformedLine", game);
        assertThat(game.white).isNull();
    }

    @Test
    @DisplayName("Ignore les lignes mal formatées sans guillemets")
    void parseMalformedLineWithoutQuotes() {
        ChessMateETL.parseMetadata("[White MagnusCarlsen]", game);
        assertThat(game.white).isNull();
    }

    @Test
    @DisplayName("Gère les valeurs vides")
    void parseEmptyValue() {
        ChessMateETL.parseMetadata("[WhiteTitle \"\"]", game);
        assertThat(game.whiteTitle).isEqualTo("");
    }

    @Test
    @DisplayName("Gère les noms avec espaces")
    void parseNameWithSpaces() {
        ChessMateETL.parseMetadata("[White \"Magnus Carlsen\"]", game);
        assertThat(game.white).isEqualTo("Magnus Carlsen");
    }

    @Test
    @DisplayName("Ignore les clés inconnues")
    void parseUnknownKey() {
        ChessMateETL.parseMetadata("[UnknownKey \"SomeValue\"]", game);
        // Vérifie qu'aucune exception n'est levée et que l'objet reste intact
        assertThat(game.white).isNull();
    }
}