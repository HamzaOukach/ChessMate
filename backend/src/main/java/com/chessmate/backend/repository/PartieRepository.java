package com.chessmate.backend.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.Partie;

public interface PartieRepository extends JpaRepository<Partie, Long>{
    Optional<Partie> findByTitle(String title);   // recherche par titre 

    @Query("SELECT p FROM Partie p WHERE p.dateHeureUTC = :dt")
    List<Partie> findAllPartiesByDateHeureUTC(@Param("dt") LocalDateTime dt);  // recherche par date creation
    
    @Query("SELECT p FROM Partie p WHERE p.typeResultat = :res")
    List<Partie> findAllPartiesByTypeResultat(@Param("res") String type_r);  // recherche par type de resultat

    @Query(value = """
    SELECT COUNT(*) FROM (
        SELECT id FROM partie WHERE id_joueur_blanc = :joueurId
        UNION ALL
        SELECT id FROM partie WHERE id_joueur_noir = :joueurId
    ) t
    """, nativeQuery = true)
    Integer getNbPartiesByJoueur(@Param("joueurId") Long joueurId);

    @Query(value = """
    SELECT 
        ROUND(
            SUM(CASE 
                WHEN id_joueur_blanc = :joueurId AND resultat = 2 THEN 1
                WHEN id_joueur_noir = :joueurId AND resultat = 0 THEN 1
                ELSE 0
            END) * 100.0 / NULLIF(COUNT(*), 0)
        ) AS taux_victoire
    FROM partie
    WHERE id_joueur_blanc = :joueurId
    OR id_joueur_noir = :joueurId
    """, nativeQuery = true)
    Double getTauxVictoireJoueur(@Param("joueurId") Long joueurId);

    @Query(value = """
        SELECT 
            DATE_TRUNC('month', p.date_heure_utc) AS mois_debut,
            
            SUM(CASE 
                WHEN (p.id_joueur_blanc = :joueurId AND p.resultat = 2)
                OR (p.id_joueur_noir = :joueurId AND p.resultat = 0)
                THEN 1 ELSE 0
            END) AS nb_victoires,

            SUM(CASE 
                WHEN (p.id_joueur_blanc = :joueurId AND p.resultat = 0)
                OR (p.id_joueur_noir = :joueurId AND p.resultat = 2)
                THEN 1 ELSE 0
            END) AS nb_defaites,

            SUM(CASE 
                WHEN p.resultat = 1
                THEN 1 ELSE 0
            END) AS nb_nulles

        FROM partie p
        WHERE p.id_joueur_blanc = :joueurId
        OR p.id_joueur_noir = :joueurId
        GROUP BY mois_debut
        ORDER BY mois_debut
        """, nativeQuery = true)
    List<Object[]> getPerformanceMensuelle(@Param("joueurId") Long joueurId);
    
        

    @Query(value = """
        SELECT 
            p.id,
            p.date_heure_utc,
            CASE 
                WHEN p.id_joueur_blanc = :joueurId THEN jNoir.pseudonyme
                ELSE jBlanc.pseudonyme
            END AS adversaire,
            CASE 
                WHEN p.id_joueur_blanc = :joueurId AND p.resultat = 2 THEN 'Victoire'
                WHEN p.id_joueur_noir = :joueurId AND p.resultat = 0 THEN 'Victoire'
                WHEN p.id_joueur_blanc = :joueurId AND p.resultat = 0 THEN 'Défaite'
                WHEN p.id_joueur_noir = :joueurId AND p.resultat = 2 THEN 'Défaite'
                ELSE 'Nulle'
            END AS resultat,
            CASE
                WHEN p.id_joueur_blanc = :joueurId THEN p.elo_blanc
                ELSE p.elo_noir
            END AS elo_joueur
        FROM partie p
        JOIN joueur jBlanc ON p.id_joueur_blanc = jBlanc.id
        JOIN joueur jNoir ON p.id_joueur_noir = jNoir.id
        WHERE p.id_joueur_blanc = :joueurId
        OR p.id_joueur_noir = :joueurId
        ORDER BY p.date_heure_utc DESC
        """, nativeQuery = true)
    List<Object[]> getLastParties(@Param("joueurId") Long joueurId);

