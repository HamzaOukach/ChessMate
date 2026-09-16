package com.chessmate.backend.repository;

import com.chessmate.backend.entiter.Ami.FriendshipStatus;
import com.chessmate.backend.entiter.Ami;
import com.chessmate.backend.entiter.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AmiRepository extends JpaRepository<Ami, Long> {

    // Vérifier si une relation existe déjà
    Optional<Ami> findByUserAndFriend(Utilisateur user, Utilisateur friend);

    // Récupérer toutes les relations d’un utilisateur
    @Query("""
        SELECT a FROM Ami a
        WHERE (a.user = :user OR a.friend = :user)
        AND a.status = :status
    """)
    List<Ami> findFriendsByUserAndStatus(Utilisateur user, FriendshipStatus status);

    // Vérifier si deux utilisateurs sont amis
    @Query("""
        SELECT a FROM Ami a
        WHERE ((a.user = :user1 AND a.friend = :user2)
            OR (a.user = :user2 AND a.friend = :user1))
        AND a.status = 'ACCEPTED'
    """)
    Optional<Ami> areFriends(Utilisateur user1, Utilisateur user2);
}