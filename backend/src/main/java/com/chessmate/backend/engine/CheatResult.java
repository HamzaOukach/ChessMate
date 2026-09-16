package com.chessmate.backend.engine;

public class CheatResult {

    private double acpl;
    private double top1Percent;
    private int suspicionScore;
    private Verdict verdict;

    public CheatResult(double acpl, double top1Percent, int suspicionScore, Verdict verdict) {
        this.acpl = acpl;
        this.top1Percent = top1Percent;
        this.suspicionScore = suspicionScore;
        this.verdict = verdict;
    }

    public double getAcpl() { return acpl; }
    public double getTop1Percent() { return top1Percent; }
    public int getSuspicionScore() { return suspicionScore; }
    public Verdict getVerdict() { return verdict; }
}