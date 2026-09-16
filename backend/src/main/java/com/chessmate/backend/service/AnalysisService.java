package com.chessmate.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.chessmate.backend.job.AnalysisProducer;
import com.chessmate.backend.repository.AnalysePartieRepository;
import com.chessmate.backend.repository.PartieRepository;
import com.chessmate.backend.repository.UtilisateurRepository;
import com.chessmate.backend.entiter.Partie;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class AnalysisService {

    @Autowired private UtilisateurRepository utilisateurRepository;
    @Autowired private PartieRepository partieRepository;
    @Autowired private AnalysePartieRepository analyseRepository;
    @Autowired private AnalysisProducer analysisProducer;

    public void runAnalysisForAllPlayers() {
            System.out.println("🚀 Initialisation des analyses pour les joueurs des utilisateurs...");

            // 1. Récupérer les IDs des joueurs associés aux utilisateurs
            List<Long> joueurIds = utilisateurRepository.findAllJoueurIds();
            
            int nbJob = 0;

            for (Long joueurId : joueurIds) {

                // 2. Récupérer les parties du joueur
                List<Partie> parties = partieRepository.findAllByJoueur(joueurId);

                Set<Long> analysedPartieIds = new HashSet<>(
                    analyseRepository.findAllPartieIdsByJoueurId(joueurId)
                );

                for (Partie partie : parties) {

                if (!analysedPartieIds.contains(partie.getId())) {
                        analysisProducer.sendAnalysisJob(partie.getId(), joueurId);
                        nbJob++;
                    }
                }
            }

            System.out.println("✅ Initialisation terminée pour " + joueurIds.size() + " joueurs.");
            System.out.println("✅ Tous les jobs envoyés ---- TOTAL = "+nbJob);
        };


    
    @Async
    public void runAnalysisForOnePlayer(Long joueurId) {
            System.out.println("🚀 Initialisation des analyses pour le joueur "+joueurId);
            // 1. On ne récupère que les parties de CE joueur
            List<Partie> parties = partieRepository.findAllByJoueur(joueurId);

            // 2. On ne récupère que les analyses de CE joueur
            Set<Long> analysedPartieIds = new HashSet<>(
                analyseRepository.findAllPartieIdsByJoueurId(joueurId)
            );

            int nbJob = 0;
            for (Partie partie : parties) {
                if (!analysedPartieIds.contains(partie.getId())) {
                    analysisProducer.sendAnalysisJob(partie.getId(), joueurId);
                    nbJob++;
                }
            }

            if (nbJob > 0) {
                System.out.println("🚀"+ nbJob +" nouveaux jobs Stockfish envoyés pour le joueur -> id " + joueurId);
            } else {
                System.out.println("info [Job] Aucune nouvelle partie à analyser pour le joueur -> id " + joueurId);
            }
        };
}
