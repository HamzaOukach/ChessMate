package com.chessmate.backend.dto;

public record OuvertureStatsDTO(
    String ouverture,
    int parties,
    double winrate,
    double utilisation
) 
{}
