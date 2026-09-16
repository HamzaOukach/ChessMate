package com.chessmate.backend.dto;

public record PerformanceMensuelleDTO(
    int annee,
    int mois_numero,
    String mois,
    Long victoires,
    Long defaites,
    Long nulles
) {}
