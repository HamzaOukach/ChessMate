package com.chessmate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;

import java.util.HashMap;

/**
 * Tests unitaires pour les fonctions de cache (cadence et ouverture)
 */
@DisplayName("Tests des fonctions de cache")
class CacheTest {

    @BeforeEach
    void setUp() {
        // Réinitialiser les caches avant chaque test
        ChessMateETL.cadences = new HashMap<>();
        ChessMateETL.ouvertures = new HashMap<>();
    }

    @Test
    @DisplayName("getIdCadence retourne l'ID correct pour une cadence connue")
    void getIdCadenceKnown() {
        ChessMateETL.cadences.put("300+2", 1);
        ChessMateETL.cadences.put("180+0", 2);

        Integer result = ChessMateETL.getIdCadence("300+2");
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdCadence normalise avant de chercher")
    void getIdCadenceNormalized() {
        ChessMateETL.cadences.put("300+2", 1);

        Integer result = ChessMateETL.getIdCadence("300minutes + 2 seconds");
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdCadence retourne null pour une cadence inconnue")
    void getIdCadenceUnknown() {
        ChessMateETL.cadences.put("300+2", 1);

        Integer result = ChessMateETL.getIdCadence("600+5");
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("getIdCadence retourne null pour null")
    void getIdCadenceNull() {
        Integer result = ChessMateETL.getIdCadence(null);
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("getIdOuverture retourne l'ID avec code et libellé exacts")
    void getIdOuvertureExactMatch() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);
        ChessMateETL.ouvertures.put("E4|King's Pawn Opening", 2);

        Integer result = ChessMateETL.getIdOuverture("C65", "Ruy Lopez, Berlin Defense");
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdOuverture retourne l'ID avec seulement le code ECO")
    void getIdOuvertureCodeOnly() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Variation A", 2);

        // Si le libellé ne correspond pas exactement, prend le premier avec le bon code
        Integer result = ChessMateETL.getIdOuverture("C65", "Autre Variation");
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdOuverture retourne l'ID avec libellé null")
    void getIdOuvertureNullLibelle() {
        ChessMateETL.ouvertures.put("E4|King's Pawn Opening", 1);

        Integer result = ChessMateETL.getIdOuverture("E4", null);
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdOuverture retourne l'ID avec libellé vide")
    void getIdOuvertureEmptyLibelle() {
        ChessMateETL.ouvertures.put("E4|King's Pawn Opening", 1);

        Integer result = ChessMateETL.getIdOuverture("E4", "");
        assertThat(result).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdOuverture retourne null pour code ECO inconnu")
    void getIdOuvertureUnknownCode() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);

        Integer result = ChessMateETL.getIdOuverture("A00", "Uncommon Opening");
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("getIdOuverture retourne null pour code ECO null")
    void getIdOuvertureNullCode() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);

        Integer result = ChessMateETL.getIdOuverture(null, "Some Opening");
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("getIdOuverture privilégie la correspondance exacte")
    void getIdOuverturePreferExactMatch() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Variation A", 2);

        Integer result = ChessMateETL.getIdOuverture("C65", "Ruy Lopez, Variation A");
        assertThat(result).isEqualTo(2);
    }

    @Test
    @DisplayName("getIdOuverture gère plusieurs ouvertures avec même code")
    void getIdOuvertureMultipleSameCode() {
        ChessMateETL.ouvertures.put("C65|Berlin Defense", 1);
        ChessMateETL.ouvertures.put("C65|Rio de Janeiro Variation", 2);
        ChessMateETL.ouvertures.put("C65|Mortimer Trap", 3);

        // Sans correspondance exacte, doit retourner le premier trouvé
        Integer result = ChessMateETL.getIdOuverture("C65", "Unknown Variation");
        assertThat(result).isNotNull();
        assertThat(result).isIn(1, 2, 3);
    }

    @Test
    @DisplayName("Cache vide retourne null pour cadence")
    void emptyCacheReturnsNullForCadence() {
        Integer result = ChessMateETL.getIdCadence("300+2");
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("Cache vide retourne null pour ouverture")
    void emptyCacheReturnsNullForOuverture() {
        Integer result = ChessMateETL.getIdOuverture("C65", "Ruy Lopez");
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("getIdCadence gère plusieurs formats de même cadence")
    void getIdCadenceMultipleFormats() {
        ChessMateETL.cadences.put("300+2", 1);

        // Tous ces formats doivent être normalisés vers "300+2"
        assertThat(ChessMateETL.getIdCadence("300+2")).isEqualTo(1);
        assertThat(ChessMateETL.getIdCadence("300 + 2")).isEqualTo(1);
        assertThat(ChessMateETL.getIdCadence("300minutes+2seconds")).isEqualTo(1);
    }

    @Test
    @DisplayName("getIdOuverture est sensible à la casse pour le libellé")
    void getIdOuvertureCaseSensitive() {
        ChessMateETL.ouvertures.put("C65|Ruy Lopez, Berlin Defense", 1);

        // Correspondance exacte attendue (sensible à la casse)
        Integer result = ChessMateETL.getIdOuverture("C65", "ruy lopez, berlin defense");
        // Ne devrait pas trouver de correspondance exacte, donc retourne le premier
        // avec C65
        assertThat(result).isEqualTo(1);
    }
}