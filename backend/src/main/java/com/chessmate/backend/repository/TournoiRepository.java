package com.chessmate.backend.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.Tournoi;

public interface TournoiRepository extends JpaRepository<Tournoi, Long>{
    Optional<Tournoi> findByCode(String code);  // recherche par code
    Optional<Tournoi> findByLibelle(String libelle);  // recherche par libelle
    
    @Query("SELECT t FROM Tournoi t WHERE t.creeA = :date")
    List<Tournoi> findAllTournoisByCreeA(@Param("date") LocalDateTime dt);  // recherche par date creation
    
    @Query("SELECT t FROM Tournoi t WHERE t.dateDebut = :date")
    List<Tournoi> findAllTournoisByDateDebut(@Param("date") LocalDateTime dt);  // recherche par date debut
    
    @Query("SELECT t FROM Tournoi t WHERE t.modifierA = :date")
    List<Tournoi> findAllTournoisByModifierA(@Param("date") LocalDateTime dt);  // recherche par date ou le tournoi a été modifier
}
