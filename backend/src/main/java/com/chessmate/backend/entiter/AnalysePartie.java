package com.chessmate.backend.entiter;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "analyse_partie",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"joueur_id", "partie_id"})
    }
)
public class AnalysePartie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "partie_id", nullable = false)
    private Long partieId;

    @Column(name = "joueur_id", nullable = false)
    private Long joueurId;

    @Column(name = "precision")
    private Double precision;
    
    @Column(name = "analysed_at")
    private LocalDateTime analysedAt;

    public AnalysePartie() {}
    
    public AnalysePartie(Long partieId, Long joueurId, Double precision) {
        this.partieId = partieId;
        this.joueurId = joueurId;
        this.precision = precision;
        this.analysedAt = LocalDateTime.now();
    }

    // Getters et Setters
    public Long getPartieId() { return this.partieId; }
    public Long getJoueurId() { return this.joueurId; }
    public Double getPrecision() { return this.precision; }
    public LocalDateTime getAnalysedAt() { return this.analysedAt; }

    public void setPartieId(Long id) { this.partieId = id; }
    public void setJoueurId(Long id) { this.joueurId = id; }
    public void setPrecision(Double p) { this.precision = p; }
    public void setAnalyseAt(LocalDateTime t) { this.analysedAt = t; }
}