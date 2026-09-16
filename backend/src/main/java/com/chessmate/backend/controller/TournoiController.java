package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Tournoi;
import com.chessmate.backend.repository.TournoiRepository;

@RestController
@RequestMapping("/tournois") //URL de base
public class TournoiController {

    private final TournoiRepository tourRep;

    public TournoiController(TournoiRepository rp) {
        this.tourRep = rp;
    }

    /**
     * GET /tournois
     * Récupère tous les tournois
     */
    @GetMapping
    public ResponseEntity<?> getAllTournoi() {
        return ResponseEntity.ok(tourRep.findAll());
    }

    /**
     * GET /tournois/search?{param}
     * Recherche un tournoi selon un paramètre
     */
    @GetMapping("/search")
    public ResponseEntity<?> getTournoi(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "libelle", required = false) String libelle,
            @RequestParam(value = "dateDebut", required = false) LocalDateTime dtDebut,
            @RequestParam(value = "dateCreation", required = false) LocalDateTime dtCreeA,
            @RequestParam(value = "dateModif", required = false) LocalDateTime dtModifA) {

        // Recherche par code (Optional<Tournoi>)
        if (code != null) {
            // On récupère le tournoi correspondant au code
            Optional<Tournoi> result = tourRep.findByCode(code);

            // Si présent, renvoie 200 + objet JSON, sinon 404 avec message clair
            return result.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun tournoi trouvé avec le code '" + code + "'"));
        }

        // Recherche par libelle (Optional<Tournoi>)
        if (libelle != null) {
            // On récupère le tournoi correspondant au libelle
            Optional<Tournoi> result = tourRep.findByLibelle(libelle);

            // Si présent, renvoie 200 + objet JSON, sinon 404 avec message clair
            return result.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun tournoi trouvé avec le libelle '" + libelle + "'"));
        }

        // Recherche par date de début (findAllTournoisByDateDebut renvoie List<Tournoi>)
        if (dtDebut != null) {
            return ResponseEntity.ok(tourRep.findAllTournoisByDateDebut(dtDebut));
        }

        // Recherche par date de création (renvoie List<Tournoi>)
        if (dtCreeA != null) {
            return ResponseEntity.ok(tourRep.findAllTournoisByCreeA(dtCreeA));
        }

        // Recherche par date de modification (renvoie List<Tournoi>)
        if (dtModifA != null) {
            return ResponseEntity.ok(tourRep.findAllTournoisByModifierA(dtModifA));
        }


        return ResponseEntity.badRequest()
                .body("Vous devez fournir un paramètre parmi : code, libelle, dateDebut, dateCreation, dateModif.");
    }

    /**
     * GET /tournois/{id}
     * Récupère un tournoi par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getTournoiById(@PathVariable Long id) {
        return tourRep.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun tournoi trouvé avec l'id " + id));
    }

    /**
     * GET /tournois/{id}/organisateur
     * Récupère l'organisateur du tournoi
     */
    @GetMapping("/{id}/organisateur")
    public ResponseEntity<?> getOrganisateurTournoi(@PathVariable Long id) {
        return tourRep.findById(id)
                .<ResponseEntity<?>>map(tournoi -> ResponseEntity.ok(tournoi.getOrganisateur()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun tournoi trouvé avec l'id " + id));
    }

    /**
     * GET /tournois/{id}/cadence
     * Récupère la cadence du tournoi
     */
    @GetMapping("/{id}/cadence")
    public ResponseEntity<?> getCadenceTournoi(@PathVariable Long id) {
        return tourRep.findById(id)
                .<ResponseEntity<?>>map(tournoi -> ResponseEntity.ok(tournoi.getCadence()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun tournoi trouvé avec l'id " + id));
    }

    /**
     * GET /tournois/{id}/parties
     * Récupère les parties associées au tournoi
     */
    @GetMapping("/{id}/parties")
    public ResponseEntity<?> getPartiesTournoi(@PathVariable Long id) {
        return tourRep.findById(id)
                .<ResponseEntity<?>>map(tournoi -> ResponseEntity.ok(tournoi.getParties()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun tournoi trouvé avec l'id " + id));
    }

    /**
     * GET /tournois/{id}/participants
     * Récupère les participants du tournoi
     */
    @GetMapping("/{id}/participants")
    public ResponseEntity<?> getParticipantTournoi(@PathVariable Long id) {
        return tourRep.findById(id)
                .<ResponseEntity<?>>map(tournoi -> ResponseEntity.ok(tournoi.getParticipants()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun tournoi trouvé avec l'id " + id));
    }
}
