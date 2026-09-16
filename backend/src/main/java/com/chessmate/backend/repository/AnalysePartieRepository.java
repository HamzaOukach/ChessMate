package com.chessmate.backend.repository;

import com.chessmate.backend.entiter.AnalysePartie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnalysePartieRepository extends JpaRepository<AnalysePartie, Long> {
    Optional<AnalysePartie> findByPartieIdAndJoueurId(Long partieId, Long joueurId);

    /**
     * Récupère toutes les analyses pour un joueur donné.
     */
    @Query("""
        SELECT a
        FROM AnalysePartie a
        WHERE a.joueurId = :joueurId
        """)
    List<AnalysePartie> findAllByJoueurId(@Param("joueurId") Long joueurId);

    /**
     * Récupère tout les ids des parties pour un joueur donné.
     */
    @Query("""
        SELECT a.partieId
        FROM AnalysePartie a
        WHERE a.joueurId = :joueurId
        """)
    List<Long> findAllPartieIdsByJoueurId(@Param("joueurId") Long joueurId);

    boolean existsByPartieIdAndJoueurId(Long partieId, Long joueurId);
}