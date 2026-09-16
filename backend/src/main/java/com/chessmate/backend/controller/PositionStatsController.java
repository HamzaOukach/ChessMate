package com.chessmate.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.repository.PositionStatsRepository;

@RestController
@RequestMapping("/position_stats") // URL de base pour toutes les routes
public class PositionStatsController {

    // Repository injecté pour accéder à la base de données
    private final PositionStatsRepository posRepo;

    // Injection par constructeur
    public PositionStatsController(PositionStatsRepository rep) {
        this.posRepo = rep;
    }

    /**
     * GET /position_stats
     * Retourne la liste complète de toutes les PositionStats.
     */
    @GetMapping
    public ResponseEntity<?> getAllPositionStats() {

        // findAll() -> récupère toutes les lignes dans la table position_stats
        return ResponseEntity.ok(posRepo.findAll());
    }

    /**
     * GET /position_stats/{id}
     * Recherche une PositionStats par son identifiant.
     * Si trouvée -> 200 OK + JSON
     * Si non trouvée -> 404 NOT FOUND + message
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getPositionStatsById(@PathVariable Long id) {

        // findById() -> renvoie Optional
        // map(ResponseEntity::ok) -> renvoie directement l'objet si présent
        // orElseGet(...) -> construit une réponse 404 si absent
        return posRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok) 
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("PositionStats avec id " + id + " introuvable"));
    }

    /**
     * GET /position_stats/fen/{fen}
     * Recherche une PositionStats via sa FEN (notation d'échecs).
     * Si trouvée -> 200 OK
     * Si pas trouvée -> 404 + message
     */
    @GetMapping("/fen/{fen}")
    public ResponseEntity<?> getPositionStatsByFen(@PathVariable String fen) {

        // findByFen() -> méthode personnalisée dans le repository
        return posRepo.findByFen(fen)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("PositionStats avec le FEN '" + fen + "' introuvable"));
    }
    
}
