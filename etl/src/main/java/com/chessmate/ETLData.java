package com.chessmate;

import java.util.*;

public class ETLData {
    //map<pseudonyme, Joueur>
    Map<String, JoueurDTO> joueurs = new LinkedHashMap<>();
    
    //map<libelle, Tournoi>
    Map<String, TournoiDTO> tournois = new LinkedHashMap<>();
    
    //liste <Partie>
    List<Game> games = new ArrayList<>();
}