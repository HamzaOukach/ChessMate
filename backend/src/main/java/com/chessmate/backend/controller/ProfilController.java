package com.chessmate.backend.controller;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Profil;
import com.chessmate.backend.repository.ProfilRepository;

@RestController
@RequestMapping("/profils") //URL de base
public class ProfilController {

    private final ProfilRepository profilRep;

    public ProfilController(ProfilRepository rep) {
        this.profilRep = rep;
    }

    /**
     * GET /profils
     * Récupère tous les profils
     */
    @GetMapping
    public ResponseEntity<?> getAllProfils() {
        return ResponseEntity.ok(profilRep.findAll());
    }

    /**
     * GET /profils/search?libelle=XXX
     * Recherche un profil par son libelle
     */
    @GetMapping("/search")
    public ResponseEntity<?> getProfil(@RequestParam(value = "libelle", required = false) String libelle) {
        if (libelle != null) {
            // findByLibelle() retourne Optional<Profil>
            Optional<Profil> result = profilRep.findByLibelle(libelle);
            return result.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun profil trouvé avec le libelle '" + libelle + "'"));
        }

        return ResponseEntity.badRequest()
                .body("Vous devez fournir un paramètre : 'libelle' -> Récupérer un profil grâce à son libelle.");
    }

    /**
     * GET /profils/{id}
     * Récupère un profil par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getProfilById(@PathVariable Long id) {
        return profilRep.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun profil trouvé avec l'id " + id));
    }

    /**
     * GET /profils/{id}/users
     * Récupère les utilisateurs associés à un profil
     */
    @GetMapping("/{id}/users")
    public ResponseEntity<?> getUtilisateursByProfil(@PathVariable Long id) {
        return profilRep.findById(id)
                .<ResponseEntity<?>>map(profil -> ResponseEntity.ok(profil.getUtilisateurs()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun profil trouvé avec l'id " + id));
    }

    /**
     * GET /profils/{id}/roles
     * Récupère les rôles associés à un profil
     */
    @GetMapping("/{id}/roles")
    public ResponseEntity<?> getRolesByProfil(@PathVariable Long id) {
        return profilRep.findById(id)
                .<ResponseEntity<?>>map(profil -> ResponseEntity.ok(profil.getRoles()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun profil trouvé avec l'id " + id));
    }
}
