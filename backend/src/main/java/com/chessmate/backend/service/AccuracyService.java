package com.chessmate.backend.service;

import com.github.bhlangonijr.chesslib.game.Game;
import com.github.bhlangonijr.chesslib.pgn.PgnHolder;

import com.chessmate.backend.dto.Analyseur;
import com.chessmate.backend.entiter.MoveAnalysis;
import com.chessmate.backend.repository.MoveAnalysisRepository;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class AccuracyService {
    private final MoveAnalysisRepository moveAnalysisRepository;
    
    // Utilisation de ObjectProvider pour injecter une nouvelle instance de StockfishWrapper par job
    private final ObjectProvider<StockfishWrapper> stockfishProvider;

    // Cache global pour éviter de recalculer les mêmes positions sur différentes parties
    private final Map<String, Analyseur> evaluationCache = new ConcurrentHashMap<>();

    public AccuracyService(MoveAnalysisRepository mvRepository, ObjectProvider<StockfishWrapper> stockfishProvider) {
        this.moveAnalysisRepository = mvRepository;
        this.stockfishProvider = stockfishProvider;
    }

    /**
     * Méthode de calcul de précision optimisée pour RabbitMQ
     */
    public double precisionMoyenneForPartie(String pgn, boolean isWhite, Long partieId, Long joueurId) {

        long globalStart = System.currentTimeMillis();

        List<String> allMoves = extractUciMovesFromPgn(pgn);
        long parsingEnd = System.currentTimeMillis();
        System.out.println(" Temps parsing PGN = " + (parsingEnd - globalStart) + " ms");

        StockfishWrapper stockfish = stockfishProvider.getObject();

        double totalAccuracy = 0;
        int playerMoveCount = 0;

        int evaluation = 0;
        String bestEngineMove = null;

        try {
            List<Integer> evals = new ArrayList<>();
            List<String> movesSequence = new ArrayList<>();
            List<MoveAnalysis> batch = new ArrayList<>();

            evals.add(0);

            // 🔹 1. Analyse des positions (avec cache)
            for (String move : allMoves) {
                movesSequence.add(move);
                String key = String.join(" ", movesSequence);
                
                Analyseur analyse = evaluationCache.computeIfAbsent(key, k -> {
                    return stockfish.analyzePosition(k, 10);
                });

                evaluation = analyse.getEval();
                bestEngineMove = analyse.getBestMove();

                evals.add(evaluation);
            }

            // 🔹 2. Calcul + création MoveAnalysis
            for (int i = 1; i < evals.size(); i++) {

                String movePlayed = allMoves.get(i - 1);

                int evalBefore = evals.get(i - 1);
                int evalAfter = evals.get(i);

                boolean isPlayerMove = (isWhite && i % 2 != 0) || (!isWhite && i % 2 == 0);

                if (isPlayerMove) {

                    int cpl = isWhite ? (evalBefore - evalAfter) : (evalAfter - evalBefore);
                    cpl = Math.max(0, cpl);

                    double accuracy = 100 * (1.0 / (1.0 + (cpl / 50.0)));

                    totalAccuracy += accuracy;
                    playerMoveCount++;

                    String phase = (i < 20) ? "OPENING" : (i < 60 ? "MIDGAME" : "ENDGAME");

                    MoveAnalysis ma = new MoveAnalysis();
                    ma.setPartieId(partieId);
                    ma.setJoueurId(joueurId);
                    ma.setMoveIndex(i - 1);
                    ma.setMoveUci(movePlayed);
                    ma.setIsWhite(isWhite);
                    ma.setEvalBefore(evalBefore);
                    ma.setEvalAfter(evalAfter);
                    ma.setBestEngineMove(bestEngineMove);

                    ma.setIsEngineMatch(
                        bestEngineMove != null &&
                        bestEngineMove.equalsIgnoreCase(movePlayed));   

                    ma.setCpl(cpl);
                    ma.setAccuracyScore(accuracy);
                    ma.setPhase(phase);

                    batch.add(ma);
                }
            }

            // 🔥 SAVE EN BATCH (IMPORTANT PERF)
            moveAnalysisRepository.saveAll(batch);

        } catch (Exception e) {
            System.err.println("Erreur lors de l'analyse : " + e.getMessage());
        } finally {
            stockfish.stop();
        }

        long end = System.currentTimeMillis();
        System.out.println("Temps total fonction = " + (end - globalStart) + " ms");

        return playerMoveCount == 0
                                ? 0
                                : Math.round((totalAccuracy / playerMoveCount) * 100.0) / 100.0;
    }

    private List<String> extractUciMovesFromPgn(String pgn) {
        if (pgn == null || pgn.isBlank()) return Collections.emptyList();
        try {
            PgnHolder holder = new PgnHolder(null);
            holder.loadPgn(pgn);
            if (holder.getGames().isEmpty()) return Collections.emptyList();

            Game game = holder.getGames().get(0);
            game.loadMoveText();
            
            return game.getHalfMoves().stream()
                    .map(move -> move.toString().toLowerCase())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /*public double precisionMoyenne(Long joueurId) {
        List<Object[]> parties = partieRepository.findAllPgnByJoueur(joueurId);
        if (parties.isEmpty()) return 0;
        double totalAccuracy = 0;
        for (Object[] row : parties) {
            totalAccuracy += precisionMoyenneForPartie((String) row[0], ((Long) row[1]).equals(joueurId));
        }
        return totalAccuracy / parties.size();
    }*/
}