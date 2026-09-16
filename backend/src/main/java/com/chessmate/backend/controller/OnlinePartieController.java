package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.*;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.entiter.OnlinePartie;
import com.chessmate.backend.repository.JoueurRepository;
import com.chessmate.backend.repository.OnlinePartieRepository;

@RestController
@RequestMapping("/api/online-parties")
public class OnlinePartieController {

    private final OnlinePartieRepository partieRepo;
    private final JoueurRepository joueurRepo;
    private final com.chessmate.backend.service.EloService eloService;

    public OnlinePartieController(OnlinePartieRepository pr, JoueurRepository jr, com.chessmate.backend.service.EloService es) {
        this.partieRepo = pr;
        this.joueurRepo = jr;
        this.eloService = es;
    }

    /** POST /api/online-parties/save - Called by ai_engine to save game results */
    @PostMapping("/save")
    public ResponseEntity<?> saveGameResult(@RequestBody Map<String, Object> body) {
        try {
            String gameId = (String) body.get("gameId");
            String whitePseudo = (String) body.get("white");
            String blackPseudo = (String) body.get("black");
            int resultat = ((Number) body.get("resultat")).intValue();
            String resultType = (String) body.get("resultType");
            String pgn = (String) body.get("pgn");
            String timeControl = (String) body.get("timeControl");
            int totalMoves = ((Number) body.get("totalMoves")).intValue();

            Optional<Joueur> whiteOpt = joueurRepo.findByPseudonyme(whitePseudo);
            Optional<Joueur> blackOpt = joueurRepo.findByPseudonyme(blackPseudo);

            if (whiteOpt.isEmpty() || blackOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Joueur(s) non trouv\u00e9(s)");
            }

            Joueur white = whiteOpt.get();
            Joueur black = blackOpt.get();

            OnlinePartie partie = new OnlinePartie();
            partie.setGameId(gameId);
            partie.setJoueurBlanc(white);
            partie.setJoueurNoir(black);
            partie.setResultat((short) resultat);
            partie.setResultType(resultType);
            partie.setPgn(pgn);
            partie.setTimeControl(timeControl);
            partie.setTotalMoves(totalMoves);
            partie.setPlayedAt(LocalDateTime.now());

            partieRepo.save(partie);

            // Update ELO for multiplayer games
            eloService.updateElo(white, black, resultat);

            return ResponseEntity.ok(Map.of("message", "Partie sauvegard\u00e9e et ELO mis \u00e0 jour", "id", partie.getId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Erreur: " + e.getMessage());
        }
    }

    /** GET /api/online-parties/player/{pseudo} - Get game history for a player */
    @GetMapping("/player/{pseudo}")
    public ResponseEntity<?> getPlayerGames(@PathVariable String pseudo) {
        Optional<Joueur> joueurOpt = joueurRepo.findByPseudonyme(pseudo);
        if (joueurOpt.isEmpty()) return ResponseEntity.notFound().build();

        List<OnlinePartie> parties = partieRepo.findByJoueur(joueurOpt.get());
        List<Map<String, Object>> result = parties.stream().map(p -> {
            Map<String, Object> data = new HashMap<>();
            data.put("id", p.getId());
            data.put("gameId", p.getGameId());
            data.put("white", p.getJoueurBlanc().getPseudo());
            data.put("black", p.getJoueurNoir().getPseudo());
            data.put("whiteElo", p.getJoueurBlanc().getElo());
            data.put("blackElo", p.getJoueurNoir().getElo());
            data.put("resultat", p.getResultat());
            data.put("resultType", p.getResultType());
            data.put("timeControl", p.getTimeControl());
            data.put("totalMoves", p.getTotalMoves());
            data.put("playedAt", p.getPlayedAt().toString());
            return data;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /** GET /api/online-parties/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return partieRepo.findById(id)
                .map(p -> {
                    Map<String, Object> data = new HashMap<>();
                    data.put("id", p.getId());
                    data.put("gameId", p.getGameId());
                    data.put("titre", "Multiplayer " + p.getGameId());
                    data.put("dateHeure", p.getPlayedAt());
                    data.put("resultat", p.getResultat() == 1 ? "Victoire blanc" : p.getResultat() == -1 ? "Victoire noir" : "Nulle");
                    data.put("variant", p.getTimeControl());
                    data.put("nombreCoups", p.getTotalMoves());
                    data.put("joueurBlanc", Map.of("pseudonyme", p.getJoueurBlanc().getPseudo(), "elo", p.getJoueurBlanc().getElo()));
                    data.put("joueurNoir", Map.of("pseudonyme", p.getJoueurNoir().getPseudo(), "elo", p.getJoueurNoir().getElo()));
                    data.put("eloBlanc", p.getJoueurBlanc().getElo());
                    data.put("eloNoir", p.getJoueurNoir().getElo());
                    return ResponseEntity.ok(data);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/joueurs")
    public ResponseEntity<?> getJoueurs(@PathVariable Long id) {
        return partieRepo.findById(id)
                .map(p -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("joueurBlanc", Map.of("pseudonyme", p.getJoueurBlanc().getPseudo(), "elo", p.getJoueurBlanc().getElo()));
                    result.put("joueurNoir", Map.of("pseudonyme", p.getJoueurNoir().getPseudo(), "elo", p.getJoueurNoir().getElo()));
                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/ouverture")
    public ResponseEntity<?> getOuverture(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("libelle", "Multiplayer Game", "code", "ONLINE"));
    }

    @GetMapping("/{id}/suiteCoups")
    public ResponseEntity<?> getSuiteCoups(@PathVariable Long id) {
        return partieRepo.findById(id)
                .map(p -> ResponseEntity.ok(Map.of("pgn", p.getPgn())))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tournoi")
    public ResponseEntity<?> getTournoi(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("libelle", "ChessMate Online", "code", "ONLINE"));
    }
}
