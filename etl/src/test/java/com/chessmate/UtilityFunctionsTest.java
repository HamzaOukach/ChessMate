package com.chessmate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.sql.*;

/**
 * Tests unitaires pour les fonctions utilitaires
 */
@DisplayName("Tests des fonctions utilitaires")
class UtilityFunctionsTest {

    @Test
    @DisplayName("parseInt parse correctement un entier valide")
    void parseValidInteger() {
        assertThat(ChessMateETL.parseInt("2850")).isEqualTo(2850);
    }

    @Test
    @DisplayName("parseInt parse correctement zéro")
    void parseZero() {
        assertThat(ChessMateETL.parseInt("0")).isEqualTo(0);
    }

    @Test
    @DisplayName("parseInt parse correctement un nombre négatif")
    void parseNegativeInteger() {
        assertThat(ChessMateETL.parseInt("-100")).isEqualTo(-100);
    }

    @Test
    @DisplayName("parseInt retourne null pour une chaîne invalide")
    void parseInvalidInteger() {
        assertThat(ChessMateETL.parseInt("abc")).isNull();
    }

    @Test
    @DisplayName("parseInt retourne null pour null")
    void parseNullInteger() {
        assertThat(ChessMateETL.parseInt(null)).isNull();
    }

    @Test
    @DisplayName("parseInt retourne null pour une chaîne vide")
    void parseEmptyInteger() {
        assertThat(ChessMateETL.parseInt("")).isNull();
    }

    @Test
    @DisplayName("parseInt retourne null pour un nombre avec des espaces")
    void parseIntegerWithSpaces() {
        assertThat(ChessMateETL.parseInt(" 2850 ")).isNull();
    }

    @Test
    @DisplayName("parseDate parse correctement une date valide")
    void parseValidDate() {
        Date result = ChessMateETL.parseDate("2024.09.18");
        assertThat(result).isNotNull();
        assertThat(result.toString()).isEqualTo("2024-09-18");
    }

    @Test
    @DisplayName("parseDate parse correctement une date avec tirets")
    void parseDateWithDashes() {
        Date result = ChessMateETL.parseDate("2024-09-18");
        assertThat(result).isNotNull();
        assertThat(result.toString()).isEqualTo("2024-09-18");
    }

    @Test
    @DisplayName("parseDate retourne null pour une date invalide")
    void parseInvalidDate() {
        assertThat(ChessMateETL.parseDate("invalid")).isNull();
    }

    @Test
    @DisplayName("parseDate retourne null pour null")
    void parseNullDate() {
        assertThat(ChessMateETL.parseDate(null)).isNull();
    }

    @Test
    @DisplayName("parseDate retourne null pour une date mal formatée")
    void parseMalformedDate() {
        assertThat(ChessMateETL.parseDate("2024/09/18")).isNull();
    }

    @Test
    @DisplayName("parseTimestamp parse correctement date et heure")
    void parseValidTimestamp() {
        Timestamp result = ChessMateETL.parseTimestamp("2024.09.18", "14:30:00");
        assertThat(result).isNotNull();
        assertThat(result.toString()).startsWith("2024-09-18 14:30:00");
    }

    @Test
    @DisplayName("parseTimestamp utilise 00:00:00 si heure null")
    void parseTimestampWithNullTime() {
        Timestamp result = ChessMateETL.parseTimestamp("2024.09.18", null);
        assertThat(result).isNotNull();
        assertThat(result.toString()).startsWith("2024-09-18 00:00:00");
    }

    @Test
    @DisplayName("parseTimestamp retourne null si date null")
    void parseTimestampWithNullDate() {
        assertThat(ChessMateETL.parseTimestamp(null, "14:30:00")).isNull();
    }

    @Test
    @DisplayName("parseTimestamp gère les heures avec secondes")
    void parseTimestampWithSeconds() {
        Timestamp result = ChessMateETL.parseTimestamp("2024.09.18", "14:30:45");
        assertThat(result).isNotNull();
        assertThat(result.toString()).startsWith("2024-09-18 14:30:45");
    }

    @Test
    @DisplayName("truncate tronque une chaîne trop longue")
    void truncateLongString() {
        String result = ChessMateETL.truncate("abcdefghij", 5);
        assertThat(result).isEqualTo("abcde");
    }

    @Test
    @DisplayName("truncate ne modifie pas une chaîne courte")
    void truncateShortString() {
        String result = ChessMateETL.truncate("abc", 5);
        assertThat(result).isEqualTo("abc");
    }

    @Test
    @DisplayName("truncate gère une chaîne de longueur exacte")
    void truncateExactLength() {
        String result = ChessMateETL.truncate("abcde", 5);
        assertThat(result).isEqualTo("abcde");
    }

    @Test
    @DisplayName("truncate retourne null pour null")
    void truncateNull() {
        assertThat(ChessMateETL.truncate(null, 5)).isNull();
    }

