package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;

import java.util.List;

public class WhiteEngineMatchRateDetector implements CheatDetector {

    private final int topN;

    public WhiteEngineMatchRateDetector() {
        this(3);
    }

    public WhiteEngineMatchRateDetector(int topN) {
        this.topN = topN;
    }

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        List<String> moves = game.getUciMoves();

        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("WhiteEngineMatchRate", 0, "No moves to analyze");
        }

        Board board = new Board();
        int matches = 0;
        int checked = 0;

        for (int i = 0; i < moves.size(); i++) {
            String uci = moves.get(i);
            boolean isWhiteMove = (i % 2 == 0);

            if (isWhiteMove) {
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
                            "WhiteEngineMatchRate",
                            0,
                            "Illegal move at ply " + (i + 1) + ": " + uci
                    );
                }

                board.doMove(move);
            } catch (Exception e) {
                return new CheatSignal(
                        "WhiteEngineMatchRate",
                        0,
                        "Invalid move sequence at ply " + (i + 1) + ": " + uci + " (" + e.getMessage() + ")"
                );
            }
        }

        double rate = checked == 0 ? 0 : (matches * 1.0 / checked);

        // Taux attendu de match Top-3 selon l'Elo :
        //   1000 Elo → ~35% de matchs Top-3 attendus
        //   1500 Elo → ~50%
        //   2000 Elo → ~62%
        //   2500 Elo → ~75%
        // Formule : expectedRate = min(0.80, 0.28 + eloWhite * 0.00019)
        double elo = game.getEloWhite();
        double expectedRate = Math.min(0.80, 0.28 + elo * 0.00019);

        // Score de suspicion : si le taux réel dépasse largement l'attendu → suspect
        // Sigmoïde centrée sur le taux attendu
        double delta = rate - expectedRate; // positif = meilleur que prévu
        double suspicionScore = 100.0 / (1.0 + Math.exp(-delta * 12.0));
        suspicionScore = Math.max(2.0, Math.min(98.0, suspicionScore));

        String details = String.format(
            "Top%d white match rate: %d/%d = %d%% (Elo %d → attendu %.0f%%)",
            topN, matches, checked, Math.round(rate * 100), (int) elo, expectedRate * 100
        );

        return new CheatSignal("WhiteEngineMatchRate", suspicionScore, details);
    }
}