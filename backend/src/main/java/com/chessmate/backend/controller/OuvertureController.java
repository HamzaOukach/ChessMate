package com.chessmate.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Ouverture;
import com.chessmate.backend.repository.OuvertureRepository;

@RestController
@RequestMapping("/ouvertures") // URL de base
public class OuvertureController {

    private final OuvertureRepository ouverRep;

    public OuvertureController(OuvertureRepository rp) {
        this.ouverRep = rp;
    }

    /**
     * GET /ouvertures
     * Récupère toutes les ouvertures
     */
    @GetMapping
    public ResponseEntity<?> getAllOuverture() {
        List<Ouverture> ouvertures = ouverRep.findAll();
        return ResponseEntity.ok(ouvertures);
    }

    /**
     * GET /ouvertures/search?code=XXX
     * Recherche une ouverture par son code (ex: ECO)
     */
    @GetMapping("/search")
    public ResponseEntity<?> getOuverture(@RequestParam(value = "code", required = false) String code) {

        if (code != null) {
            // findByCode() renvoie une liste
            List<Ouverture> result = ouverRep.findByCode(code);

            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune ouverture trouvée avec le code '" + code + "'");
            }

            return ResponseEntity.ok(result);
        }

        return ResponseEntity.badRequest()
            .body("Vous devez fournir un paramètre : 'code' -> Récupérer une ouverture grâce à son code.");
    }


    /**
     * GET /ouvertures/{id}
     * Récupère une ouverture par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getOuvertureById(@PathVariable Long id) {
        return ouverRep.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune ouverture trouvée avec l'id " + id));
    }

    /**
     * GET /ouvertures/{id}/suiteCoups
     * Récupère les suites de coups associés à une ouverture
     */
    @GetMapping("/{id}/suiteCoups")
    public ResponseEntity<?> getSuiteCoupByOuverture(@PathVariable Long id) {
        return ouverRep.findById(id)
                .<ResponseEntity<?>>map(ouverture -> ResponseEntity.ok(ouverture.getSuiteCoupsStats()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune ouverture trouvée avec l'id " + id));
    }
}
