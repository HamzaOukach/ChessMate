package com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.Utilisateur;

@DataJpaTest
class UtilisateurRepositoryTest {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Test
    void saveAndFindByEmail() {

        // 1. Créer un utilisateur
        Utilisateur user = new Utilisateur();
        user.setEmail("test@example.com");
        user.setHash("motdepasse");
        user.setInscriptionA(LocalDateTime.now());

        // 2. Sauvegarder en base H2 de test
        utilisateurRepository.save(user);

        // 3. Lire depuis la BDD
        var foundOpt = utilisateurRepository.findByEmail("test@example.com");

        // 4. Vérifier
        assertThat(foundOpt).isPresent();

        var found = foundOpt.get();
        assertThat(found.getEmail()).isEqualTo("test@example.com");
        assertThat(found.getHash()).isEqualTo("motdepasse");
    }
}
