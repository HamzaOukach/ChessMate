package com.chessmate.backend.controller;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.chessmate.backend.configuration.RabbitMQConfig;
import com.chessmate.backend.service.EtlStatusService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/etl")
public class ETLController {

    @Autowired private RabbitTemplate rabbitTemplate;
    @Autowired private EtlStatusService statusService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(
                                            @RequestPart("file") MultipartFile file,
                                            @RequestParam("joueurId") String joueurId) throws IOException {
        System.out.println(joueurId);
        System.out.println(file);

        String jobId = UUID.randomUUID().toString();
        // On construit le nom : jobId_joueurId_nomFichier
        String filename = jobId + "_" + joueurId + "_" + file.getOriginalFilename();
        
        // Sauvegarde physique
        Path path = Paths.get("/data", filename);
        Files.copy(file.getInputStream(), path);

        // Initialisation du statut
        statusService.updateStatus(jobId, "PROCESSING");

        // Envoi du message (on envoie le nom du fichier)
        rabbitTemplate.convertAndSend(RabbitMQConfig.TASK_QUEUE, filename);

        return ResponseEntity.ok(Map.of("jobId", jobId, "status", "PROCESSING"));
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, String>> getStatus(@PathVariable String jobId) {
        return ResponseEntity.ok(Map.of("status", statusService.getStatus(jobId)));
    }

}