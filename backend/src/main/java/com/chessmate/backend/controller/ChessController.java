package com.chessmate.backend.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import com.chessmate.backend.service.StockfishService;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/chess")
public class ChessController {

    private final StockfishService service;

    public ChessController(StockfishService service) {
        this.service = service;
    }

    @GetMapping("/bestmove")
    public ResponseEntity<Map<String, String>> bestMove(
        @RequestParam(required = false, defaultValue = "") String moves, 
        @RequestParam(required = false, defaultValue = "depth") String mode, 
        @RequestParam(required = false, defaultValue = "black") String color, 
        @RequestParam(required = false, defaultValue = "15") int depth,
        @RequestParam(required = false, defaultValue = "1000") int movetime
    ) {
        try {
            if ("depth".equalsIgnoreCase(mode)) {
                service.setDepth(depth);
            } else if ("movetime".equalsIgnoreCase(mode)) {
                service.setMovetime(movetime);
            }
            
            String bestMove = service.getBestMove(moves, mode);
            
            Map<String, String> response = new HashMap<>();
            response.put("bestmove", bestMove);
            response.put("status", "success");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("bestmove", "e2e4");
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            
            return ResponseEntity.ok(errorResponse);
        }
    }

    @GetMapping("/evaluate")
    public ResponseEntity<Map<String, Object>> evaluate(
        @RequestParam(required = false, defaultValue = "") String moves, 
        @RequestParam(required = false, defaultValue = "15") int depth
    ) {
        try {
            Map<String, Object> evaluation = service.evaluatePosition(moves, depth);
            return ResponseEntity.ok(evaluation);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("score", 0);
            errorResponse.put("isMate", false);
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.ok(errorResponse);
        }
    }
}
