package com.chessmate.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.PositionStats;

public interface PositionStatsRepository extends JpaRepository<PositionStats, Long> {
    Optional<PositionStats> findByFen(String fen);  // recherche par fen
}
