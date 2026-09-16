package test.java.com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.SuiteCoupsStats;

@DataJpaTest
class SuiteCoupsStatsRepositoryTest {

    @Autowired
    private SuiteCoupsStatsRepository suiteCoupsStatsRepository;

    @Test
    void saveAndFindById() {
        // 1. Créer une suite de coups stats
        SuiteCoupsStats suiteCoupsStats = new SuiteCoupsStats();
        suiteCoupsStats.setStat("Test Stat");

        // 2. Sauvegarder en base H2 de test
        SuiteCoupsStats saved = suiteCoupsStatsRepository.save(suiteCoupsStats);
        assertThat(saved.getId()).isNotNull();

        // 3. Relire depuis le repository avec findById
        var foundOpt = suiteCoupsStatsRepository.findById(saved.getId());

        // 4. Vérifier le résultat
        assertThat(foundOpt).isPresent();
        var found = foundOpt.get();
        assertThat(found.getStat()).isEqualTo("Test Stat");
    }
}
