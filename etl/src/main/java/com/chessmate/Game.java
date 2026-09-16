package com.chessmate;

//classe pour garder les infos d'une partie
    public class Game {
        String white, black, result, event, site,
               date, round, variant, eco, opening,
               whiteTitle, blackTitle, whiteTeam, blackTeam, whiteFideId, blackFideId,
               utcDate, utcTime,
               broadcastName, broadcastUrl, gameUrl,
               timeControl, pgnNettoye;

        Integer whiteElo, blackElo;
        StringBuilder moves = new StringBuilder(); //stock les coups
    }
