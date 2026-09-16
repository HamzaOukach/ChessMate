package com.chessmate.backend.configuration;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import com.chessmate.backend.service.AnalysisService;

@Configuration
@Profile("prod") // Exécuté par le backend
public class AnalysisStartupConfig {

    @Bean
    public ApplicationRunner analysisIntializer(AnalysisService analysisService)
    {
        return args -> {
            analysisService.runAnalysisForAllPlayers();
        };
    }
}