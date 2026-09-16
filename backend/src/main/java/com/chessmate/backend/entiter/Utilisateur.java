package com.chessmate.backend.entiter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToOne;

@Entity // Entité JPA mappée à la table "Utilisateurs"
public class Utilisateur {

    @Id 
    @GeneratedValue(strategy= GenerationType.IDENTITY)
    // Identifiant unique auto-généré pour chaque utilisateur
    private long id;

    // Nom et prénom de l'utilisateur
    private String nom;
    private String prenom;

    // Rôle simple de l'utilisateur (ex : admin, user)
    private String role;

    @Column(nullable=false, unique=true)
    // Email unique, obligatoire pour l'identification
    private String email;

    @Column(nullable=false)
    // Hash du mot de passe stocké (chiffré)
    private String hash;

    @Column(name = "inscription_a", nullable=false)
    // Date d'inscription de l'utilisateur
    private LocalDateTime inscriptionA;

    @Column(name = "connexion_a")
    // Date de dernière connexion
    private LocalDateTime connexionA;

    @Column(name = "banni_a")
    // Date de bannissement (si applicable)
    private LocalDateTime banniA;

    @OneToOne
    @JoinColumn(name = "id_joueur", unique = true, nullable = true)
    @JsonManagedReference
    // Relation OneToOne avec le joueur associé à l'utilisateur
    private Joueur joueur;

    @ManyToMany
    @JoinTable(
        name = "utilisateur_role", // Table pivot pour la relation ManyToMany
        joinColumns = @JoinColumn(name = "id_utilisateur"), // clé étrangère vers Utilisateur
        inverseJoinColumns = @JoinColumn(name = "id_role") // clé étrangère vers Role
    )
    // Rôles associés à l'utilisateur
    private Set<Role> roles;

    @ManyToMany
    @JoinTable(
        name = "utilisateur_profil", // Table pivot pour la relation ManyToMany
        joinColumns = @JoinColumn(name = "id_utilisateur"), // clé étrangère vers Utilisateur
        inverseJoinColumns = @JoinColumn(name = "id_profil") // clé étrangère vers Profil
    )
    // Profils associés à l'utilisateur
    private Set<Profil> profils = new HashSet<>();


    // ------------------ GETTERS ------------------

    public long getId() { return this.id; }
    public String getEmail(){ return this.email; }
    public String getNom(){ return this.nom; }
    public String getPrenom(){ return this.prenom; }
    public String getHash() { return this.hash; }
    public String getRole() { return this.role; }

    public LocalDateTime getInscrit_A(){ return this.inscriptionA; }
    public LocalDateTime getConnexion_A(){ return this.connexionA; }
    public LocalDateTime getBanni_A(){ return this.banniA; }

    public Joueur getJoueur() {
        return joueur;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public Set<Profil> getProfils() {
        return profils;
    }

    // ------------------ SETTERS ------------------

    public void setEmail(String email){ this.email = email; }
    public void setNom(String nom){ this.nom = nom; }
    public void setPrenom(String prenom){ this.prenom = prenom; }
    public void setHash(String hash){ this.hash = hash; }
    public void setRole(String role) { this.role = role; }

    public void setInscrit_A(LocalDateTime inscription_a){ this.inscriptionA = inscription_a; }
    public void setConnexion_A(LocalDateTime connexion_a){ this.connexionA = connexion_a; }
    public void setBanni_A(LocalDateTime banni_a){ this.banniA= banni_a; }

    public void setJoueur(Joueur j){ this.joueur=j; }

}
