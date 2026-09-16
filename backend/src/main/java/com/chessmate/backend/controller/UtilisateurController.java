package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Utilisateur;
import com.chessmate.backend.repository.UtilisateurRepository;

@RestController
@RequestMapping("/users") //URL de base
public class UtilisateurController {

    private final UtilisateurRepository repUser;

    public UtilisateurController(UtilisateurRepository rep) {
        this.repUser = rep;
    }

    /**
     * GET /users
     * Récupère tous les utilisateurs
     */
    @GetMapping
    public ResponseEntity<?> getAllUtilisateur() {
        return ResponseEntity.ok(repUser.findAll());
    }

    /**
     * GET /users/search?{param}
     * Recherche un utilisateur par email ou par dates
     */
    @GetMapping("/search")
    public ResponseEntity<?> getUtilisateur(
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "dateInscription", required = false) LocalDateTime dtIns,
            @RequestParam(value = "dateConnexion", required = false) LocalDateTime dtCon,
            @RequestParam(value = "dateBanni", required = false) LocalDateTime dtBan) {

        // Recherche par email (Optional<Utilisateur>)
        if (email != null) {
            Optional<Utilisateur> userOpt = repUser.findByEmail(email);
            return userOpt.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun utilisateur trouvé avec l'email '" + email + "'"));
        }

        // Recherche par date d'inscription (List<Utilisateur>)
        if (dtIns != null) {
            return ResponseEntity.ok(repUser.findByInscriptionA(dtIns));
        }

        // Recherche par date de connexion (List<Utilisateur>)
        if (dtCon != null) {
            return ResponseEntity.ok(repUser.findByConnexionA(dtCon));
        }

        // Recherche par date de bannissement (List<Utilisateur>)
        if (dtBan != null) {
            return ResponseEntity.ok(repUser.findByBanniA(dtBan));
        }

        // Aucun paramètre fourni → 400 Bad Request
        return ResponseEntity.badRequest().body(
                "Vous devez fournir un paramètre parmi : 'email', 'dateInscription', 'dateConnexion', 'dateBanni'.");
    }

    /**
     * GET /users/{id}
     * Récupère un utilisateur par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUtilisateurById(@PathVariable Long id) {
        return repUser.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun utilisateur trouvé avec l'id " + id));
    }

    /**
     * GET /users/{id}/monjoueur
     * Récupère le joueur associé à l'utilisateur
     */
    @GetMapping("/{id}/monjoueur")
    public ResponseEntity<?> getJoueurByUser(@PathVariable Long id) {
        return repUser.findById(id)
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(user.getJoueur()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun utilisateur trouvé avec l'id " + id));
    }

    /**
     * GET /users/{id}/profils
     * Récupère les profils associés à l'utilisateur
     */
    @GetMapping("/{id}/profils")
    public ResponseEntity<?> getProfilByUser(@PathVariable Long id) {
        return repUser.findById(id)
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(user.getProfils()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun utilisateur trouvé avec l'id " + id));
    }

    /**
     * GET /users/{id}/roles
     * Récupère les rôles associés à l'utilisateur
     */
    @GetMapping("/{id}/roles")
    public ResponseEntity<?> getRoleByUser(@PathVariable Long id) {
        return repUser.findById(id)
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(user.getRoles()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun utilisateur trouvé avec l'id " + id));
    }
}
