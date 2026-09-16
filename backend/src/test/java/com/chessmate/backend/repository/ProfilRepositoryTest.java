package com.chessmate.backend.repository;

import com.chessmate.backend.entiter.Profil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ProfilRepositoryTest {

    @Autowired
    private ProfilRepository profilRepository;

    @Test
    void saveAndReadProfil() {
        Profil profil = new Profil();
        profil.setLibelle("ADMIN");

        Profil saved = profilRepository.save(profil);

        var all = profilRepository.findAll();

        assertThat(saved.getId()).isNotNull();
        assertThat(all).isNotEmpty();
    }
}
