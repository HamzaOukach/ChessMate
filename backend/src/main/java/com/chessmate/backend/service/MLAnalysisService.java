package com.chessmate.backend.service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.chessmate.backend.dto.MLAnalysisResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service d'analyse ML — pont entre Spring Boot et {@code ml_engine/predict_game.py}.
 *
 * <p>Contrat de robustesse :</p>
 * <ul>
 *   <li>Ne lève <b>jamais</b> d'exception vers l'appelant : retourne {@code null} en cas
 *       d'échec afin de ne pas bloquer la sauvegarde de la partie.</li>
 *   <li>Résout le chemin du script Python de façon portable via la propriété
 *       {@code user.dir} (répertoire de travail de la JVM, identique au dossier
 *       depuis lequel Spring Boot est lancé).</li>
 *   <li>Force {@code PYTHONIOENCODING=utf-8} pour éviter les corruptions d'emojis
 *       sur Windows (cp1252 par défaut).</li>
 * </ul>
 */
@Service
public class MLAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(MLAnalysisService.class);

    /** Exécutable Python — peut être surchargé via variable d'environnement PYTHON_EXEC */
    private static final String PYTHON_EXEC = System.getenv().getOrDefault("PYTHON_EXEC", "python");

    /** Chemin relatif au working-directory de la JVM (racine du projet) */
    private static final String SCRIPT_PATH = "ml_engine/predict_game.py";

    private final ObjectMapper objectMapper;

    public MLAnalysisService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Appelle le script Python et retourne l'analyse ML.
     *
     * @param moves  chaîne PGN brute (peut contenir des en-têtes et numéros de coups)
     * @param turns  nombre total de coups joués
     * @param winner vainqueur au format attendu par le script : "white", "black" ou "draw"
     * @return {@link MLAnalysisResponse} peuplé, ou {@code null} si l'appel a échoué
     */
    public MLAnalysisResponse analyze(String moves, int turns, String winner) {

        // ── Étape 1 — Validation des entrées ──────────────────────────────────────────────
        if (moves == null || moves.isBlank()) {
            log.warn("[ML] ❌ ABANDON — chaîne de coups vide ou null.");
            return null;
        }
        if (winner == null || winner.isBlank()) {
            winner = "draw";
        }

        // ── Étape 2 — Nettoyage du PGN ──────────────────────────────────────────────
        // Le PGN contient des en-têtes [Event ...] et des numéros "1." —
        // Python les verrait comme des tokens et cassit la clé d'ouverture.
        String cleanedMoves = moves
                .replaceAll("\\[[^\\]]*\\]", " ")   // supprime [Event ...] etc.
                .replaceAll("\\{[^}]*\\}", " ")      // supprime commentaires {}
                .replaceAll("\\([^)]*\\)", " ")      // supprime variations ()
                .replaceAll("\\$\\d+", " ")          // supprime NAGs $10
                .replaceAll("\\d+\\.+", " ")          // supprime numéros 1. 2... 3.
                .replaceAll("1-0|0-1|1/2-1/2|\\*", " ")  // supprime résultat
                .replaceAll("[+#?!]", "")            // supprime annotations
                .replaceAll("\\s+", " ")
                .trim();

        log.info("[ML] ── Début analyse de partie ──");
        log.info("[ML] turns={} | winner={}", turns, winner);
        log.info("[ML] coups nettoyés (5 premiers tokens): '{}'",
                java.util.Arrays.stream(cleanedMoves.split(" "))
                        .limit(5).collect(java.util.stream.Collectors.joining(" ")));

        try {
            // ── Étape 3 — Construction de la commande ─────────────────────────────────
            List<String> command = new ArrayList<>();
            command.add(PYTHON_EXEC);
            command.add(SCRIPT_PATH);
            command.add("--moves");
            command.add(cleanedMoves);
            command.add("--turns");
            command.add(String.valueOf(turns));
            command.add("--winner");
            command.add(winner.trim().toLowerCase());

            java.io.File projectRoot = resolveProjectRoot();
            log.info("[ML] ProcessBuilder CWD résolu : {}", projectRoot.getAbsolutePath());
            log.info("[ML] Commande : python {} --moves '...' --turns {} --winner {}",
                    SCRIPT_PATH, turns, winner);

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.environment().put("PYTHONIOENCODING", "utf-8");
            pb.directory(projectRoot);
            pb.redirectErrorStream(false);

            // ── Étape 4 — Exécution ───────────────────────────────────────────────
            log.info("[ML] Démarrage du processus Python...");
            Process process = pb.start();

            String rawJson  = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            String errorOut = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            int exitCode    = process.waitFor();

            log.info("[ML] Processus Python terminé — exit={}", exitCode);
            if (!errorOut.isBlank()) {
                log.info("[ML] Python stderr : {}", errorOut);
            }
            log.info("[ML] Python stdout brut : '{}'", rawJson.length() > 200
                    ? rawJson.substring(0, 200) + "..." : rawJson);

            if (rawJson.isBlank()) {
                log.error("[ML] ❌ Python stdout vide ! (exit={}) stderr={}", exitCode, errorOut);
                return null;
            }

            // ── Étape 5 — Parsing JSON ──────────────────────────────────────────────
            MLAnalysisResponse response = objectMapper.readValue(rawJson, MLAnalysisResponse.class);

            if (response.hasError()) {
                log.error("[ML] ❌ Le script Python a retourné une erreur : {}", response.getError());
                return null;
            }

            log.info("[ML] ✅ Analyse OK — ouverture='{}' tag='{}' probW={} probB={} probD={}",
                    response.getOpeningFamily(), response.getInsightTag(),
                    response.getProbWhite(), response.getProbBlack(), response.getProbDraw());

            return response;

        } catch (Exception e) {
            log.error("[ML] ❌ Exception lors de l'appel Python : {} : {}", e.getClass().getSimpleName(), e.getMessage(), e);
            return null;
        }
    }

    /**
     * Résout le répertoire racine du projet (parent du dossier {@code backend/}).
     * Spring Boot tourne avec {@code user.dir} = le répertoire {@code backend/},
     * donc on remonte d'un niveau.
     */
    private java.io.File resolveProjectRoot() {
        java.io.File workingDir = new java.io.File(System.getProperty("user.dir"));
        // Si le CWD est déjà la racine (contient ml_engine/), on l'utilise tel quel
        java.io.File mlEngineDir = new java.io.File(workingDir, "ml_engine");
        if (mlEngineDir.exists()) {
            return workingDir;
        }
        // Sinon on remonte au parent (cas où CWD = backend/)
        java.io.File parent = workingDir.getParentFile();
        java.io.File mlEngineDirParent = new java.io.File(parent, "ml_engine");
        if (mlEngineDirParent.exists()) {
            return parent;
        }
        // Fallback : on reste dans le CWD et on laisse Python remonter
        log.warn("[ML] Impossible de localiser ml_engine/ depuis {} ni {}", workingDir, parent);
        return workingDir;
    }
}
