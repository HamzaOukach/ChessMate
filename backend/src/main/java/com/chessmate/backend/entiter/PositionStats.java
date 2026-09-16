package com.chessmate.backend.entiter;

import java.time.LocalDateTime;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity // Entité JPA mappée à une table en base de données
public class PositionStats {

    @Id 
    // Identifiant unique de la position (hash UUID)
    private UUID hash;

    @Column(columnDefinition = "TEXT", nullable = false)
    // Stocke la position FEN (notation Forsyth-Edwards pour décrire la position sur l'échiquier)
    private String fen;
    
    @Column(columnDefinition = "BIGINT", nullable = false)
    // Nombre total de parties ayant atteint cette position
    private long nbTotal;

    @Column(columnDefinition = "BIGINT", nullable = false)
    // Nombre de victoires du joueur blanc à partir de cette position
    private long nbVictoiresBlanc;

    @Column(columnDefinition = "BIGINT", nullable = false)
    // Nombre de victoires du joueur noir à partir de cette position
    private long nbVictoiresNoir;

    @Column(columnDefinition = "BIGINT", nullable = false)
    // Nombre de parties nulles à partir de cette position
    private long nbNulles;

    @Column(nullable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    // Date de la dernière mise à jour des statistiques
    private LocalDateTime updatedAt;

    // Constructeur par défaut requis par JPA
    public PositionStats() {}
}
