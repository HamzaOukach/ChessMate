package com.chessmate.backend.entiter;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.ManyToMany;

@Entity // Entité JPA mappée à une table en base de données
public class Joueur {

    // ---------------- Attributs ----------------
    
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique du joueur, généré automatiquement par la base de données
    private long id;

    @Column(nullable = false, unique = true, length = 50)
    @JsonAlias("pseudo")  // Accept both "pseudo" and "pseudonyme" in JSON input
    // Pseudonyme unique du joueur, obligatoire et limité à 50 caractères
    private String pseudonyme;

    private int elo; // Note Elo du joueur
    private int nbVictoires; // Nombre de victoires
    private int nbDefaites;  // Nombre de défaites
    private int nbNulles;    // Nombre de parties nulles
    private String equipe;   // Équipe à laquelle le joueur appartient
    private String fideId;   // Identifiant FIDE du joueur (si applicable)

    // ---------------- Relations ----------------
    
    @OneToOne(mappedBy = "joueur")
    @JsonBackReference
    // Association avec l'utilisateur : un joueur correspond à un seul utilisateur
    private Utilisateur utilisateur;

    @OneToMany(mappedBy = "organisateur")
    // Liste des tournois organisés par ce joueur (relation 1-n)
    private List<Tournoi> tournoisOrganises;

    @ManyToMany(mappedBy = "participants")
    // Liste des tournois auxquels ce joueur participe (relation n-n)
    private List<Tournoi> tournoisParticipes;

    // ---------------- Constructeur ----------------

    public Joueur() {} // Constructeur par défaut requis par JPA

    // ---------------- Getters ----------------

    public Long getId() {
        return this.id;
    }

    public String getPseudo() {
        return this.pseudonyme;
    }

    public int getElo() {
        return this.elo;
    }

    public long getNbVictoires() {
        return this.nbVictoires;
    }

    public long getNbDefaites() {
        return this.nbDefaites;
    }

    public long getNbNulles() {
        return this.nbNulles;
    }

    public String getEquipe() {
        return this.equipe;
    }

    public String getFide_id() {
        return this.fideId;
    }

    public Utilisateur getUtilisateur() {
        return utilisateur;
    }

    public List<Tournoi> getTournoisOrganises() {
        return tournoisOrganises;
    }

    public List<Tournoi> getTournoisParticipes() {
        return tournoisParticipes;
    }

    // ---------------- Setters ----------------

    public void setPseudo(String pseudo) {
        this.pseudonyme = pseudo;
    }

    public void setElo(int elo) {
        this.elo = elo;
    }

    public void setNbVictoires(int nbVictoires) {
        this.nbVictoires = nbVictoires;
    }

    public void setNbDefaites(int nbDefaites) {
        this.nbDefaites = nbDefaites;
    }

    public void setNbNulles(int nbNulles) {
        this.nbNulles = nbNulles;
    }
}
