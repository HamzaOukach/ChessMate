package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;

import java.util.List;

public class BlackEngineMatchRateDetector implements CheatDetector {

    private final int topN;

    public BlackEngineMatchRateDetector() {
        this(3);
    }

    public BlackEngineMatchRateDetector(int topN) {
        this.topN = topN;
    }

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        List<String> moves = game.getUciMoves();

        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("BlackEngineMatchRate", 0, "No moves to analyze");
        }

        Board board = new Board();
        int matches = 0;
        int checked = 0;

        for (int i = 0; i < moves.size(); i++) {
            String uci = moves.get(i);
            boolean isBlackMove = (i % 2 == 1);

            if (isBlackMove) {
                String fenBefore = board.getFen();
                EngineMoveAnalysis analysis = oracle.analyzeFen(fenBefore);

                if (analysis != null) {
                    checked++;
                    List<String> topMoves = analysis.getTopMoves();
                    if (topMoves != null && topMoves.stream().limit(topN)
                            .anyMatch(m -> m.equalsIgnoreCase(uci))) {
                        matches++;
                    }
                }
            }

            try {
                var move = UciMoveParser.toMove(uci, board.getSideToMove());

                if (!board.isMoveLegal(move, true)) {
                    return new CheatSignal(
                            "BlackEngineMatchRate",
                            0,
                            "Illegal move at ply " + (i + 1) + ": " + uci
                    );
                }

                board.doMove(move);
            } catch (Exception e) {
                return new CheatSignal(
                        "BlackEngineMatchRate",
                        0,
                        "Invalid move sequence at ply " + (i + 1) + ": " + uci + " (" + e.getMessage() + ")"
                );
            }
        }

        double rate = checked == 0 ? 0 : (matches * 1.0 / checked);

        // Taux attendu de match Top-3 selon l'Elo du joueur noir
        double elo = game.getEloBlack();
        double expectedRate = Math.min(0.80, 0.28 + elo * 0.00019);

        double delta = rate - expectedRate;
        double suspicionScore = 100.0 / (1.0 + Math.exp(-delta * 12.0));
        suspicionScore = Math.max(2.0, Math.min(98.0, suspicionScore));

        String details = String.format(
            "Top%d black match rate: %d/%d = %d%% (Elo %d → attendu %.0f%%)",
            topN, matches, checked, Math.round(rate * 100), (int) elo, expectedRate * 100
        );

        return new CheatSignal("BlackEngineMatchRate", suspicionScore, details);
    }
}