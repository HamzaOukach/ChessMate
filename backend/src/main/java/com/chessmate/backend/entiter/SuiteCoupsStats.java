package com.chessmate.backend.entiter;

import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity // Entité JPA mappée à une table en base de données
public class SuiteCoupsStats {

    @Id 
    @GeneratedValue(strategy= GenerationType.IDENTITY)
    // Identifiant unique auto-généré pour chaque suite de coups
    private long id;

    @Column(columnDefinition = "TEXT", nullable=false)
    // PGN (notation des coups) pour cette suite
    private String pgn;
    
    @Column(columnDefinition = "INT DEFAULT 0")
    // Nombre de victoires pour cette suite de coups
    private int nbVictoires = 0;

    @Column(columnDefinition = "INT DEFAULT 0")
    // Nombre de défaites pour cette suite de coups
    private int nbDefaites = 0 ;

    @Column(columnDefinition = "INT DEFAULT 0")
    // Nombre de parties nulles pour cette suite de coups
    private int nbNulles = 0;

    // Probabilité estimée de ce coup ou de cette suite
    private String probabiliteCoup;

    @ManyToOne
    @JoinColumn(name="id_suite_coups_stats_precedente")
    // Référence vers la suite de coups précédente dans la chaîne
    private SuiteCoupsStats suitePrecedente;

    @OneToMany(mappedBy = "suitePrecedente")
    // Liste des suites de coups suivantes liées à cette suite
    private List<SuiteCoupsStats> suitesSuivantes;
    
    // Constructeur par défaut requis par JPA
    public SuiteCoupsStats() {}

    // Getters pour accéder aux champs privés
    public String getPgn() {
        return pgn;
    }

    public int getNbVictoires() {
        return nbVictoires;
    }

    public int getNbDefaites() {
        return nbDefaites;
    }

    public int getNbNulles() {
        return nbNulles;
    }

    public String getProbabiliteCoup() {
        return probabiliteCoup;
    }

    public SuiteCoupsStats getSuiteCoupsStatsPrecedente() {
        return suitePrecedente;
    }

    public List<SuiteCoupsStats> getSuitesSuivantes() {
        return suitesSuivantes;
    }
}
