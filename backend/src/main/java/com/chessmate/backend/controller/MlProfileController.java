package com.chessmate.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.service.MlProfileService;
import com.chessmate.backend.repository.PartieJoueeRepository;
import com.fasterxml.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/ml")
public class MlProfileController {

    private final com.chessmate.backend.service.MlProfileService mlProfileService;
    private final PartieJoueeRepository partieJoueeRepository;
    private final com.chessmate.backend.repository.UtilisateurRepository utilisateurRepository;

    public MlProfileController(com.chessmate.backend.service.MlProfileService mlProfileService, PartieJoueeRepository partieJoueeRepository, com.chessmate.backend.repository.UtilisateurRepository utilisateurRepository) {
        this.mlProfileService = mlProfileService;
        this.partieJoueeRepository = partieJoueeRepository;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping("/debug")
    public ResponseEntity<?> debugParties() {
        return ResponseEntity.ok(partieJoueeRepository.findAll());
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> getMyProfile(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Utilisateur non authentifié.");
        }
        
        String email = authentication.getName();
        String username = utilisateurRepository.findByEmail(email)
            .map(u -> {
                com.chessmate.backend.entiter.Joueur j = u.getJoueur();
                return (j != null && j.getPseudo() != null) ? j.getPseudo() : u.getEmail();
            })
            .orElse(email);
        try {
            JsonNode profileJson = mlProfileService.getPersonalizedProfile(username);
            return ResponseEntity.ok(profileJson);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Erreur lors de la génération du profil ML pour " + username + ": " + e.getMessage());
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestParam("username") String username) {
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Le paramètre 'username' est requis.");
        }

        try {
            JsonNode profileJson = mlProfileService.getPersonalizedProfile(username);
            return ResponseEntity.ok(profileJson);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Erreur lors de la génération du profil ML: " + e.getMessage());
        }
    }
}
