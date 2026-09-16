package com.chessmate.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.Profil;

public interface ProfilRepository extends JpaRepository<Profil, Long>{
    Optional<Profil> findByLibelle(String libelle); // recherche par libelle
}
