package com.chessmate.backend.service;

import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.repository.JoueurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EloService {
    private static final Logger logger = LoggerFactory.getLogger(EloService.class);
    private static final int K_FACTOR = 32;

    private final JoueurRepository joueurRepository;

    public EloService(JoueurRepository joueurRepository) {
        this.joueurRepository = joueurRepository;
    }

    /**
     * Update ELO for both players after a multiplayer game.
     * @param white The white player
     * @param black The black player
     * @param resultat 2 for white win, 0 for black win, 1 for draw
     */
    @Transactional
    public void updateElo(Joueur white, Joueur black, int resultat) {
        int whiteElo = white.getElo();
        int blackElo = black.getElo();

        // Handle legacy 0 ELO
        if (whiteElo == 0) whiteElo = 1200;
        if (blackElo == 0) blackElo = 1200;

        logger.info("Updating ELO: {} ({}) vs {} ({}) | Result: {}", 
            white.getPseudo(), whiteElo, black.getPseudo(), blackElo, resultat);

        double expectedWhite = 1.0 / (1.0 + Math.pow(10, (blackElo - whiteElo) / 400.0));
        double expectedBlack = 1.0 / (1.0 + Math.pow(10, (whiteElo - blackElo) / 400.0));

        double actualWhite;
        double actualBlack;

        if (resultat == 2) { // White wins
            actualWhite = 1.0;
            actualBlack = 0.0;
        } else if (resultat == 0) { // Black wins
            actualWhite = 0.0;
            actualBlack = 1.0;
        } else { // Draw
            actualWhite = 0.5;
            actualBlack = 0.5;
        }

        int newWhiteElo = (int) Math.round(whiteElo + K_FACTOR * (actualWhite - expectedWhite));
        int newBlackElo = (int) Math.round(blackElo + K_FACTOR * (actualBlack - expectedBlack));

        white.setElo(newWhiteElo);
        black.setElo(newBlackElo);

        // Also update win/loss/draw stats
        if (resultat == 2) {
            white.setNbVictoires((int)white.getNbVictoires() + 1);
            black.setNbDefaites((int)black.getNbDefaites() + 1);
        } else if (resultat == 0) {
            black.setNbVictoires((int)black.getNbVictoires() + 1);
            white.setNbDefaites((int)white.getNbDefaites() + 1);
        } else {
            white.setNbNulles((int)white.getNbNulles() + 1);
            black.setNbNulles((int)black.getNbNulles() + 1);
        }

        joueurRepository.save(white);
        joueurRepository.save(black);

        logger.info("New ELO: {} -> {}, {} -> {}", 
            white.getPseudo(), newWhiteElo, black.getPseudo(), newBlackElo);
    }
}
