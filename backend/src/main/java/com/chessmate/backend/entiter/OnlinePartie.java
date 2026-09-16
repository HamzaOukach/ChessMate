package com.chessmate.backend.entiter;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Lightweight entity for storing online multiplayer game results.
 * Separate from the existing Partie entity which has complex foreign keys
 * (Ouverture, Cadence, Tournoi, etc.) that don't apply to casual online games.
 */
@Entity
public class OnlinePartie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(nullable = false, unique = true)
    private String gameId; // UUID from the WebSocket game room

    @ManyToOne
    @JoinColumn(name = "id_joueur_blanc", nullable = false)
    private Joueur joueurBlanc;

    @ManyToOne
    @JoinColumn(name = "id_joueur_noir", nullable = false)
    private Joueur joueurNoir;

    /** 1 = white wins, 0 = draw, -1 = black wins */
    private short resultat;

    private String resultType; // "checkmate", "timeout", "resign", "draw", "disconnect"

    @Column(columnDefinition = "TEXT")
    private String pgn; // Move history in UCI format (space-separated)

    private String timeControl; // e.g. "5+3"

    @Column(nullable = false)
    private LocalDateTime playedAt;

    private int totalMoves;

    public OnlinePartie() {}

    // Getters
    public long getId() { return id; }
    public String getGameId() { return gameId; }
    public Joueur getJoueurBlanc() { return joueurBlanc; }
    public Joueur getJoueurNoir() { return joueurNoir; }
    public short getResultat() { return resultat; }
    public String getResultType() { return resultType; }
    public String getPgn() { return pgn; }
    public String getTimeControl() { return timeControl; }
    public LocalDateTime getPlayedAt() { return playedAt; }
    public int getTotalMoves() { return totalMoves; }

    // Setters
    public void setGameId(String gid) { this.gameId = gid; }
    public void setJoueurBlanc(Joueur j) { this.joueurBlanc = j; }
    public void setJoueurNoir(Joueur j) { this.joueurNoir = j; }
    public void setResultat(short r) { this.resultat = r; }
    public void setResultType(String t) { this.resultType = t; }
    public void setPgn(String p) { this.pgn = p; }
    public void setTimeControl(String tc) { this.timeControl = tc; }
    public void setPlayedAt(LocalDateTime dt) { this.playedAt = dt; }
    public void setTotalMoves(int m) { this.totalMoves = m; }
}
