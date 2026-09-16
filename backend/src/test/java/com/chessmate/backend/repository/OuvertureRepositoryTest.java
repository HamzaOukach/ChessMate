package test.java.com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.Ouverture;

import java.util.List;

@DataJpaTest
class OuvertureRepositoryTest {

    @Autowired
    private OuvertureRepository ouvertureRepository;

    @Test
    void saveAndFindByCode() {
        // 1. Créer une ouverture
        Ouverture ouverture = new Ouverture();
        ouverture.setCode("E4");

        // 2. Sauvegarder en base H2 de test
        Ouverture saved = ouvertureRepository.save(ouverture);
        assertThat(saved.getId()).isNotNull();

        // 3. Relire depuis le repository avec findByCode
        List<Ouverture> found = ouvertureRepository.findByCode("E4");

        // 4. Vérifier le résultat
        assertThat(found).isNotEmpty();
        assertThat(found.get(0).getCode()).isEqualTo("E4");
    }
}
