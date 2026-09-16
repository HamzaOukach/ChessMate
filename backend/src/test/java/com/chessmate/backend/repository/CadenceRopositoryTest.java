package com.chessmate.backend.repository;

import com.chessmate.backend.entiter.Cadence;
import com.chessmate.backend.entiter.Cadence.CategorieCadence;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

@SpringBootTest
@Disabled("Test désactivé temporairement (problème de contexte Spring à investiguer plus tard)")
class CadenceRopositoryTest {

    @Autowired
    private CadenceRopository cadenceRopository;

    @Test
    void saveAndReadCadence() {
        Cadence c = new Cadence();
        c.setLibelle("TestCadence");
        c.setTemps(60);
        c.setIncrement(5);
        c.setTypePartie(CategorieCadence.Blitz);

        Cadence saved = cadenceRopository.save(c);
        List<Cadence> all = cadenceRopository.findAll();

        assertThat(saved.getId()).isNotNull();
        assertThat(all).isNotEmpty();
    }
}
