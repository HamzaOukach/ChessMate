package test.java.com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.Partie;

import java.time.LocalDateTime;
import java.util.List;

@DataJpaTest
class PartieRepositoryTest {

    @Autowired
    private PartieRepository partieRepository;

    @Test
    void saveAndFindByTitle() {
        // 1. Créer une partie
        Partie partie = new Partie();
        partie.setTitle("Test Partie");
        partie.setDateHeureUTC(LocalDateTime.now());
        partie.setTypeResultat("Victoire");

        // 2. Sauvegarder en base H2 de test
        Partie saved = partieRepository.save(partie);
        assertThat(saved.getId()).isNotNull();

        // 3. Relire depuis le repository avec findByTitle
        var foundOpt = partieRepository.findByTitle("Test Partie");

        // 4. Vérifier le résultat
        assertThat(foundOpt).isPresent();
        var found = foundOpt.get();
        assertThat(found.getTitle()).isEqualTo("Test Partie");
    }

    @Test
    void findAllPartiesByDateHeureUTC() {
        // 1. Créer une partie avec une date précise
        Partie partie = new Partie();
        LocalDateTime dt = LocalDateTime.of(2025, 11, 21, 12, 0, 0, 0);
        partie.setTitle("Partie test UTC");
        partie.setDateHeureUTC(dt);
        partie.setTypeResultat("Nulles");

        // 2. Sauvegarder en base H2 de test
        partieRepository.save(partie);

        // 3. Relire depuis le repository avec findAllPartiesByDateHeureUTC
        List<Partie> found = partieRepository.findAllPartiesByDateHeureUTC(dt);

        // 4. Vérifier le résultat
        assertThat(found).isNotEmpty();
    }
}
