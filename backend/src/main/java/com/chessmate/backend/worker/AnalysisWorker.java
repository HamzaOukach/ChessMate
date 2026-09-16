package com.chessmate.backend.worker;

import com.chessmate.backend.configuration.RabbitMQConfig;
import com.chessmate.backend.entiter.AnalysePartie;
import com.chessmate.backend.entiter.Partie;
import com.chessmate.backend.job.AnalysisJob;
import com.chessmate.backend.repository.AnalysePartieRepository;
import com.chessmate.backend.repository.PartieRepository;
import com.chessmate.backend.service.AccuracyService;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@Profile("worker")
public class AnalysisWorker {

        private final PartieRepository partieRepository;
        private final AnalysePartieRepository analyseRepository;
        private final AccuracyService accuracyService;

        public AnalysisWorker(PartieRepository partieRepository,
                        AnalysePartieRepository analyseRepository,
                        AccuracyService accuracyService) {
                this.partieRepository = partieRepository;
                this.analyseRepository = analyseRepository;
                this.accuracyService = accuracyService;
        }

        @RabbitListener(queues = RabbitMQConfig.QUEUE, containerFactory = "rabbitListenerContainerFactory")
        public void processAnalysis(AnalysisJob job) {
                Long partieId = job.getPartieId();
                Long joueurId = job.getJoueurId();
                
                System.out.println("\n==============================");
                System.out.println("📥 JOB RECU");
                System.out.println("Partie ID = " + partieId);
                System.out.println("Joueur ID = " + joueurId);
                System.out.println("Thread = " + Thread.currentThread().getName());

                // Vérif analyse déjà faite
                if (analyseRepository.existsByPartieIdAndJoueurId(partieId, joueurId)) {
                        System.out.println("⏭️ Analyse déjà existante → skip");
                        return;
                }

                List<Object[]> result = partieRepository.findPgnAndWhiteIdById(partieId);
                
                if (result.isEmpty()) {
                        System.out.println("❌ Partie introuvable : " + partieId);
                        System.out.println("❌ WTF: existsById=true MAIS findById=null");
                        return;
                }

                // On récupère la première (et seule) ligne
                Object[] row = result.get(0);

                // Extraction sécurisée
                String pgn = (String) row[0];
                Long joueurBlancId = (Long) row[1];

                boolean isWhite = joueurBlancId.equals(joueurId);
                System.out.println("✅ Partie trouvée !");

                try {
                        long start = System.currentTimeMillis();

                        double precision = accuracyService.precisionMoyenneForPartie(pgn, isWhite, partieId, joueurId);

                        AnalysePartie analyse = new AnalysePartie();
                        analyse.setPartieId(partieId);
                        analyse.setJoueurId(joueurId);
                        analyse.setPrecision(precision);
                        analyse.setAnalyseAt(LocalDateTime.now());

                        analyseRepository.save(analyse);

                        long end = System.currentTimeMillis();

                        System.out.println("✅ Analyse sauvegardée: " + precision);
                        System.out.println(" Temps total analyse = "+ (end - start)+ " ms, pour la partie -> partieId = "+partieId);

                } catch (Exception e) {
                        System.out.println("💥 ERREUR ANALYSE:");
                        e.printStackTrace();
                }

                System.out.println("==============================\n");
        }
}