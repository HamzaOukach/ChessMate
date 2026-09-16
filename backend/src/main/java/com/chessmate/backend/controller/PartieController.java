package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Partie;
import com.chessmate.backend.repository.PartieRepository;

@RestController
@RequestMapping("/parties") //URL de base
public class PartieController {

    private final PartieRepository partRepo;

    public PartieController(PartieRepository p) {
        this.partRepo = p;
    }

    /**
     * GET /parties
     * Récupère toutes les parties
     */
    @GetMapping
    public ResponseEntity<?> getPartie() {
        return ResponseEntity.ok(partRepo.findAll());
    }

    /**
     * GET /parties/search?{param}
     * Recherche dynamique selon un paramètre : title, date, result
     */
    @GetMapping("/search")
    public ResponseEntity<?> getPartieSearch(
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "date", required = false) LocalDateTime dt,
            @RequestParam(value = "result", required = false) String type_result) {

        // Recherche par titre
        // Recherche par titre (findByTitle retourne Optional<Partie>)
        if (title != null) {
            return partRepo.findByTitle(title)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucune partie trouvée avec le titre '" + title + "'"));
        }


        // Recherche par date
        if (dt != null) {
            List<Partie> result = partRepo.findAllPartiesByDateHeureUTC(dt);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée à la date " + dt);
            }
            return ResponseEntity.ok(result);
        }

        // Recherche par type de résultat
        if (type_result != null) {
            List<Partie> result = partRepo.findAllPartiesByTypeResultat(type_result);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec le résultat '" + type_result + "'");
            }
            return ResponseEntity.ok(result);
        }

        // Aucun paramètre fourni
        return ResponseEntity.badRequest().body(
                "Vous devez fournir un paramètre parmi : title, date, result."
        );
    }

    /**
     * GET /parties/{id}
     * Récupère une partie par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getPartieById(@PathVariable Long id) {
        return partRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec l'id " + id));
    }

    /**
     * GET /parties/{id}/joueurs
     * Récupère les joueurs d’une partie
     */
    @GetMapping("/{id}/joueurs")
    public ResponseEntity<?> getJoueursPartie(@PathVariable Long id) {
        return partRepo.findById(id)
                .<ResponseEntity<?>>map(partie -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("joueurBlanc", partie.getJoueurBlanc());
                    result.put("joueurNoir", partie.getJoueurNoir());
                    return ResponseEntity.ok(result);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec l'id " + id));
    }

    /**
     * GET /parties/{id}/ouverture
     * Récupère l'ouverture d’une partie
     */
    @GetMapping("/{id}/ouverture")
    public ResponseEntity<?> getOuverturePartie(@PathVariable Long id) {
        return partRepo.findById(id)
                .<ResponseEntity<?>>map(partie -> ResponseEntity.ok(partie.getOuverture()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec l'id " + id));
    }

    /**
     * GET /parties/{id}/suiteCoups
     * Récupère la suite de coups d’une partie
     */
    @GetMapping("/{id}/suiteCoups")
    public ResponseEntity<?> getSuiteCoupsPartie(@PathVariable Long id) {
        return partRepo.findById(id)
                .<ResponseEntity<?>>map(partie -> ResponseEntity.ok(partie.getSuiteCoupsStats()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec l'id " + id));
    }

    /**
     * GET /parties/{id}/tournoi
     * Récupère le tournoi associé à une partie
     */
    @GetMapping("/{id}/tournoi")
    public ResponseEntity<?> getTournoiPartie(@PathVariable Long id) {
        return partRepo.findById(id)
                .<ResponseEntity<?>>map(partie -> ResponseEntity.ok(partie.getTournoi()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie trouvée avec l'id " + id));
    }

}
