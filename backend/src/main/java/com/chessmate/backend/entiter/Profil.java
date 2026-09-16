package com.chessmate.backend.entiter;

import java.util.Set;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;

@Entity // Entité JPA mappée à une table en base de données
public class Profil {

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique du profil, généré automatiquement par la base
    private long id;
    
    // Nom ou libellé du profil (ex: "Admin", "Utilisateur")
    private String libelle;

    @ManyToMany(mappedBy = "profils")
    // Ensemble des utilisateurs associés à ce profil
    private Set<Utilisateur> utilisateurs;

    @ManyToMany(mappedBy = "profils")
    // Ensemble des rôles associés à ce profil
    private Set<Role> roles;

    // Constructeur par défaut requis par JPA
    public Profil() {}

    // Getter du libellé
    public String getLibelle() { 
        return this.libelle; 
    }

    // Getter des utilisateurs associés
    public Set<Utilisateur> getUtilisateurs() {
        return utilisateurs;
    }

    // Getter des rôles associés
    public Set<Role> getRoles() {
        return roles;
    }
}
