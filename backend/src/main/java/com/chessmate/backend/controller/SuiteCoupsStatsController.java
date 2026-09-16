package com.chessmate.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.repository.SuiteCoupsStatsRepository;

@RestController
@RequestMapping("/coups_stats") // URL de base du controller
public class SuiteCoupsStatsController {

    // Repository pour accéder aux données en base
    private final SuiteCoupsStatsRepository coupRepo;

    // Injection par constructeur
    public SuiteCoupsStatsController(SuiteCoupsStatsRepository rep) {
        this.coupRepo = rep;
    }

    /**
     * GET /coups_stats
     * Renvoie toutes les statistiques de coups.
     */
    @GetMapping
    public ResponseEntity<?> getAllCoupStats() {

        // Retourne tout le contenu de la table
        return ResponseEntity.ok(coupRepo.findAll());
    }

    /**
     * GET /coups_stats/{id}
     * Récupère un coup par son ID.
     * 200 OK si trouvé
     * 404 NOT FOUND sinon
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getCoupsStatsById(@PathVariable Long id) {

        return coupRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok) // si présent -> renvoie l'objet
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucun coup trouvé avec l'id " + id)); // sinon erreur 404
    }

    /**
     * GET /coups_stats/{id}/coup_precedent
     * Récupère le coup précédent.
     */
    @GetMapping("/{id}/coup_precedent")
    public ResponseEntity<?> getSuiteCoupsStatsPrecedente(@PathVariable Long id) {

        // Recherche du coup
        return coupRepo.findById(id)
                .<ResponseEntity<?>>map(coup -> ResponseEntity.ok(coup.getSuiteCoupsStatsPrecedente()))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucun coup trouvé avec l'id " + id));
    }

    /**
     * GET /coups_stats/{id}/coups_suivants
     * Récupère la liste des coups suivants.
     */
    @GetMapping("/{id}/coups_suivants")
    public ResponseEntity<?> getSuiteCoupsStatsSuivantes(@PathVariable Long id) {

        // Recherche du coup
        return coupRepo.findById(id)
                .<ResponseEntity<?>>map(coup -> ResponseEntity.ok(coup.getSuitesSuivantes()))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucun coup trouvé avec l'id " + id));
    }
}
