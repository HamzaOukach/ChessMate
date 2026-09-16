package com.chessmate.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.Cadence;
import com.chessmate.backend.entiter.Cadence.CategorieCadence;

public interface CadenceRepository  extends JpaRepository<Cadence, Long>{
    Optional<Cadence> findByLibelle(String lib);  // recherche par libelle
    List<Cadence> findByTemps(int t);  // recherche par temps
    List<Cadence> findByIncrement(int c);  // recherche par increment
    List<Cadence> findByTypePartie(CategorieCadence typePartie);  // recherche par type
}
