package com.chessmate.backend.worker;

import com.chessmate.backend.configuration.RabbitMQConfig;
import com.chessmate.backend.service.AnalysisService;
import com.chessmate.backend.service.EtlStatusService;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.stream.Stream;

@Component
@Profile("worker")
public class EtlWorker {

    @Autowired private RabbitTemplate rabbitTemplate;
    @Autowired private EtlStatusService statusService;
    @Autowired private AnalysisService analysisService;

    @RabbitListener(queues = RabbitMQConfig.TASK_QUEUE)
    public void processTask(String filename) {
        String[] parts = filename.split("_");
        String jobId = parts[0];
        String joueurId = parts[1]; // On récupère l'ID transmis
        
        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "compose", "-p", "lichess-2025-2026",
                "-f", "/app/compose.yml", "--project-directory", "/app",
                "--profile", "jobs", "run", "--rm", "etl"
            );
            
            pb.inheritIO();
            int exitCode = pb.start().waitFor();

            // Nettoyage des fichiers
            clearDataDirectory();

            // Envoi du résultat au Backend
            String finalStatus = (exitCode == 0) ? "COMPLETED" : "FAILED";
            // On renvoie : jobId:status:joueurId
            rabbitTemplate.convertAndSend(RabbitMQConfig.RESULT_QUEUE, jobId + ":" + finalStatus + ":" + joueurId);

        } catch (Exception e) {
            rabbitTemplate.convertAndSend(RabbitMQConfig.RESULT_QUEUE, jobId + ":FAILED");
        }
    }


     // Listener qui reçoit la réponse du Worker
    @RabbitListener(queues = RabbitMQConfig.RESULT_QUEUE)
    public void handleResult(String message) {
        String[] parts = message.split(":");
        String jobId = parts[0];
        String status = parts[1];
        Long joueurId = Long.parseLong(parts[2]);

        statusService.updateStatus(jobId, status);

        System.out.println("📩 Status mis à jour: " + status);

        if ("COMPLETED".equals(status)) {
            System.out.println("📈 Analyse stockfish ciblée pour le joueur : " + joueurId);
            // On lance le scan des nouvelles parties à analyser
            analysisService.runAnalysisForOnePlayer(joueurId);
        }
    }

    private void clearDataDirectory() {
    Path dataPath = Paths.get("/data");
    try (Stream<Path> stream = Files.walk(dataPath)) {
        stream.sorted(Comparator.reverseOrder()) // On trie pour supprimer les fichiers avant les dossiers
              .filter(path -> !path.equals(dataPath)) // On ne supprime pas le dossier /data lui-même
                .forEach(path -> {
                try {
                    Files.delete(path);
                } catch (IOException e) {
                    System.err.println("Impossible de supprimer : " + path + " - " + e.getMessage());
                }
            });
        System.out.println("🧹 Dossier /data entièrement vidé.");
    } catch (IOException e) {
        System.err.println("Erreur lors du nettoyage du dossier : " + e.getMessage());
    }
}
}