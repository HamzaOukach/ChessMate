package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.chessmate.backend.dto.CreatePartieJoueeRequest;
import com.chessmate.backend.entiter.PartieJouee;
import com.chessmate.backend.repository.PartieJoueeRepository;
import com.chessmate.backend.service.PartieJoueeService;

@RestController
@RequestMapping("/parties-jouees")
public class PartieJoueeController {

    private final PartieJoueeRepository partieJoueeRepository;
    private final PartieJoueeService partieJoueeService;

    public PartieJoueeController(PartieJoueeRepository partieJoueeRepository,
                                  PartieJoueeService partieJoueeService) {
        this.partieJoueeRepository = partieJoueeRepository;
        this.partieJoueeService = partieJoueeService;
    }

    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(required = false) String pseudo) {
        if (pseudo != null && !pseudo.isEmpty()) {
            return ResponseEntity.ok(partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo));
        }
        return ResponseEntity.ok(partieJoueeRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return partieJoueeRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie jouée trouvée avec l'id " + id));
    }

    @GetMapping("/{id}/joueurs")
    public ResponseEntity<?> getJoueurs(@PathVariable Long id) {
        return partieJoueeRepository.findById(id)
                .<ResponseEntity<?>>map(partie -> {
                    Map<String, Object> result = new HashMap<>();
                    Map<String, Object> blanc = new HashMap<>();
                    Map<String, Object> noir = new HashMap<>();

                    blanc.put("pseudonyme", partie.getJoueurBlanc());
                    noir.put("pseudonyme", partie.getJoueurNoir());

                    result.put("joueurBlanc", blanc);
                    result.put("joueurNoir", noir);

                    return ResponseEntity.ok(result);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie jouée trouvée avec l'id " + id));
    }

    @GetMapping("/{id}/ouverture")
    public ResponseEntity<?> getOuverture(@PathVariable Long id) {
        return partieJoueeRepository.findById(id)
                .<ResponseEntity<?>>map(partie -> {
                    Map<String, Object> ouverture = new HashMap<>();
                    ouverture.put("libelle", partie.getOuverture());
                    ouverture.put("code", "LOCAL");
                    return ResponseEntity.ok(ouverture);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie jouée trouvée avec l'id " + id));
    }

    @GetMapping("/{id}/suiteCoups")
    public ResponseEntity<?> getSuiteCoups(@PathVariable Long id) {
        return partieJoueeRepository.findById(id)
                .<ResponseEntity<?>>map(partie -> {
                    Map<String, Object> suiteCoups = new HashMap<>();
                    suiteCoups.put("pgn", partie.getPgn());
                    return ResponseEntity.ok(suiteCoups);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie jouée trouvée avec l'id " + id));
    }

    @GetMapping("/{id}/tournoi")
    public ResponseEntity<?> getTournoi(@PathVariable Long id) {
        return partieJoueeRepository.findById(id)
                .<ResponseEntity<?>>map(partie -> {
                    Map<String, Object> tournoi = new HashMap<>();
                    tournoi.put("libelle", "Partie locale");
                    tournoi.put("code", partie.getSource());
                    tournoi.put("dateDebut", partie.getDateHeure() != null ? partie.getDateHeure().toLocalDate() : null);
                    return ResponseEntity.ok(tournoi);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucune partie jouée trouvée avec l'id " + id));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreatePartieJoueeRequest request) {
        PartieJouee partie = new PartieJouee();

        partie.setTitre(request.getTitre());
        partie.setJoueurBlanc(request.getJoueurBlanc());
        partie.setJoueurNoir(request.getJoueurNoir());
        partie.setResultat(request.getResultat());
        partie.setVariant(request.getVariant());
        partie.setOuverture(request.getOuverture());
        partie.setSource(request.getSource());
        partie.setVainqueur(request.getVainqueur());
        partie.setNombreCoups(request.getNombreCoups());
        partie.setPgn(request.getPgn());
        partie.setResumeAnalyse(request.getResumeAnalyse());
        partie.setDateHeure(LocalDateTime.now());

        PartieJouee saved = partieJoueeService.enregistrerPartie(partie);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}