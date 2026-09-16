package com.chessmate.backend.cheat.config;

import com.chessmate.backend.cheat.detector.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class CheatDetectionConfig {

    @Bean
    public WhiteEngineMatchRateDetector whiteEngineMatchRateDetector() {
        return new WhiteEngineMatchRateDetector(3);
    }

    @Bean
    public BlackEngineMatchRateDetector blackEngineMatchRateDetector() {
        return new BlackEngineMatchRateDetector(3);
    }

    @Bean
    public WhiteAcplDetector whiteAcplDetector() {
        return new WhiteAcplDetector();
    }

    @Bean
    public BlackAcplDetector blackAcplDetector() {
        return new BlackAcplDetector();
    }

    @Bean
    public List<CheatDetector> cheatDetectors(
            WhiteEngineMatchRateDetector d1,
            BlackEngineMatchRateDetector d2,
            WhiteAcplDetector d3,
            BlackAcplDetector d4
    ) {
        return List.of(d1, d2, d3, d4);
    }
}