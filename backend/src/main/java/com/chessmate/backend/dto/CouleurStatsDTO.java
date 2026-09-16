package com.chessmate.backend.dto;

public record CouleurStatsDTO(
    int nbPartiesBlanc,
    int nbPartiesNoir,
    double winRateBlanc,
    double winRateNoir,
    double nullRateBlanc,
    double nullRateNoir
) {}
