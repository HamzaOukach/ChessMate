package com.chessmate.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

import com.chessmate.backend.entiter.PartieJouee;

public interface PartieJoueeRepository extends JpaRepository<PartieJouee, Long> {
    List<PartieJouee> findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(String joueurBlanc, String joueurNoir);
}