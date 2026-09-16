package com.chessmate.backend.dto;

public record BestMoveDTO(
    String phase,
    String coup,
    int parties,
    double winrate
) {}

