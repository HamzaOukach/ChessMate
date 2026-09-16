package com.chessmate.backend.cheat.service;

import com.chessmate.backend.cheat.detector.CheatDetector;
import com.chessmate.backend.cheat.detector.MachineLearningDetector;
import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatReport;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.chessmate.backend.cheat.model.PlayerCheatSummary;
import com.chessmate.backend.cheat.pgn.PgnParserService;
import com.chessmate.backend.service.StockfishWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CheatDetectionService {

    private final List<CheatDetector> detectors;
    private final EngineOracle oracle;
    private final PgnParserService pgnParser;
    private final StockfishWrapper stockfish;
    private final MachineLearningDetector mlDetector;

    @Autowired
    public CheatDetectionService(List<CheatDetector> detectors,
                                 EngineOracle oracle,
                                 PgnParserService pgnParser,
                                 StockfishWrapper stockfish,
                                 MachineLearningDetector mlDetector) {
        this.detectors = detectors;
        this.oracle = oracle;
        this.pgnParser = pgnParser;
        this.stockfish = stockfish;
        this.mlDetector = mlDetector;
    }

    public CheatReport analyze(GameData game, Optional<String> pgn, double eloW, double eloB) {
        List<CheatSignal> signals = new ArrayList<>();

        for (CheatDetector detector : detectors) {
            // Avoid calling detect on ML detector without context
            if (!(detector instanceof MachineLearningDetector)) {
                CheatSignal signal = detector.detect(game, oracle);
                if (signal != null) signals.add(signal);
            }
        }

        // Specifically call the ML detector with PGN context if available
        if (pgn.isPresent() && mlDetector != null) {
            signals.add(mlDetector.detectWithPgn(pgn.get(), eloW, eloB));
        }

        List<CheatSignal> whiteSignals = signals.stream()
                .filter(s -> s.getName().toLowerCase().contains("white") || s.getName().equals("MachineLearning"))
                .toList();

        List<CheatSignal> blackSignals = signals.stream()
                .filter(s -> s.getName().toLowerCase().contains("black") || s.getName().equals("MachineLearning"))
                .toList();

        double whiteScore = computeFinalScore(whiteSignals);
        double blackScore = computeFinalScore(blackSignals);
        double globalScore = (whiteScore + blackScore) / 2.0;

        boolean reliable = game.getUciMoves() != null && game.getUciMoves().size() >= 12;
        String reliabilityMessage = reliable
                ? "Analyse suffisamment longue"
                : "Analyse peu fiable : partie trop courte";

        String globalVerdict = computeVerdict(globalScore, reliable);
        String whiteVerdict = computeVerdict(whiteScore, reliable);
        String blackVerdict = computeVerdict(blackScore, reliable);

        PlayerCheatSummary whiteSummary =
                new PlayerCheatSummary("white", whiteScore, whiteVerdict);

        PlayerCheatSummary blackSummary =
                new PlayerCheatSummary("black", blackScore, blackVerdict);

        return new CheatReport(
                globalScore,
                globalVerdict,
                signals,
                whiteSummary,
                blackSummary,
                reliable,
                reliabilityMessage
        );
    }

    public CheatReport analyzePgn(String pgn, double eloW, double eloB) {
        if (pgnParser == null) {
            throw new IllegalStateException("PgnParserService non configuré");
        }

        if (stockfish != null) {
            stockfish.reset();
        }

        var parsed = pgnParser.parseToUci(pgn);
        // On passe les Elos dans GameData pour que les détecteurs ACPL et EngineMatchRate
        // puissent ajuster leurs seuils en fonction du niveau réel du joueur
        return analyze(new GameData(parsed.getUciMoves(), eloW, eloB), Optional.of(pgn), eloW, eloB);
    }

    private double computeFinalScore(List<CheatSignal> signals) {
        if (signals == null || signals.isEmpty()) {
            return 0;
        }

        double engineScore = signals.stream()
                .filter(s -> s.getName().contains("EngineMatchRate"))
                .mapToDouble(CheatSignal::getScore)
                .average()
                .orElse(0);

        double acplScore = signals.stream()
                .filter(s -> s.getName().contains("ACPL"))
                .mapToDouble(CheatSignal::getScore)
                .average()
                .orElse(0);
        
        double mlScore = signals.stream()
                .filter(s -> s.getName().equals("MachineLearning"))
                .mapToDouble(CheatSignal::getScore)
                .findFirst()
                .orElse(0);

        // Unified pondération consensus:
        // ACPL (ASP-like): 25%
        // Engine Match Rate (ASP-like): 35%
        // Machine Learning: 40%
        double weightedScore = (acplScore * 0.25) + (engineScore * 0.35) + (mlScore * 0.40);

        // Si l'un des modèles est formel (> 90%), on remonte la note globale
        if (mlScore >= 95 || engineScore >= 95) {
            weightedScore = Math.max(weightedScore, 90);
        }

        return weightedScore;
    }

    private String computeVerdict(double score, boolean reliable) {
        if (!reliable) {
            if (score >= 80) return "À confirmer (Probable triche)";
            if (score >= 60) return "À surveiller";
            if (score >= 40) return "Peu fiable";
            return "Non concluant";
        }

        if (score >= 80) return "Tricheur (Presque certain)";
        if (score >= 70) return "Très suspect";
        if (score >= 50) return "Suspect";
        if (score >= 30) return "Un peu suspect";
        return "Légitime";
    }
}