    @Test
    @DisplayName("truncate gère une chaîne vide")
    void truncateEmptyString() {
        String result = ChessMateETL.truncate("", 5);
        assertThat(result).isEqualTo("");
    }

    @Test
    @DisplayName("cleanPgn nettoie les espaces multiples")
    void cleanPgnMultipleSpaces() {
        String result = ChessMateETL.cleanPgn("e4   e5  Nf3");
        assertThat(result).isEqualTo("e4 e5 Nf3");
    }

    @Test
    @DisplayName("cleanPgn nettoie les retours à la ligne")
    void cleanPgnNewlines() {
        String result = ChessMateETL.cleanPgn("e4\ne5\nNf3");
        assertThat(result).isEqualTo("e4 e5 Nf3");
    }

    @Test
    @DisplayName("cleanPgn retire les espaces de début et fin")
    void cleanPgnTrim() {
        String result = ChessMateETL.cleanPgn("  e4 e5  ");
        assertThat(result).isEqualTo("e4 e5");
    }

    @Test
    @DisplayName("cleanPgn retourne null pour null")
    void cleanPgnNull() {
        assertThat(ChessMateETL.cleanPgn(null)).isNull();
    }

    @Test
    @DisplayName("cleanPgn gère une chaîne vide")
    void cleanPgnEmpty() {
        String result = ChessMateETL.cleanPgn("");
        assertThat(result).isEqualTo("");
    }

    @Test
    @DisplayName("cleanPgn gère les tabulations")
    void cleanPgnWithTabs() {
        String result = ChessMateETL.cleanPgn("e4\te5\tNf3");
        assertThat(result).isEqualTo("e4 e5 Nf3");
    }

    @Test
    @DisplayName("cleanPgn ne modifie pas une chaîne déjà propre")
    void cleanPgnAlreadyClean() {
        String result = ChessMateETL.cleanPgn("e4 e5 Nf3");
        assertThat(result).isEqualTo("e4 e5 Nf3");
    }

    @Test
    @DisplayName("normalizeCadence normalise correctement une cadence complexe")
    void normalizeCadenceComplex() {
        String result = ChessMateETL.normalizeCadence("90minutes + 30 seconds");
        assertThat(result).isEqualTo("90+30");
    }

    @Test
    @DisplayName("normalizeCadence garde le format déjà normalisé")
    void normalizeCadenceAlreadyNormalized() {
        String result = ChessMateETL.normalizeCadence("300+2");
        assertThat(result).isEqualTo("300+2");
    }

    @Test
    @DisplayName("normalizeCadence retourne null pour null")
    void normalizeCadenceNull() {
        assertThat(ChessMateETL.normalizeCadence(null)).isNull();
    }

    @Test
    @DisplayName("normalizeCadence supprime les lettres")
    void normalizeCadenceRemoveLetters() {
        String result = ChessMateETL.normalizeCadence("10min+5sec");
        assertThat(result).isEqualTo("10+5");
    }

    @Test
    @DisplayName("normalizeCadence gère une cadence sans incrément")
    void normalizeCadenceNoIncrement() {
        String result = ChessMateETL.normalizeCadence("300");
        assertThat(result).isEqualTo("300");
    }

    @Test
    @DisplayName("escapeCsv échappe les virgules")
    void escapeCsvWithComma() {
        String result = ChessMateETL.escapeCsv("Hello, World");
        assertThat(result).isEqualTo("\"Hello, World\"");
    }

    @Test
    @DisplayName("escapeCsv échappe les guillemets")
    void escapeCsvWithQuotes() {
        String result = ChessMateETL.escapeCsv("Say \"Hello\"");
        assertThat(result).isEqualTo("\"Say \"\"Hello\"\"\"");
    }

    @Test
    @DisplayName("escapeCsv échappe les retours à la ligne")
    void escapeCsvWithNewline() {
        String result = ChessMateETL.escapeCsv("Line1\nLine2");
        assertThat(result).isEqualTo("\"Line1\nLine2\"");
    }

    @Test
    @DisplayName("escapeCsv ne modifie pas une chaîne simple")
    void escapeCsvSimple() {
        String result = ChessMateETL.escapeCsv("HelloWorld");
        assertThat(result).isEqualTo("HelloWorld");
    }

    @Test
    @DisplayName("escapeCsv retourne \\N pour null")
    void escapeCsvNull() {
        String result = ChessMateETL.escapeCsv(null);
        assertThat(result).isEqualTo("\\N");
    }

    @Test
    @DisplayName("escapeCsv gère une chaîne vide")
    void escapeCsvEmpty() {
        String result = ChessMateETL.escapeCsv("");
        assertThat(result).isEqualTo("");
    }

    @Test
    @DisplayName("escapeCsv gère plusieurs caractères spéciaux")
    void escapeCsvMultipleSpecialChars() {
        String result = ChessMateETL.escapeCsv("Hello, \"World\"\nTest");
        assertThat(result).isEqualTo("\"Hello, \"\"World\"\"\nTest\"");
    }
}