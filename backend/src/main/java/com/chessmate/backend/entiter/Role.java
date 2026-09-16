package com.chessmate.backend.entiter;

import java.util.Set;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;

@Entity // Entité JPA mappée à une table en base de données
public class Role {

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique du rôle, généré automatiquement par la base
    private long id;

    // Nom ou libellé du rôle (ex: "ADMIN", "USER")
    private String libelle;

    @ManyToMany(mappedBy = "roles")
    // Ensemble des utilisateurs associés à ce rôle
    private Set<Utilisateur> utilisateurs;

    @ManyToMany
    @JoinTable(
        name = "profil_role", // Nom de la table intermédiaire pour la relation many-to-many
        joinColumns = @JoinColumn(name = "id_role"), // Colonne de jointure pour cette entité (Role)
        inverseJoinColumns = @JoinColumn(name = "id_profil") // Colonne de jointure pour l'entité Profil
    )
    // Ensemble des profils associés à ce rôle
    private Set<Profil> profils;

    // Constructeur par défaut requis par JPA
    public Role() {}

    // Getter du libellé
    public String getLibelle() { 
        return this.libelle; 
    }

    // Getter des utilisateurs associés
    public Set<Utilisateur> getUtilisateurs() {
        return utilisateurs;
    }

    // Getter des profils associés
    public Set<Profil> getProfils() {
        return profils;
    }
}
