package com.example.demo.stockfish;

import org.springframework.stereotype.Service;

@Service
public class StockfishService {

    private final StockfishWrapper stockfish;

    public StockfishService(StockfishWrapper stockfish) {
        this.stockfish = stockfish;
    }

    public String getBestMove(String moves, String mode) {
        return stockfish.getBestMove(moves, mode);
    }

    public void setDepth(int depth) {
        stockfish.setDepth(depth);
    }

    public void setMovetime(int movetime) {
        stockfish.setMovetime(movetime);
    }
}