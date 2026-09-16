package com.chessmate.backend.dto;


public record PartiesResumeDTO(
    Long id,
    String dates,
    String adversaire,
    String resultat,
    double precision
) {}
