package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.configuration.JwtUtils;
import com.chessmate.backend.entiter.Utilisateur;
import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.repository.JoueurRepository;
import com.chessmate.backend.repository.UtilisateurRepository;

@RestController
@RequestMapping("/api/auth") // Toutes les routes de ce controller commenceront par /api/auth
public class RegistrationLoginController {

    // Dépendances injectées dans le controller
    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final JoueurRepository joueurRepository;

    // Constructeur pour injection manuelle des dépendances
    public RegistrationLoginController(UtilisateurRepository r, PasswordEncoder p, JwtUtils j, AuthenticationManager a,
            JoueurRepository jt) {
        this.utilisateurRepository = r;
        this.jwtUtils = j;
        this.passwordEncoder = p;
        this.authenticationManager = a;
        this.joueurRepository = jt;
    }

    /**
     * Endpoint pour enregistrer un nouvel utilisateur
     * POST /api/auth/register
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody Utilisateur utilisateur) {
        // Vérifier si l'email existe déjà
        if (!utilisateurRepository.findByEmail(utilisateur.getEmail()).isEmpty()) {
            return ResponseEntity.badRequest().body("Ce email existe déja !");
        }

        // Hasher le mot de passe avant de l'enregistrer
        utilisateur.setHash(passwordEncoder.encode(utilisateur.getHash()));
        // Définir la date d'inscription à maintenant
        utilisateur.setInscrit_A(LocalDateTime.now());

        // Vérifier si un joueur est associé à cet utilisateur
        if (utilisateur.getJoueur() != null && utilisateur.getJoueur().getPseudo() != null) {
            Optional<Joueur> monjoueur = joueurRepository.findByPseudonyme(utilisateur.getJoueur().getPseudo());
            if (monjoueur.isPresent()) {
                // Si le joueur existe, l'associer à l'utilisateur
                utilisateur.setJoueur(monjoueur.get());
            } else {
                // Si le pseudo n'existe pas, créer un nouveau joueur
                Joueur newJoueur = new Joueur();
                newJoueur.setPseudo(utilisateur.getJoueur().getPseudo());
                newJoueur.setElo(800); // Default ELO
                // Sauvegarder le nouveau joueur
                Joueur savedJoueur = joueurRepository.save(newJoueur);
                utilisateur.setJoueur(savedJoueur);
            }
        } else {
            // Si aucun joueur n'est fourni, créer un joueur par défaut avec l'email comme
            // pseudo
            Joueur defaultJoueur = new Joueur();
            defaultJoueur.setPseudo(utilisateur.getEmail().split("@")[0]); // Utiliser la partie avant @ comme pseudo
            defaultJoueur.setElo(800); // Default ELO
            Joueur savedJoueur = joueurRepository.save(defaultJoueur);
            utilisateur.setJoueur(savedJoueur);
        }

        // Sauvegarder l'utilisateur dans la base de données et renvoyer l'objet créé
        return ResponseEntity.ok(utilisateurRepository.save(utilisateur));
    }

    /**
     * Endpoint pour authentifier un utilisateur
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Utilisateur utilisateur) {
        try {
            // Tenter l'authentification avec l'email et le mot de passe fournis
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(utilisateur.getEmail(), utilisateur.getHash()));

            if (authentication.isAuthenticated()) {
                // Si authentifié, récupérer l'utilisateur en base
                Optional<Utilisateur> userFromOpt = utilisateurRepository.findByEmail(utilisateur.getEmail());
                if (userFromOpt.isPresent()) {
                    Utilisateur userFromDb = userFromOpt.get();
                    // Mettre à jour la dernière connexion
                    userFromDb.setConnexion_A(LocalDateTime.now());
                    utilisateurRepository.save(userFromDb);

                    // Générer un token JWT et le renvoyer dans la réponse
                    Map<String, Object> authData = new HashMap<>();
                    authData.put("token", jwtUtils.generateToken(utilisateur.getEmail()));
                    authData.put("type", "Bearer");
                    authData.put("email", userFromDb.getEmail());
                    if (userFromDb.getJoueur() != null) {
                        authData.put("username", userFromDb.getJoueur().getPseudo());
                        authData.put("joueurId", userFromDb.getJoueur().getId());
                    } else {
                        authData.put("username",
                                userFromDb.getNom() != null ? userFromDb.getNom() : userFromDb.getEmail());
                    }
                    return ResponseEntity.ok(authData);
                }
            }

            // Si l'authentification a échoué, renvoyer 401
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid email or password");
        } catch (AuthenticationException e) {
            // En cas d'exception lors de l'authentification
            System.out.println(e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid email or password");
        }
    }
}
