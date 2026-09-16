package com.chessmate;

import org.junit.jupiter.api.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

public class RemplissageCacheTest extends BaseIntegrationTest {

    @Test
    @DisplayName("remplissageCache() charge correctement les cadences")
    public void testRemplissageCache_Cadences() throws SQLException {
        ChessMateETL.remplissageCache(connection);

        assertEquals(3, ChessMateETL.cadences.size(), "Devrait charger 3 cadences");
        assertTrue(ChessMateETL.cadences.containsKey("180+2"));
        assertTrue(ChessMateETL.cadences.containsKey("300+0"));
        assertTrue(ChessMateETL.cadences.containsKey("600+5"));
    }

    @Test
    @DisplayName("remplissageCache() charge correctement les ouvertures")
    public void testRemplissageCache_Ouvertures() throws SQLException {
        ChessMateETL.remplissageCache(connection);

        assertEquals(3, ChessMateETL.ouvertures.size(), "Devrait charger 3 ouvertures");
        assertTrue(ChessMateETL.ouvertures.containsKey("C42|Petrov Defense"));
        assertTrue(ChessMateETL.ouvertures.containsKey("E60|King's Indian Defense"));
        assertTrue(ChessMateETL.ouvertures.containsKey("C65|Ruy Lopez, Berlin Defense"));
    }

    @Test
    @DisplayName("remplissageCache() fonctionne avec des tables vides")
    public void testRemplissageCache_TablesVides() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("DELETE FROM Ouverture");
            stmt.execute("DELETE FROM cadence");
            connection.commit();
        }

        ChessMateETL.remplissageCache(connection);

        assertEquals(0, ChessMateETL.cadences.size());
        assertEquals(0, ChessMateETL.ouvertures.size());
    }
}