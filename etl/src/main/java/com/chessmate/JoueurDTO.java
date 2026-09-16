package com.chessmate;

public class JoueurDTO {
    String pseudonyme;
    Integer elo;
    String equipe;
    String fideId;
    
    //constructeur
    JoueurDTO(String pseudonyme, Integer elo, String equipe, String fideId) {
        this.pseudonyme = pseudonyme;
        this.elo = elo;
        this.equipe = equipe;
        this.fideId = fideId;
    }
}