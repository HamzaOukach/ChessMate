package com.chessmate.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chessmate.backend.entiter.Role;

public interface RoleRepository extends JpaRepository<Role, Long>{
    Optional<Role> findByLibelle(String libelle);  // recherche par libelle
}
