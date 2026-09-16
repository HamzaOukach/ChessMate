package com.chessmate.backend.job;

import java.io.Serializable;

public class AnalysisJob implements Serializable {

    private Long partieId;
    private Long joueurId;

    public AnalysisJob() {}

    public AnalysisJob(Long partieId, Long joueurId) {
        this.partieId = partieId;
        this.joueurId = joueurId;
    }

    public Long getPartieId() {
        return partieId;
    }

    public void setPartieId(Long partieId) {
        this.partieId = partieId;
    }

    public Long getJoueurId() {
        return joueurId;
    }

    public void setJoueurId(Long joueurId) {
        this.joueurId = joueurId;
    }
}