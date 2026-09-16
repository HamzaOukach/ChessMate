package com.chessmate.backend.cheat.model;

public class PlayerCheatSummary {

    private final String color;
    private final double score;
    private final String verdict;

    public PlayerCheatSummary(String color, double score, String verdict) {
        this.color = color;
        this.score = score;
        this.verdict = verdict;
    }

    public String getColor() {
        return color;
    }

    public double getScore() {
        return score;
    }

    public String getVerdict() {
        return verdict;
    }
}