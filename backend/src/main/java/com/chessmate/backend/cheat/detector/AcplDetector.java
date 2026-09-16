package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineEvaluation;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;

import java.util.List;

public class AcplDetector implements CheatDetector {

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        List<String> moves = game.getUciMoves();

        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("ACPL", 0, "No moves to analyze");
        }

        Board board = new Board();

        int totalLoss = 0;
        int countedMoves = 0;

        for (int i = 0; i < moves.size(); i++) {
            String uci = moves.get(i);
            String fenBefore = board.getFen();

            try {
                EngineEvaluation bestEval = oracle.evaluateFen(fenBefore);

                var move = UciMoveParser.toMove(uci, board.getSideToMove());

                if (!board.isMoveLegal(move, true)) {
                    return new CheatSignal("ACPL", 0,
                            "Illegal move at ply " + (i + 1) + ": " + uci);
                }

                board.doMove(move);

                String fenAfter = board.getFen();
                EngineEvaluation playedEval = oracle.evaluateFen(fenAfter);

                int loss = Math.max(0, bestEval.getEvaluationCp() - playedEval.getEvaluationCp());

                totalLoss += loss;
                countedMoves++;

            } catch (Exception e) {
                return new CheatSignal("ACPL", 0,
                        "Error at ply " + (i + 1) + ": " + e.getMessage());
            }
        }

        double acpl = countedMoves == 0 ? 0 : (double) totalLoss / countedMoves;

        // Plus l'ACPL est faible, plus c'est suspect.
        double suspicionScore =
                acpl <= 20 ? 90 :
                acpl <= 40 ? 70 :
                acpl <= 60 ? 50 :
                acpl <= 100 ? 30 : 10;

        String details = "ACPL = " + Math.round(acpl * 100.0) / 100.0;

        return new CheatSignal("ACPL", suspicionScore, details);
    }
}