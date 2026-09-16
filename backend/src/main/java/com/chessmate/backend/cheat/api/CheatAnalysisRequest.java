package com.chessmate.backend.cheat.api;

public class CheatAnalysisRequest {

    private String pgn;
    private double eloWhite = 1500;
    private double eloBlack = 1500;

    public CheatAnalysisRequest() {
    }

    public String getPgn() {
        return pgn;
    }

    public void setPgn(String pgn) {
        this.pgn = pgn;
    }

    public double getEloWhite() {
        return eloWhite;
    }

    public void setEloWhite(double eloWhite) {
        this.eloWhite = eloWhite;
    }

    public double getEloBlack() {
        return eloBlack;
    }

    public void setEloBlack(double eloBlack) {
        this.eloBlack = eloBlack;
    }
}