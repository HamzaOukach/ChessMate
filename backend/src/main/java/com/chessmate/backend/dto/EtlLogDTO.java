package com.chessmate.backend.dto;

import java.sql.Timestamp;

public class EtlLogDTO {
    Long id;
    Timestamp dateFin;
    Long nbParties;
    
    public EtlLogDTO(Long id, Timestamp endTime, Long nbParties) {
        this.id = id;
        this.dateFin = endTime;
        this.nbParties = nbParties;
    }

    public Long getId() { return id; }
    public Timestamp getDateFin() { return dateFin; }
    public Long getNbParties() { return nbParties; }
}
