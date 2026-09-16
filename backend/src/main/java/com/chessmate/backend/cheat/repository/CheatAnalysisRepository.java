package com.chessmate.backend.cheat.repository;

import com.chessmate.backend.cheat.entity.CheatAnalysisEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CheatAnalysisRepository extends JpaRepository<CheatAnalysisEntity, Long> {
}