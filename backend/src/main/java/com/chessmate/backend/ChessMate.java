package com.chessmate.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication // Indique que c'est l'application principale Spring Boot
// Cette annotation active la configuration automatique, le scan des composants et d'autres fonctionnalités Spring Boot
public class ChessMate {

    public static void main(String[] args) {
        // Point d'entrée de l'application
        // Démarre le contexte Spring Boot et initialise toutes les configurations
        SpringApplication.run(ChessMate.class, args);
    }
    
}
