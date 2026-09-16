package com.chessmate.backend.controller;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chessmate.backend.entiter.Role;
import com.chessmate.backend.repository.RoleRepository;

@RestController
@RequestMapping("/roles") //URL de base
public class RoleController {

    private final RoleRepository roleRep;

    public RoleController(RoleRepository rep) {
        this.roleRep = rep;
    }

    /**
     * GET /roles
     * Récupère tous les rôles
     */
    @GetMapping
    public ResponseEntity<?> getAllRoles() {
        return ResponseEntity.ok(roleRep.findAll());
    }

    /**
     * GET /roles/search?libelle=XXX
     * Recherche un rôle par son libelle
     */
    @GetMapping("/search")
    public ResponseEntity<?> getRole(@RequestParam(value = "libelle", required = false) String libelle) {
        if (libelle != null) {
            Optional<Role> result = roleRep.findByLibelle(libelle);
            return result.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body("Aucun rôle trouvé avec le libelle '" + libelle + "'"));
        }

        return ResponseEntity.badRequest()
                .body("Vous devez fournir un paramètre : 'libelle' -> Récupérer un rôle grâce à son libelle.");
    }

    /**
     * GET /roles/{id}
     * Récupère un rôle par son ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRoleById(@PathVariable Long id) {
        return roleRep.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun rôle trouvé avec l'id " + id));
    }

    /**
     * GET /roles/{id}/users
     * Récupère les utilisateurs associés à un rôle
     */
    @GetMapping("/{id}/users")
    public ResponseEntity<?> getUtilisateursByRole(@PathVariable Long id) {
        return roleRep.findById(id)
                .<ResponseEntity<?>>map(role -> ResponseEntity.ok(role.getUtilisateurs()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun rôle trouvé avec l'id " + id));
    }

    /**
     * GET /roles/{id}/profils
     * Récupère les profils associés à un rôle
     */
    @GetMapping("/{id}/profils")
    public ResponseEntity<?> getProfilsByRole(@PathVariable Long id) {
        return roleRep.findById(id)
                .<ResponseEntity<?>>map(role -> ResponseEntity.ok(role.getProfils()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Aucun rôle trouvé avec l'id " + id));
    }
}
