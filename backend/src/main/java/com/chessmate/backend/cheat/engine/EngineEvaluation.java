package com.chessmate.backend.cheat.engine;

public class EngineEvaluation {

    private final String bestMove;
    private final Integer evaluationCp;
    private final boolean mateScore;

    public EngineEvaluation(String bestMove, Integer evaluationCp, boolean mateScore) {
        this.bestMove = bestMove;
        this.evaluationCp = evaluationCp;
        this.mateScore = mateScore;
    }

    public String getBestMove() {
        return bestMove;
    }

    public Integer getEvaluationCp() {
        return evaluationCp;
    }

    public boolean isMateScore() {
        return mateScore;
    }
}