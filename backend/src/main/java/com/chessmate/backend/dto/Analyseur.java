package com.chessmate.backend.dto;

public class Analyseur {
    private String bestMove;
    private int eval;

    public Analyseur(String bestMove, int eval) {
        this.bestMove = bestMove;
        this.eval = eval;
    }

    public String getBestMove() {
        return bestMove;
    }

    public int getEval() {
        return eval;
    }

    public void setBestMove(String bt)
    {
        this.bestMove = bt;
    }

    public void setEval(int eval)
    {
        this.eval = eval;
    }
}
