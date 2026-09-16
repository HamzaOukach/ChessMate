package com.chessmate;

import java.util.*;

public class TournoiDTO {
    String libelle;
    String site;
    String broadcastUrl;
    Date dateDebut;
    
    //Constructeur
    TournoiDTO(String libelle, String site, String broadcastUrl, Date dateDebut) {
        this.libelle = ChessMateETL.truncate(libelle, 255);
        this.site = site;
        this.broadcastUrl = broadcastUrl;
        this.dateDebut = dateDebut;
    }
}