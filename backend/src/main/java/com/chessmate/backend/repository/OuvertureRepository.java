package com.chessmate.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.Ouverture;

public interface OuvertureRepository extends JpaRepository<Ouverture, Long>{
    List<Ouverture> findByCode(String code);  // recherche par code
    
}
