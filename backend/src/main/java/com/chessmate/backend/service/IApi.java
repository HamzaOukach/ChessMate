package com.chessmate.backend.service;

import java.io.IOException;

public interface IApi {
    /**
     * Récupère une partie de l'API par id
     * @param id Id de la pratie
     * @return La partie trouvée ou chaîne vide sinon
     */
    String findPartieParId(String id) throws IOException, InterruptedException;

    /**
     * Récupère l'ensemble des parties de l'API d'un joueur donné, éventuellement sur une période donnée
     * @param pseudo Pseudo du joueur cible sur l'API
     * @param debut (Facultatif) Timestamp de début de recherche
     * @param fin (Facultatif) Timestamp de fin de recherche
     * @param max (Facultatif) Quantité maximum de parties à récupére (tout si vide)
     * @return La liste des parties correspondant à la recherche
     *
     */
    String findPartiesParPseudo(String pseudo, Integer debut, Integer fin, Integer max) throws IOException, InterruptedException;

    /**
     * Récupère l'ensemble des joueurs FIDE connus sur l'API correspondant à la recherche par nom ou prénom
     * @param rechercheNom Nom ou prénom recherché
     * @return La liste des joueurs FIDE correspondant à la recherche
     */
    String findJoueursFIDE(String rechercheNom) throws IOException, InterruptedException;
}
