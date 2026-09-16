package com.chessmate.backend.entiter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity // Entité JPA mappée à une table en base de données
public class Ouverture {

    // ---------------- Attributs ----------------
    
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique de l'ouverture, généré automatiquement par la base de données
    private long id;

    @Column(nullable = false)
    // Code de l'ouverture, obligatoire
    private String code;

    @Column(nullable = false)
    // Libellé ou nom de l'ouverture, obligatoire
    private String libelle;

    @ManyToOne
    @JoinColumn(name = "id_suite_coups_stats")
    // Relation Many-to-One vers SuiteCoupsStats : plusieurs ouvertures peuvent partager la même suite de coups
    private SuiteCoupsStats suiteCoupsStats;

    // ---------------- Constructeur ----------------
    
    public Ouverture() {} // Constructeur par défaut requis par JPA

    // ---------------- Getters ----------------

    public String getCodeOuverture() {
        return this.code; // Retourne le code de l'ouverture
    }

    public String getLibelleOuverture() {
        return this.libelle; // Retourne le libellé de l'ouverture
    }

    public SuiteCoupsStats getSuiteCoupsStats() {
        return suiteCoupsStats; // Retourne la suite de coups associée à l'ouverture
    }
}
