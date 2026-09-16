package com.chessmate.backend.cheat.engine;

import java.util.function.Function;

public class EngineOracle {

    private final Function<String, EngineMoveAnalysis> analyzeFenFn;
    private final Function<String, EngineEvaluation> evaluateFenFn;

    public EngineOracle(Function<String, EngineMoveAnalysis> analyzeFenFn,
                        Function<String, EngineEvaluation> evaluateFenFn) {
        this.analyzeFenFn = analyzeFenFn;
        this.evaluateFenFn = evaluateFenFn;
    }

    public EngineMoveAnalysis analyzeFen(String fen) {
        return analyzeFenFn.apply(fen);
    }

    public EngineEvaluation evaluateFen(String fen) {
        return evaluateFenFn.apply(fen);
    }
}