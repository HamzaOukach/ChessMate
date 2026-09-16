package com.chessmate.backend.cheat.engine;

import java.util.List;

public class EngineMoveAnalysis {
    private final String bestMove;      // top1
    private final List<String> topMoves; // topN (ex: top3/top5)

    public EngineMoveAnalysis(String bestMove, List<String> topMoves) {
        this.bestMove = bestMove;
        this.topMoves = topMoves;
    }

    public String getBestMove() {
        return bestMove;
    }

    public List<String> getTopMoves() {
        return topMoves;
    }
}
