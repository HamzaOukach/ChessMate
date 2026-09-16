package com.chessmate.backend.cheat.model;

import java.util.ArrayList;
import java.util.List;

public class GameData {
    private final List<String> uciMoves;
    private final double eloWhite;
    private final double eloBlack;

    /** Constructeur rétrocompatible : Elo par défaut 1500 */
    public GameData(List<String> uciMoves) {
        this(uciMoves, 1500, 1500);
    }

    public GameData(List<String> uciMoves, double eloWhite, double eloBlack) {
        this.uciMoves = uciMoves;
        this.eloWhite = eloWhite;
        this.eloBlack = eloBlack;
    }

    public List<String> getUciMoves() {
        return uciMoves;
    }

    public double getEloWhite() {
        return eloWhite;
    }

    public double getEloBlack() {
        return eloBlack;
    }

    public List<String> getWhiteMoves() {
        List<String> whiteMoves = new ArrayList<>();
        for (int i = 0; i < uciMoves.size(); i += 2) {
            whiteMoves.add(uciMoves.get(i));
        }
        return whiteMoves;
    }

    public List<String> getBlackMoves() {
        List<String> blackMoves = new ArrayList<>();
        for (int i = 1; i < uciMoves.size(); i += 2) {
            blackMoves.add(uciMoves.get(i));
        }
        return blackMoves;
    }
}