package com.chessmate.backend.cheat.model;

import java.util.List;

public class CheatReport {

    private final double score;
    private final String verdict;
    private final List<CheatSignal> signals;
    private final PlayerCheatSummary whiteSummary;
    private final PlayerCheatSummary blackSummary;
    private final boolean reliable;
    private final String reliabilityMessage;

    public CheatReport(double score,
                       String verdict,
                       List<CheatSignal> signals,
                       PlayerCheatSummary whiteSummary,
                       PlayerCheatSummary blackSummary,
                       boolean reliable,
                       String reliabilityMessage) {
        this.score = score;
        this.verdict = verdict;
        this.signals = signals;
        this.whiteSummary = whiteSummary;
        this.blackSummary = blackSummary;
        this.reliable = reliable;
        this.reliabilityMessage = reliabilityMessage;
    }

    public double getScore() {
        return score;
    }

    public String getVerdict() {
        return verdict;
    }

    public List<CheatSignal> getSignals() {
        return signals;
    }

    public PlayerCheatSummary getWhiteSummary() {
        return whiteSummary;
    }

    public PlayerCheatSummary getBlackSummary() {
        return blackSummary;
    }

    public boolean isReliable() {
        return reliable;
    }

    public String getReliabilityMessage() {
        return reliabilityMessage;
    }
}