package com.chessmate.backend.entiter;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;

@Entity // Entité JPA mappée à une table en base de données
public class Cadence {

    // Attributs de la classe

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique de la cadence, généré automatiquement par la base de données
    private long id;

    @Column(nullable = false, unique = true)
    // Libellé de la cadence, non nul et unique
    private String libelle;

    // Temps initial de la cadence (en minutes ou secondes selon usage)
    private int temps;

    // Increment par coup (optionnel selon type de cadence)
    private int increment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    // Type de partie (Bullet, Blitz, Rapide, Classique) stocké en tant que chaîne en DB
    private CategorieCadence typePartie;

    @OneToMany(mappedBy = "cadence")
    @JsonIgnore
    // Relation OneToMany : une cadence peut être associée à plusieurs parties
    private List<Partie> parties;

    @OneToMany(mappedBy = "cadence")
    @JsonIgnore
    // Relation OneToMany : une cadence peut être associée à plusieurs tournois
    private List<Tournoi> tournois;

    // Constructeur vide requis par JPA
    public Cadence() {}

    // ------------------ Getters ------------------

    public String getLibelle() {
        return this.libelle;
    }

    public int getTempsCadence() {
        return this.temps;
    }

    public int getIncrement() {
        return this.increment;
    }

    public CategorieCadence getTypePartie() {
        return typePartie;
    }

    public List<Partie> getParties() {
        return parties;
    }

    public List<Tournoi> getTournois() {
        return tournois;
    }

    // ------------------ Enum ------------------
    // Définition des différentes catégories de cadence possibles
    public enum CategorieCadence {
        Bullet, Blitz, Rapide, Classique
    }
}
