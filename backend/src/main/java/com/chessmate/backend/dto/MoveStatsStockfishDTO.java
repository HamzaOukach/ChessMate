package com.chessmate.backend.dto;

public record MoveStatsStockfishDTO(
    String moveUci,
    Long count,
    Double avgAccuracy,
    Double engineMatchRate
) {}
