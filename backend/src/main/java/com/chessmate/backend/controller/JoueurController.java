package com.chessmate.backend.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.repository.JoueurRepository;

@RestController
@RequestMapping("/api/joueurs") // URL de base
public class JoueurController {

    private final JoueurRepository joueurRep;

    public JoueurController(JoueurRepository jp) {
        this.joueurRep = jp;
    }

    /**
     * GET /joueurs
     * Récupère tous les joueurs
     */
    @GetMapping
    public ResponseEntity<?> getAllJoueur() {
        return ResponseEntity.ok(joueurRep.findAll());
    }

    /**
     * GET /joueurs/{id}
     * Récupère un joueur par son ID
     * 200 OK si trouvé, 404 NOT FOUND sinon
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getJoueurById(@PathVariable Long id) {
        return joueurRep.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé avec l'id " + id));
    }

    /**
     * GET /joueurs/search?{param}
     * Recherche dynamique selon un seul paramètre : pseudo, equipe, elo
     */
    @GetMapping("/search")
    public ResponseEntity<?> getJoueur(
            @RequestParam(value = "pseudo", required = false) String pseudo,
            @RequestParam(value = "equipe", required = false) String equipe,
            @RequestParam(value = "elo", required = false) Integer elo) {

        // Recherche par pseudo
        if (pseudo != null) {
            Optional<Joueur> result = joueurRep.findByPseudonyme(pseudo);
            return result.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun joueur trouvé avec le pseudo '" + pseudo + "'"));
        }

        // Recherche par équipe - renvoie une liste
        if (equipe != null) {
            List<Joueur> result = joueurRep.findByEquipe(equipe);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé dans l'équipe '" + equipe + "'");
            }
            return ResponseEntity.ok(result);
        }

        // Recherche par elo - renvoie une liste
        if (elo != null) {
            List<Joueur> result = joueurRep.findByElo(elo);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé avec un elo de " + elo);
            }
            return ResponseEntity.ok(result);
        }

        // Aucun paramètre fourni
        return ResponseEntity.badRequest().body(
                "Vous devez fournir un paramètre parmi : pseudo, equipe, elo."
        );
    }

    /**
     * GET /joueurs/{id}/account
     * Récupère le compte utilisateur associé à un joueur
     */
    @GetMapping("/{id}/account")
    public ResponseEntity<?> getAccountJoueur(@PathVariable Long id) {
        return joueurRep.findById(id)
                .<ResponseEntity<?>>map(j -> ResponseEntity.ok(j.getUtilisateur()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé avec l'id " + id));
    }

    /**
     * GET /joueurs/{id}/mestournois
     * Récupère les tournois organisés par le joueur
     */
    @GetMapping("/{id}/mestournois")
    public ResponseEntity<?> getTournoiOrganiserJoueur(@PathVariable Long id) {
        return joueurRep.findById(id)
                .<ResponseEntity<?>>map(j -> ResponseEntity.ok(j.getTournoisOrganises()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé avec l'id " + id));
    }

    /**
     * GET /joueurs/{id}/tournois
     * Récupère les tournois auxquels le joueur participe
     */
    @GetMapping("/{id}/tournois")
    public ResponseEntity<?> getTournoiParticiperJoueur(@PathVariable Long id) {
        return joueurRep.findById(id)
                .<ResponseEntity<?>>map(j -> ResponseEntity.ok(j.getTournoisParticipes()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun joueur trouvé avec l'id " + id));
    }

}
