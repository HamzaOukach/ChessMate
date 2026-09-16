
import java.sql.*;

public class CheckData {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:postgresql://localhost:5432/chessmate";
        String user = "postgres";
        String password = "password";

        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            System.out.println("Connected to database.");

            // Find joueur 'aa'
            long joueurId = -1;
            String pseudo = "aa";
            try (PreparedStatement ps = conn.prepareStatement("SELECT id FROM joueur WHERE pseudo = ?")) {
                ps.setString(1, pseudo);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    joueurId = rs.getLong("id");
                    System.out.println("Found joueur 'aa' with ID: " + joueurId);
                } else {
                    System.out.println("Joueur 'aa' not found.");
                }
            }

            if (joueurId != -1) {
                // Count in partie
                try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM partie WHERE id_joueur_blanc = ? OR id_joueur_noir = ?")) {
                    ps.setLong(1, joueurId);
                    ps.setLong(2, joueurId);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) System.out.println("Partie table: " + rs.getInt(1));
                }

                // Count in online_partie
                try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM online_partie WHERE id_joueur_blanc = ? OR id_joueur_noir = ?")) {
                    ps.setLong(1, joueurId);
                    ps.setLong(2, joueurId);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) System.out.println("OnlinePartie table: " + rs.getInt(1));
                }

                // Count in partie_jouee
                try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM partie_jouee WHERE joueur_blanc = ? OR joueur_noir = ?")) {
                    ps.setString(1, pseudo);
                    ps.setString(2, pseudo);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) System.out.println("PartieJouee table: " + rs.getInt(1));
                }
            }
        }
    }
}
