package com.chessmate.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.OnlinePartie;
import com.chessmate.backend.entiter.Joueur;

public interface OnlinePartieRepository extends JpaRepository<OnlinePartie, Long> {

    @Query("SELECT p FROM OnlinePartie p WHERE p.joueurBlanc = :joueur OR p.joueurNoir = :joueur ORDER BY p.playedAt DESC")
    List<OnlinePartie> findByJoueur(@Param("joueur") Joueur joueur);

    java.util.Optional<OnlinePartie> findByGameId(String gameId);
}
