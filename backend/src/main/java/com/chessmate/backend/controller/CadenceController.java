package com.chessmate.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Cadence;
import com.chessmate.backend.repository.CadenceRepository;

@RestController
@RequestMapping("/cadences")  // URL de base pour toutes les routes
public class CadenceController {

    // Repository injecté pour accéder à la base de données
    private final CadenceRepository repCadence;

    // Injection par constructeur
    public CadenceController(CadenceRepository rep) {
        this.repCadence = rep;
    }

     /**
     * GET /cadences
     * Récupérer toutes les cadences 
     */
    @GetMapping
    public ResponseEntity<?> getAllCadence() {
        return ResponseEntity.ok(repCadence.findAll());
    }

    /**  
     * GET /cadences/search?{param}
     * Recherche dynamique selon un seul paramètre :
     * - temps
     * - libelle
     * - increment
     * - typePartie (enum CategorieCadence)
     */
    @GetMapping("/search")
    public ResponseEntity<?> getCadence(
            @RequestParam(value = "temps", required = false) Integer temps,
            @RequestParam(value = "libelle", required = false) String libelle,
            @RequestParam(value = "increment", required = false) Integer increment,
            @RequestParam(value = "typePartie", required = false) String typePartie) {

        //  Recherche par temps (renvoie une liste)
        if (temps != null) {
            List<Cadence> result = repCadence.findByTemps(temps);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune cadence trouvée avec le temps " + temps);
            }
            return ResponseEntity.ok(result);
        }

        // Recherche par libelle (renvoie Optional)
        if (libelle != null) {
            return repCadence.findByLibelle(libelle)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucune cadence trouvée avec le libelle '" + libelle + "'"));
        }

        // Recherche par increment (renvoie une liste)
        if (increment != null) {
            List<Cadence> result = repCadence.findByIncrement(increment);
            if (result.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune cadence trouvée avec l'increment " + increment);
            }
            return ResponseEntity.ok(result);
        }

        // Recherche par typePartie (enum, renvoie une liste) 
        if (typePartie != null) {
            try {
                Cadence.CategorieCadence cat = Cadence.CategorieCadence.valueOf(typePartie);
                List<Cadence> result = repCadence.findByTypePartie(cat);
                if (result.isEmpty()) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucune cadence trouvée pour le type de partie " + typePartie);
                }
                return ResponseEntity.ok(result);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body("typePartie invalide : " + typePartie);
            }
        }

        // --- Aucun paramètre fourni ---
        return ResponseEntity.badRequest()
                .body("Vous devez fournir un paramètre parmi : temps, increment, typePartie, libelle.");
    }


    /** 
     * GET /cadences/{id}
     * Récupérer une cadence par son ID */
    @GetMapping("/{id}")
    public ResponseEntity<?> getCadenceById(@PathVariable Long id) {
        //findById() -> renvoie Optional
        // map(ResponseEntity::ok) -> renvoie directement l'objet si présent
        // orElseGet(...) -> construit une réponse 404 si absent
        return repCadence.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucune cadence trouvée avec l'id " + id));
    }

    /**
     * GET /cadences/{id}/parties
     *  Parties associées à une cadence */
    @GetMapping("/{id}/parties")
    public ResponseEntity<?> getPartiesByCadence(@PathVariable Long id) {
        //findById() -> renvoie Optional
        // map(ResponseEntity::ok) -> renvoie directement l'objet si présent
        // orElseGet(...) -> construit une réponse 404 si absent
        return repCadence.findById(id)
                .<ResponseEntity<?>>map(c -> ResponseEntity.ok(c.getParties()))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucune cadence trouvée avec l'id " + id));
    }

    /** 
     * GET /cadences/{id}/tournois
     * Tournois associés à une cadence */
    @GetMapping("/{id}/tournois")
    public ResponseEntity<?> getTournoiByCadence(@PathVariable Long id) {

        //findById() -> renvoie Optional
        // map(ResponseEntity::ok) -> renvoie directement l'objet si présent
        // orElseGet(...) -> construit une réponse 404 si absent
        return repCadence.findById(id)
                .<ResponseEntity<?>>map(c -> ResponseEntity.ok(c.getTournois()))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Aucune cadence trouvée avec l'id " + id));
    }

}
