package com.chessmate.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.SuiteCoupsStats;

public interface SuiteCoupsStatsRepository extends JpaRepository<SuiteCoupsStats, Long> {
    
}
