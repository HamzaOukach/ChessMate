package com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.Joueur;

@DataJpaTest
class JoueurRepositoryTest {

    @Autowired
    private JoueurRepository joueurRepository;

    @Test
    void saveAndFindById() {
        // 1. Créer un joueur
        Joueur joueur = new Joueur();
        joueur.setPseudonyme("TestPlayer");
        joueur.setElo(1500);
        joueur.setNbVictoires(0);
        joueur.setNbDefaites(0);
        joueur.setNbNulles(0);

        // 2. Sauvegarder en base H2 de test
        Joueur saved = joueurRepository.save(joueur);
        assertThat(saved.getId()).isNotNull();

        // 3. Relire depuis le repository avec findById (méthode standard de JpaRepository)
        var foundOpt = joueurRepository.findById(saved.getId());

        // 4. Vérifier le résultat
        assertThat(foundOpt).isPresent();
        var found = foundOpt.get();
        assertThat(found.getPseudonyme()).isEqualTo("TestPlayer");
        assertThat(found.getElo()).isEqualTo(1500);
    }
}
