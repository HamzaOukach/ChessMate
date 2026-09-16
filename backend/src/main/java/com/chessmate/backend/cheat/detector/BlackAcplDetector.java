package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineEvaluation;
import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.Side;

import java.util.List;

public class BlackAcplDetector implements CheatDetector {

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        List<String> moves = game.getUciMoves();

        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("BlackACPL", 0, "No moves to analyze");
        }

        Board board = new Board();
        int totalLoss = 0;
        int countedMoves = 0;

        for (int i = 0; i < moves.size(); i++) {
            String playedUci = moves.get(i);
            boolean isBlackMove = (i % 2 == 1);

            try {
                String fenBefore = board.getFen();
                Side sideToMove = board.getSideToMove();

                var playedMove = UciMoveParser.toMove(playedUci, sideToMove);

                if (!board.isMoveLegal(playedMove, true)) {
                    return new CheatSignal(
                            "BlackACPL",
                            0,
                            "Illegal move at ply " + (i + 1) + ": " + playedUci
                    );
                }

                if (isBlackMove) {
                    EngineMoveAnalysis analysis = oracle.analyzeFen(fenBefore);

                    if (analysis != null && analysis.getBestMove() != null && !analysis.getBestMove().isBlank()) {
                        String bestUci = analysis.getBestMove();

                        Board bestBoard = new Board();
                        bestBoard.loadFromFen(fenBefore);

                        var bestMove = UciMoveParser.toMove(bestUci, bestBoard.getSideToMove());

                        if (bestBoard.isMoveLegal(bestMove, true)) {
                            bestBoard.doMove(bestMove);

                            Board playedBoard = new Board();
                            playedBoard.loadFromFen(fenBefore);
                            playedBoard.doMove(playedMove);

                            EngineEvaluation bestEvalObj = oracle.evaluateFen(bestBoard.getFen());
                            EngineEvaluation playedEvalObj = oracle.evaluateFen(playedBoard.getFen());

                            int bestEval = bestEvalObj != null ? bestEvalObj.getEvaluationCp() : 0;
                            int playedEval = playedEvalObj != null ? playedEvalObj.getEvaluationCp() : 0;

                            int rawLoss = Math.max(0, playedEval - bestEval);
                            int loss = Math.min(rawLoss, 300);

                            totalLoss += loss;
                            countedMoves++;
                        }
                    }
                }

                board.doMove(playedMove);

            } catch (Exception e) {
                return new CheatSignal(
                        "BlackACPL",
                        0,
                        "Error at ply " + (i + 1) + ": " + e.getMessage()
                );
            }
        }

        double acpl = countedMoves == 0 ? 0 : (double) totalLoss / countedMoves;

        // Seuil d'ACPL attendu selon l'Elo du joueur noir
        double elo = game.getEloBlack();
        double expectedAcpl = Math.max(12.0, 90.0 - elo * 0.031);

        // Sigmoïde : si l'ACPL est bien en dessous de l'attendu → très suspect
        double suspicionScore = 100.0 / (1.0 + Math.exp((acpl - expectedAcpl) / 10.0));
        suspicionScore = Math.max(2.0, Math.min(98.0, suspicionScore));

        String details = String.format(
            "Black ACPL = %.1f (Elo %d → seuil attendu %.1f cp)",
            acpl, (int) elo, expectedAcpl
        );

        return new CheatSignal("BlackACPL", suspicionScore, details);
    }
}