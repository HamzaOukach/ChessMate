package com.chessmate.backend.cheat.model;

public class CheatSignal {
    private final String name;
    private final double score; // 0..100
    private final String details;

    public CheatSignal(String name, double score, String details) {
        this.name = name;
        this.score = score;
        this.details = details;
    }

    public String getName() { return name; }
    public double getScore() { return score; }
    public String getDetails() { return details; }
}
