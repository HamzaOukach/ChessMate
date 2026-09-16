package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;

import java.util.List;

public class EngineMatchRateDetector implements CheatDetector {

    private final int topN;

    public EngineMatchRateDetector() { this(3); }
    public EngineMatchRateDetector(int topN) { this.topN = topN; }

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {

        List<String> moves = game.getUciMoves();
        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("EngineMatchRate", 0, "No moves to analyze");
        }

        Board board = new Board();

        int matches = 0;
        int checked = 0;

        for (String uci : moves) {
            String fenBefore = board.getFen();

            // 1) moteur sur la vraie position
            EngineMoveAnalysis analysis = oracle.analyzeFen(fenBefore);
            if (analysis != null) {
                checked++;
                List<String> topMoves = analysis.getTopMoves();
                if (topMoves != null && topMoves.stream().limit(topN).anyMatch(m -> m.equalsIgnoreCase(uci))) {
                    matches++;
                }
            }

            // 2) appliquer le coup pour avancer la position
            try {
                var move = UciMoveParser.toMove(uci, board.getSideToMove());
                board.doMove(move);
            } catch (Exception e) {
                return new CheatSignal("EngineMatchRate", 0, "Invalid move sequence at: " + uci + " (" + e.getMessage() + ")");
            }
        }

        double rate = checked == 0 ? 0 : (matches * 1.0 / checked);
        double score = Math.min(100, rate * 100);

        String details = "Top" + topN + " match rate: " + matches + "/" + checked + " = " + Math.round(rate * 100) + "%";
        return new CheatSignal("EngineMatchRate", score, details);
    }
}