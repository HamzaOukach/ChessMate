package com.chessmate.backend.service;

import com.chessmate.backend.cheat.engine.EngineEvaluation;
import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.HashMap;

@Service
public class StockfishService {

    private final StockfishWrapper stockfish;

    public StockfishService(StockfishWrapper stockfish) {
        this.stockfish = stockfish;
    }

    public String getBestMove(String moves, String mode) {
        return stockfish.getBestMove(moves, mode);
    }

    public Map<String, Object> evaluatePosition(String moves, int depth) {
        String positionCmd = (moves != null && !moves.trim().isEmpty()) ? "startpos moves " + moves : "startpos";
        EngineEvaluation eval = stockfish.evaluateFen(positionCmd, depth);
        Map<String, Object> result = new HashMap<>();
        result.put("score", eval.getEvaluationCp());
        result.put("isMate", eval.isMateScore());
        result.put("bestMove", eval.getBestMove());
        return result;
    }

    public void setDepth(int depth) {
        stockfish.setDepth(depth);
    }

    public void setMovetime(int movetime) {
        stockfish.setMovetime(movetime);
    }
}
