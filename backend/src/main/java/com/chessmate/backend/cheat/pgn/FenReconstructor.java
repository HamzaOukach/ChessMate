package com.chessmate.backend.cheat.pgn;

import com.chessmate.backend.cheat.util.UciMoveParser;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.move.Move;

import java.util.ArrayList;
import java.util.List;

public class FenReconstructor {

    /**
     * Retourne les FEN "avant chaque coup".
     * fenList[i] = position avant moves[i]
     */
    public List<String> fenBeforeEachMove(List<String> uciMoves) { 
        Board board = new Board();
        List<String> fens = new ArrayList<>();

        for (String uci : uciMoves) {
            fens.add(board.getFen()); // avant le coup
            Move move = UciMoveParser.toMove(uci, board.getSideToMove());
            board.doMove(move);
        }

        return fens;
    }
}