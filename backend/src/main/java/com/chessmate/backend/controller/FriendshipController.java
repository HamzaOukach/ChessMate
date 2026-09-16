package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.chessmate.backend.entiter.Friendship;
import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.entiter.Utilisateur;
import com.chessmate.backend.repository.FriendshipRepository;
import com.chessmate.backend.repository.JoueurRepository;
import com.chessmate.backend.repository.UtilisateurRepository;

@RestController
@RequestMapping("/api/friends")
public class FriendshipController {
    private static final Logger logger = LoggerFactory.getLogger(FriendshipController.class);

    private final FriendshipRepository friendshipRepo;
    private final JoueurRepository joueurRepo;
    private final UtilisateurRepository utilisateurRepo;

    public FriendshipController(FriendshipRepository fr, JoueurRepository jr, UtilisateurRepository ur) {
        this.friendshipRepo = fr;
        this.joueurRepo = jr;
        this.utilisateurRepo = ur;
    }

    /** Get current user's Joueur from auth */
    private Joueur getCurrentJoueur(Authentication auth) {
        if (auth == null) return null;
        String email = auth.getName();
        Optional<Utilisateur> user = utilisateurRepo.findByEmail(email);
        if (user.isEmpty() || user.get().getJoueur() == null) return null;
        return user.get().getJoueur();
    }

    /** POST /api/friends/request - Send a friend request */
    @PostMapping("/request")
    public ResponseEntity<?> sendRequest(@RequestBody Map<String, String> body, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        String targetPseudo = body.get("pseudo");
        if (targetPseudo == null) return ResponseEntity.badRequest().body("Pseudo requis");

        Optional<Joueur> targetOpt = joueurRepo.findByPseudonyme(targetPseudo);
        if (targetOpt.isEmpty()) {
            logger.warn("Friend request failed: Target player '{}' not found in database", targetPseudo);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Joueur non trouvé: " + targetPseudo);
        }

        Joueur target = targetOpt.get();
        if (target.getPseudo().equalsIgnoreCase(me.getPseudo())) {
            logger.warn("Friend request failed: Player '{}' tried to add themselves", me.getPseudo());
            return ResponseEntity.badRequest().body("Vous ne pouvez pas vous ajouter vous-même");
        }

        // Check if friendship already exists
        Optional<Friendship> existing = friendshipRepo.findBetween(me, target);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            logger.info("Friend request from '{}' to '{}' already exists with status: {}", 
                me.getPseudo(), target.getPseudo(), f.getStatus());
            if (f.getStatus() == Friendship.Status.ACCEPTED) {
                return ResponseEntity.badRequest().body("Vous êtes déjà amis");
            }
            if (f.getStatus() == Friendship.Status.PENDING) {
                return ResponseEntity.badRequest().body("Demande déjà envoyée");
            }
        }

        Friendship friendship = new Friendship();
        friendship.setJoueurFrom(me);
        friendship.setJoueurTo(target);
        friendship.setStatus(Friendship.Status.PENDING);
        friendship.setCreatedAt(LocalDateTime.now());

        friendshipRepo.save(friendship);
        return ResponseEntity.ok(Map.of("message", "Demande d'ami envoyée à " + targetPseudo));
    }

    /** POST /api/friends/accept/{id} */
    @PostMapping("/accept/{id}")
    public ResponseEntity<?> acceptRequest(@PathVariable Long id, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        Optional<Friendship> fOpt = friendshipRepo.findById(id);
        if (fOpt.isEmpty()) return ResponseEntity.notFound().build();

        Friendship f = fOpt.get();
        if (f.getJoueurTo().getPseudo() == null || !f.getJoueurTo().getPseudo().equals(me.getPseudo())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Pas votre demande");
        }

        f.setStatus(Friendship.Status.ACCEPTED);
        friendshipRepo.save(f);
        return ResponseEntity.ok(Map.of("message", "Ami accepté: " + f.getJoueurFrom().getPseudo()));
    }

    /** POST /api/friends/decline/{id} */
    @PostMapping("/decline/{id}")
    public ResponseEntity<?> declineRequest(@PathVariable Long id, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        Optional<Friendship> fOpt = friendshipRepo.findById(id);
        if (fOpt.isEmpty()) return ResponseEntity.notFound().build();

        Friendship f = fOpt.get();
        if (!f.getJoueurTo().getPseudo().equals(me.getPseudo())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Pas votre demande");
        }

        f.setStatus(Friendship.Status.DECLINED);
        friendshipRepo.save(f);
        return ResponseEntity.ok(Map.of("message", "Demande refusée"));
    }

    /** GET /api/friends - List all accepted friends */
    @GetMapping
    public ResponseEntity<?> getFriends(Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        List<Friendship> friendships = friendshipRepo.findFriendsOf(me);
        List<Map<String, Object>> friends = friendships.stream().map(f -> {
            Joueur friend = f.getJoueurFrom().getPseudo().equals(me.getPseudo()) ? f.getJoueurTo() : f.getJoueurFrom();
            Map<String, Object> data = new HashMap<>();
            data.put("pseudo", friend.getPseudo());
            data.put("elo", friend.getElo());
            data.put("friendshipId", f.getId());
            return data;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(friends);
    }

    /** GET /api/friends/pending - List pending incoming requests */
    @GetMapping("/pending")
    public ResponseEntity<?> getPending(Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        List<Friendship> pending = friendshipRepo.findByJoueurToAndStatus(me, Friendship.Status.PENDING);
        List<Map<String, Object>> result = pending.stream().map(f -> {
            Map<String, Object> data = new HashMap<>();
            data.put("id", f.getId());
            data.put("from", f.getJoueurFrom().getPseudo());
            data.put("createdAt", f.getCreatedAt().toString());
            return data;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /** GET /api/friends/search?query=xxx - Search players by pseudo prefix (public endpoint) */
    @GetMapping("/search")
    public ResponseEntity<?> searchPlayers(@RequestParam String query) {
        if (query == null || query.length() < 2) {
            return ResponseEntity.badRequest().body("Recherche: minimum 2 caractères");
        }

        List<Joueur> found = joueurRepo.findByPseudonymeContainingIgnoreCase(query);
        List<Map<String, Object>> results = found.stream()
            .limit(10)
            .map(j -> {
                Map<String, Object> data = new HashMap<>();
                data.put("id", j.getId());
                data.put("pseudo", j.getPseudo());
                data.put("elo", j.getElo());
                return data;
            })
            .collect(Collectors.toList());

        return ResponseEntity.ok(results);
    }
}
