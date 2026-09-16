package com.chessmate.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.chessmate.backend.entiter.Role;

@DataJpaTest
class RoleRepositoryTest {

    @Autowired
    private RoleRepository roleRepository;

    @Test
    void saveAndFindRole() {
        // 1. Créer un rôle
        Role role = new Role();
        role.setLibelle("ADMIN");

        // 2. Sauvegarder en base H2 de test
        Role saved = roleRepository.save(role);

        // 3. Vérifier que l'id est généré
        assertThat(saved.getId()).isNotNull();

        // 4. Relire tous les rôles et vérifier que "ADMIN" est présent
        var roles = roleRepository.findAll();
        assertThat(roles)
                .extracting(Role::getLibelle)
                .contains("ADMIN");
    }
}
