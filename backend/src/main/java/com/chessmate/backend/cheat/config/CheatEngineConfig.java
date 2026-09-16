package com.chessmate.backend.cheat.config;

import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.service.StockfishWrapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CheatEngineConfig {

    @Bean
    public EngineOracle engineOracle(StockfishWrapper stockfish) {
        return new EngineOracle(
                fen -> stockfish.analyzeFen(fen, 12, 3),
                fen -> stockfish.evaluateFen(fen, 12)
        );
    }
}