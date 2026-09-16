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

public class WhiteAcplDetector implements CheatDetector {

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        List<String> moves = game.getUciMoves();

        if (moves == null || moves.isEmpty()) {
            return new CheatSignal("WhiteACPL", 0, "No moves to analyze");
        }

        Board board = new Board();
        int totalLoss = 0;
        int countedMoves = 0;

        for (int i = 0; i < moves.size(); i++) {
            String playedUci = moves.get(i);
            boolean isWhiteMove = (i % 2 == 0);

            try {
                String fenBefore = board.getFen();
                Side sideToMove = board.getSideToMove();

                var playedMove = UciMoveParser.toMove(playedUci, sideToMove);

                if (!board.isMoveLegal(playedMove, true)) {
                    return new CheatSignal(
                            "WhiteACPL",
                            0,
                            "Illegal move at ply " + (i + 1) + ": " + playedUci
                    );
                }

                if (isWhiteMove) {
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

                            int rawLoss = Math.max(0, bestEval - playedEval);
                            int loss = Math.min(rawLoss, 300);

                            totalLoss += loss;
                            countedMoves++;
                        }
                    }
                }

                board.doMove(playedMove);

            } catch (Exception e) {
                return new CheatSignal(
                        "WhiteACPL",
                        0,
                        "Error at ply " + (i + 1) + ": " + e.getMessage()
                );
            }
        }

        double acpl = countedMoves == 0 ? 0 : (double) totalLoss / countedMoves;

        // Seuil d'ACPL attendu selon l'Elo :
        //   1000 Elo → ~80 cp/coup (beaucoup d'erreurs)
        //   1500 Elo → ~55 cp/coup
        //   2000 Elo → ~30 cp/coup
        //   2500 Elo → ~15 cp/coup (quasi-parfait)
        // Formule : acplAttendu = max(12, 90 - eloWhite * 0.031)
        double elo = game.getEloWhite();
        double expectedAcpl = Math.max(12.0, 90.0 - elo * 0.031);

        // Sigmoïde centrée sur l'ACPL attendu pour cet Elo :
        // Si le joueur joue MIEUX que prévu → score de suspicion monte vers 100
        // Si le joueur joue comme prévu ou moins bien → score bas
        double suspicionScore = 100.0 / (1.0 + Math.exp((acpl - expectedAcpl) / 10.0));
        suspicionScore = Math.max(2.0, Math.min(98.0, suspicionScore));

        String details = String.format(
            "White ACPL = %.1f (Elo %d → seuil attendu %.1f cp)",
            acpl, (int) elo, expectedAcpl
        );

        return new CheatSignal("WhiteACPL", suspicionScore, details);
    }
}