package com.chessmate.backend.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.Utilisateur;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long>{
    Optional<Utilisateur> findByEmail(String email);  // recherche par émail

    @Query("SELECT u FROM Utilisateur u WHERE u.inscriptionA = :date")
    List<Utilisateur> findByInscriptionA(@Param("date") LocalDateTime dt);  // recherche par date inscription

    @Query("SELECT u FROM Utilisateur u WHERE u.connexionA = :date")
    List<Utilisateur> findByConnexionA(@Param("date") LocalDateTime dt);  // recherche par date de connexion

    @Query("SELECT u FROM Utilisateur u WHERE u.banniA = :date")
    List<Utilisateur> findByBanniA(@Param("date") LocalDateTime dt);   // recherche par date banni

    @Query("""
        SELECT u.joueur.id
        FROM Utilisateur u
        WHERE u.joueur IS NOT NULL
        """)
    List<Long> findAllJoueurIds();

}