    @Query(value = """
        SELECT
            SUM(CASE WHEN id_joueur_blanc = :joueurId THEN 1 ELSE 0 END) AS nb_blanc,
            SUM(CASE WHEN id_joueur_noir  = :joueurId THEN 1 ELSE 0 END) AS nb_noir,
            SUM(CASE WHEN id_joueur_blanc = :joueurId AND resultat = 2 THEN 1 ELSE 0 END) AS wins_blanc,
            SUM(CASE WHEN id_joueur_noir  = :joueurId AND resultat = 0 THEN 1 ELSE 0 END) AS wins_noir,
            SUM(CASE WHEN id_joueur_blanc = :joueurId AND resultat = 1 THEN 1 ELSE 0 END) AS nulls_blanc,
            SUM(CASE WHEN id_joueur_noir  = :joueurId AND resultat = 1 THEN 1 ELSE 0 END) AS nulls_noir
        FROM partie
        WHERE id_joueur_blanc = :joueurId OR id_joueur_noir = :joueurId
        """, nativeQuery = true)
    List<Object[]> getStatsCouleur(@Param("joueurId") Long joueurId);

    @Query("""
        SELECT p FROM Partie p
        WHERE p.joueurBlanc.id = :joueurId
        OR p.joueurNoir.id = :joueurId
        """)
    List<Partie> findAllByJoueur(@Param("joueurId") Long joueurId);
    
    @Query(value = """
        WITH total_parties AS (
            SELECT COUNT(*) AS total
            FROM partie
            WHERE id_joueur_blanc = :joueurId
            OR id_joueur_noir = :joueurId
        )
        SELECT 
            o.libelle,
            COUNT(p.id) AS nb_parties,
            SUM(
                CASE 
                    WHEN (p.id_joueur_blanc = :joueurId AND p.resultat = 2)
                    OR (p.id_joueur_noir = :joueurId AND p.resultat = 0)
                    THEN 1 ELSE 0
                END
            ) * 100.0 / COUNT(p.id) AS winrate,
            COUNT(p.id) * 100.0 / tp.total AS utilisation
        FROM partie p
        JOIN ouverture o ON p.id_ouverture = o.id
        CROSS JOIN total_parties tp
        WHERE p.id_joueur_blanc = :joueurId
        OR p.id_joueur_noir = :joueurId
        GROUP BY o.libelle, tp.total
        HAVING COUNT(p.id) >= GREATEST(1, tp.total * 0.01)
        ORDER BY nb_parties DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> getStatsOuvertures(@Param("joueurId") Long joueurId, @Param("limit") int limit);

    @Query("""
        SELECT p FROM Partie p
        LEFT JOIN FETCH p.joueurBlanc
        LEFT JOIN FETCH p.joueurNoir
        LEFT JOIN FETCH p.tournoi
        LEFT JOIN FETCH p.cadence
        LEFT JOIN FETCH p.ouverture
        WHERE p.id = :id
        """)
    Optional<Partie> findInfoPartie(@Param("id") Long id);

    //recuperer tout les pgn des parties d'un  joueur
    @Query("""
    SELECT p.pgn, p.joueurBlanc.id
    FROM Partie p
    WHERE p.joueurBlanc.id = :joueurId
        OR p.joueurNoir.id = :joueurId
    """)
    List<Object[]> findAllPgnByJoueur(@Param("joueurId") Long joueurId);

    // Pour le worker : on renvoie une List car le retour de @Query avec plusieurs colonnes
    // est plus stable sous forme de List<Object[]> qu'avec Optional.
    @Query("""
        SELECT p.pgn, p.joueurBlanc.id
        FROM Partie p
        WHERE p.id = :partieId
    """)
    List<Object[]> findPgnAndWhiteIdById(@Param("partieId") Long partieId);

    List<Partie> findByJoueurBlancPseudonymeIgnoreCaseOrJoueurNoirPseudonymeIgnoreCase(String pseudo1, String pseudo2);
}
