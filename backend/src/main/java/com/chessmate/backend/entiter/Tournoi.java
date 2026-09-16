package com.chessmate.backend.entiter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity // Entité JPA mappée à une table "tournoi"
public class Tournoi {

    @Id 
    @GeneratedValue(strategy= GenerationType.IDENTITY)
    // Identifiant unique auto-généré pour chaque tournoi
    private long id;

    @Column(unique=true)
    // Nom ou titre du tournoi, doit être unique
    private String libelle;

    // Code unique du tournoi (peut être un identifiant externe ou interne)
    private String code;

    @Column(columnDefinition = "TEXT")
    // Site web du tournoi ou page descriptive
    private String site;

    @Column(columnDefinition = "TEXT")
    // URL de diffusion du tournoi (streaming, live)
    private String broadcastUrl;

    // Date de début du tournoi
    private LocalDate dateDebut;

    // Date de création de l'entrée en base
    private LocalDateTime creeA;

    // Date de dernière modification de l'entrée
    private LocalDateTime modifierA;

    @ManyToOne
    @JoinColumn(name="id_organisateur", nullable=false)
    // Joueur qui organise le tournoi (relation ManyToOne)
    private Joueur organisateur;

    @ManyToOne
    @JoinColumn(name="id_cadence", nullable=false)
    // Cadence du tournoi (temps de jeu par joueur)
    private Cadence cadence;

    @ManyToMany
    @JoinTable(
        name = "participer", // Table pivot pour la relation ManyToMany
        joinColumns = @JoinColumn(name = "id_tournoi"), // clé étrangère vers le tournoi
        inverseJoinColumns = @JoinColumn(name = "id_joueur") // clé étrangère vers le joueur
    )
    // Joueurs participant au tournoi
    private Set<Joueur> participants = new HashSet<>();

    @OneToMany(mappedBy = "tournoi")
    @JsonIgnore
    // Liste des parties jouées dans ce tournoi (relation OneToMany)
    private List<Partie> parties;

    // Constructeur par défaut requis par JPA
    public Tournoi() {}
    
    // ------------------ GETTERS ------------------
    
    public String getLibelle() {
        return this.libelle;
    }

    public String getCode() { 
        return this.code; 
    }

    public LocalDateTime getCree_A() {
        return this.creeA;
    }

    public LocalDateTime getModifier_A() {
        return this.modifierA;
    }

    public String getBroadcastUrl() {
        return broadcastUrl;
    }

    public LocalDate getDateDebut() {
        return dateDebut;
    }

    public String getSite() {
        return site;
    }

    public Set<Joueur> getParticipants() {
        return participants;
    }

    public Joueur getOrganisateur() {
        return organisateur;
    }

    public Cadence getCadence() {
        return cadence;
    }

    public List<Partie> getParties() {
        return parties;
    }

    // ------------------ SETTERS ------------------

    public void setModifier_A(LocalDateTime dt){
        this.modifierA = dt;
    }

}
