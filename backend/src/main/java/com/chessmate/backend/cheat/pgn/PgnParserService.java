package com.chessmate.backend.cheat.pgn;

import com.chessmate.backend.cheat.model.PGNParseResult;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.move.Move;
import com.github.bhlangonijr.chesslib.pgn.PgnHolder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class PgnParserService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(PgnParserService.class);

    public PGNParseResult parseToUci(String pgn) {
        if (pgn == null || pgn.trim().isEmpty()) {
            throw new IllegalArgumentException("Le PGN fourni est vide.");
        }

        Path tmp = null;
        try {
            tmp = Files.createTempFile("game-", ".pgn");
            // S'assurer qu'il y a des retours à la ligne propres
            String normalizedPgn = pgn.trim() + "\n";
            Files.writeString(tmp, normalizedPgn, StandardCharsets.UTF_8);

            PgnHolder holder = new PgnHolder(tmp.toString());
            try {
                holder.loadPgn();
            } catch (Exception e) {
                logger.error("Chesslib failed to load PGN. Content was: [{}]", normalizedPgn);
                throw new IllegalArgumentException("Erreur structurelle du PGN (chesslib): " + e.getMessage());
            }

            var games = holder.getGames();
            if (games == null || games.isEmpty()) {
                logger.warn("Aucune partie trouvée dans le PGN: [{}]", normalizedPgn);
                throw new IllegalArgumentException("PGN invalide : aucune partie détectée. Vérifiez les tags [Event \"...\"] etc.");
            }

            var game = games.get(0);
            try {
                game.loadMoveText();
            } catch (Exception e) {
                 logger.warn("Erreur chargement move text: {}", e.getMessage());
            }

            var halfMoves = game.getHalfMoves();
            if (halfMoves == null || halfMoves.isEmpty()) {
                 throw new IllegalArgumentException("La partie ne contient aucun coup valide.");
            }

            Board board = new Board();
            List<String> uci = new ArrayList<>();

            for (Move m : halfMoves) {
                uci.add(m.toString().toLowerCase());
                try {
                    board.doMove(m);
                } catch (Exception e) {
                    logger.warn("Coup potentiellement illégal dans le PGN à la position {}: {}", board.getFen(), m);
                }
            }

            return new PGNParseResult(uci, board.getFen());
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Erreur imprévue lors du parsing PGN", e);
            throw new IllegalArgumentException("Erreur interne lors du traitement du PGN: " + e.getMessage());
        } finally {
            if (tmp != null) {
                try { Files.deleteIfExists(tmp); } catch (IOException ignored) {}
            }
        }
    }
}