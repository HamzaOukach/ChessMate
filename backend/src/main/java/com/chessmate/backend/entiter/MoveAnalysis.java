package com.chessmate.backend.entiter;

import jakarta.persistence.*;

@Entity
@Table(
    name = "move_analysis",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"partie_id", "joueur_id", "move_index"})
    },
    indexes = {
        @Index(name = "idx_player_move", columnList = "joueur_id, move_uci")
    }
)
public class MoveAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "partie_id", nullable = false)
    private Long partieId;

    @Column(name = "joueur_id", nullable = false)
    private Long joueurId;

    @Column(name = "move_index")
    private Integer moveIndex;

    @Column(name = "move_uci", length = 10)
    private String moveUci;

    @Column(name = "is_white")
    private Boolean isWhite;

    @Column(name = "eval_before")
    private Integer evalBefore;

    @Column(name = "eval_after")
    private Integer evalAfter;

    @Column(name = "best_engine_move", length = 10)
    private String bestEngineMove;

    @Column(name = "is_engine_match")
    private Boolean isEngineMatch;

    @Column(name = "cpl")
    private Integer cpl;

    @Column(name = "accuracy_score")
    private Double accuracyScore;

    @Column(name = "phase", length = 15)
    private String phase;

    public MoveAnalysis() {}

    // Getters / Setters

    public Long getId() { return id; }

    public Long getPartieId() { return partieId; }
    public void setPartieId(Long partieId) { this.partieId = partieId; }

    public Long getJoueurId() { return joueurId; }
    public void setJoueurId(Long joueurId) { this.joueurId = joueurId; }

    public Integer getMoveIndex() { return moveIndex; }
    public void setMoveIndex(Integer moveIndex) { this.moveIndex = moveIndex; }

    public String getMoveUci() { return moveUci; }
    public void setMoveUci(String moveUci) { this.moveUci = moveUci; }

    public Boolean getIsWhite() { return isWhite; }
    public void setIsWhite(Boolean isWhite) { this.isWhite = isWhite; }

    public Integer getEvalBefore() { return evalBefore; }
    public void setEvalBefore(Integer evalBefore) { this.evalBefore = evalBefore; }

    public Integer getEvalAfter() { return evalAfter; }
    public void setEvalAfter(Integer evalAfter) { this.evalAfter = evalAfter; }

    public String getBestEngineMove() { return bestEngineMove; }
    public void setBestEngineMove(String bestEngineMove) { this.bestEngineMove = bestEngineMove; }

    public Boolean getIsEngineMatch() { return isEngineMatch; }
    public void setIsEngineMatch(Boolean isEngineMatch) { this.isEngineMatch = isEngineMatch; }

    public Integer getCpl() { return cpl; }
    public void setCpl(Integer cpl) { this.cpl = cpl; }

    public Double getAccuracyScore() { return accuracyScore; }
    public void setAccuracyScore(Double accuracyScore) { this.accuracyScore = accuracyScore; }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    
}
