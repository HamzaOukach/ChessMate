package com.chessmate.backend.entiter;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity // Entité JPA mappée à une table en base de données
public class Partie {

    // ---------------- Attributs ----------------
    
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // Identifiant unique de la partie, généré automatiquement par la base
    private long id;

    private String title; // Titre ou nom de la partie
    private Short resultat; // Résultat de la partie (ex : 1=victoire blanc, 0=égalité, -1=victoire noir)

    @Column(columnDefinition = "TEXT")
    // PGN de la partie (notation des coups)
    private String pgn;

    private LocalDateTime dateHeureUTC; // Date et heure de la partie en UTC
    private Short eloBlanc; // Elo du joueur blanc
    private Short eloNoir;  // Elo du joueur noir
    private Short scoreBlancDiff; // Différence de score pour le joueur blanc
    private Short scoreNoirDiff;  // Différence de score pour le joueur noir
    private String titreBlanc; // Titre du joueur blanc (ex : GM, IM)
    private String titreNoir;  // Titre du joueur noir
    private String typeResultat; // Type de résultat (normal, abandon, etc.)
    @Column(name = "\"round\"")
    private String round; // Numéro du round dans un tournoi
    
    @Column(columnDefinition = "TEXT")
    private String broadcastUrl; // URL de diffusion de la partie
   
    @Column(columnDefinition = "TEXT")
    private String gameUrl; // URL de la partie sur un site externe
    
    private String variant; // Variante de l'échec (blitz, bullet, etc.)

    // ---------------- Relations JPA ----------------
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_suite_coups_stats", nullable = false)
    // Plusieurs parties peuvent partager la même suite de coups
    private SuiteCoupsStats suiteCoupsStats;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hash_position_stats", nullable = false)
    // Relation vers PositionStats pour l'état des positions de la partie
    private PositionStats positionStats;

    @ManyToOne
    @JoinColumn(name = "id_ouverture", nullable = false)
    // L'ouverture jouée dans la partie
    private Ouverture ouverture;

    @ManyToOne
    @JoinColumn(name = "id_cadence", nullable = false)
    // La cadence associée à la partie
    private Cadence cadence;

    @ManyToOne
    @JoinColumn(name = "id_joueur_blanc", nullable = false)
    private Joueur joueurBlanc; // Joueur blanc

    @ManyToOne
    @JoinColumn(name = "id_joueur_noir", nullable = false)
    private Joueur joueurNoir;  // Joueur noir

    @ManyToOne
    @JoinColumn(name = "id_tournoi", nullable = false)
    private Tournoi tournoi; // Tournoi auquel appartient la partie

    // ---------------- Constructeur ----------------
    
    public Partie() {} // Constructeur par défaut requis par JPA

    // ---------------- Getters ----------------

    public Long getId() { return this.id; }
    public Short getResultat() { return this.resultat; }
    public String getPgnPartie() { return this.pgn; }
    public Short getScore_Blanc_Diff() { return this.scoreBlancDiff; }
    public Short getScore_Noir_Diff() { return this.scoreNoirDiff; }
    public String getTitre_blanc() { return this.titreBlanc; }
    public String getTitre_noir() { return this.titreNoir; }
    public String getType_Resultat() { return this.typeResultat; }
    public String getRound() { return this.round; }
    public Short getElo_Blanc() { return this.eloBlanc; }
    public Short getElo_Noir() { return this.eloNoir; }
    public LocalDateTime getDateHeurePartie() { return this.dateHeureUTC; }

    public String getTitle() { return title; }
    public String getBroadcastUrl() { return broadcastUrl; }
    public String getGameUrl() { return gameUrl; }
    public String getVariant() { return variant; }

    public Cadence getCadence() { return cadence; }
    public Joueur getJoueurBlanc() { return joueurBlanc; }
    public Joueur getJoueurNoir() { return joueurNoir; }
    public Tournoi getTournoi() { return tournoi; }
    public Ouverture getOuverture() { return ouverture; }
    public SuiteCoupsStats getSuiteCoupsStats() { return suiteCoupsStats; }
}
