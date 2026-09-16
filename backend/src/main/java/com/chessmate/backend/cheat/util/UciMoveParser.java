package com.chessmate.backend.cheat.util;

import com.github.bhlangonijr.chesslib.Piece;
import com.github.bhlangonijr.chesslib.Side;
import com.github.bhlangonijr.chesslib.Square;
import com.github.bhlangonijr.chesslib.move.Move;

public final class UciMoveParser {

    private UciMoveParser() {}

    public static Move toMove(String uci, Side sideToMove) {
        if (uci == null || (uci.length() != 4 && uci.length() != 5)) {
            throw new IllegalArgumentException("UCI invalide: " + uci);
        }

        Square from = Square.valueOf(uci.substring(0, 2).toUpperCase());
        Square to   = Square.valueOf(uci.substring(2, 4).toUpperCase());

        if (uci.length() == 5) { // promotion: e7e8q
            char promo = Character.toLowerCase(uci.charAt(4));
            Piece promotionPiece = promotion(promo, sideToMove);
            return new Move(from, to, promotionPiece);
        }

        return new Move(from, to);
    }

    private static Piece promotion(char c, Side side) {
        boolean white = side == Side.WHITE;
        return switch (c) {
            case 'q' -> white ? Piece.WHITE_QUEEN  : Piece.BLACK_QUEEN;
            case 'r' -> white ? Piece.WHITE_ROOK   : Piece.BLACK_ROOK;
            case 'b' -> white ? Piece.WHITE_BISHOP : Piece.BLACK_BISHOP;
            case 'n' -> white ? Piece.WHITE_KNIGHT : Piece.BLACK_KNIGHT;
            default  -> throw new IllegalArgumentException("Promotion invalide: " + c);
        };
    }
}