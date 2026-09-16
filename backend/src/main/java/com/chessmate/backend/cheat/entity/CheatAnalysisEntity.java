package com.chessmate.backend.cheat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cheat_analysis")
public class CheatAnalysisEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String pgn;

    @Column(name = "global_score", nullable = false)
    private double globalScore;

    @Column(name = "global_verdict", nullable = false)
    private String globalVerdict;

    @Column(name = "white_score", nullable = false)
    private double whiteScore;

    @Column(name = "white_verdict", nullable = false)
    private String whiteVerdict;

    @Column(name = "black_score", nullable = false)
    private double blackScore;

    @Column(name = "black_verdict", nullable = false)
    private String blackVerdict;

    @Column(nullable = false)
    private boolean reliable;

    @Column(name = "reliability_message", nullable = false)
    private String reliabilityMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public CheatAnalysisEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getPgn() {
        return pgn;
    }

    public void setPgn(String pgn) {
        this.pgn = pgn;
    }

    public double getGlobalScore() {
        return globalScore;
    }

    public void setGlobalScore(double globalScore) {
        this.globalScore = globalScore;
    }

    public String getGlobalVerdict() {
        return globalVerdict;
    }

    public void setGlobalVerdict(String globalVerdict) {
        this.globalVerdict = globalVerdict;
    }

    public double getWhiteScore() {
        return whiteScore;
    }

    public void setWhiteScore(double whiteScore) {
        this.whiteScore = whiteScore;
    }

    public String getWhiteVerdict() {
        return whiteVerdict;
    }

    public void setWhiteVerdict(String whiteVerdict) {
        this.whiteVerdict = whiteVerdict;
    }

    public double getBlackScore() {
        return blackScore;
    }

    public void setBlackScore(double blackScore) {
        this.blackScore = blackScore;
    }

    public String getBlackVerdict() {
        return blackVerdict;
    }

    public void setBlackVerdict(String blackVerdict) {
        this.blackVerdict = blackVerdict;
    }

    public boolean isReliable() {
        return reliable;
    }

    public void setReliable(boolean reliable) {
        this.reliable = reliable;
    }

    public String getReliabilityMessage() {
        return reliabilityMessage;
    }

    public void setReliabilityMessage(String reliabilityMessage) {
        this.reliabilityMessage = reliabilityMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}