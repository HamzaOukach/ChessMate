package com.chessmate.backend.repository;

import com.chessmate.backend.entiter.MoveAnalysis;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MoveAnalysisRepository extends JpaRepository<MoveAnalysis, Long> {
    //Match rate (engine match %) 
    @Query(value = """
        SELECT (SUM(CASE WHEN m.is_engine_match = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
        FROM move_analysis m
        WHERE m.joueur_id = :id
    """, nativeQuery = true)
    Double getEngineMatchRate(@Param("id") Long joueurId); 
    
    //accuracy moyenne par situation     
    @Query(value = """
        SELECT 
            CASE 
                WHEN m.eval_before > 200 THEN 'Winning'
                WHEN m.eval_before BETWEEN -200 AND 200 THEN 'Equal'
                WHEN m.eval_before < -200 THEN 'Under Pressure'
            END AS situation,
            AVG(m.accuracy_score)
        FROM move_analysis m
        WHERE m.joueur_id = :id
        GROUP BY situation
    """, nativeQuery = true)
    List<Object[]> getAccuracyBySituation(@Param("id") Long joueurId); 

        
    //Accuracy par batch (tranches) de parties  
    @Query(value = """
        SELECT
            CONCAT(
                (bucket - 1) * step + 1,
                '-',
                bucket * step
            ) AS game,
            AVG(accuracy_score) AS accuracy
        FROM (
            SELECT
                m.accuracy_score,
                NTILE(6) OVER (ORDER BY m.partie_id) AS bucket,
                COUNT(*) OVER () AS total
            FROM move_analysis m
            WHERE m.joueur_id = :id
        ) t
        CROSS JOIN LATERAL (
            SELECT CEIL(total / 6.0) AS step
        ) s
        GROUP BY bucket, step
        ORDER BY bucket
    """, nativeQuery = true)
    List<Object[]> getAccuracyOverTime(@Param("id") Long joueurId);


    //Analyse des coups les plus joués grace a stockfish 
    @Query(value = """
        SELECT 
            m.move_uci,
            COUNT(*),
            AVG(m.accuracy_score),
            (SUM(CASE WHEN m.is_engine_match = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
        FROM move_analysis m
        WHERE m.joueur_id = :id
        GROUP BY m.move_uci
        HAVING COUNT(*) > 5
        ORDER BY COUNT(*) DESC
        LIMIT 6
    """, nativeQuery = true)
    List<Object[]> getMoveStats(@Param("id") Long joueurId);


}