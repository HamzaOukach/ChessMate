package com.chessmate.backend.cheat.model;

import java.util.List;

public class PGNParseResult {
    private final List<String> uciMoves;
    private final String finalFen;

    public PGNParseResult(List<String> uciMoves, String finalFen) {
        this.uciMoves = uciMoves;
        this.finalFen = finalFen;
    }

    public List<String> getUciMoves() {
        return uciMoves;
    }

    public String getFinalFen() {
        return finalFen;
    }
}
