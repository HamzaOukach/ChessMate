package com.chessmate.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.Friendship;
import com.chessmate.backend.entiter.Joueur;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    Optional<Friendship> findByJoueurFromAndJoueurTo(Joueur from, Joueur to);

    List<Friendship> findByJoueurToAndStatus(Joueur to, Friendship.Status status);

    @Query("SELECT f FROM Friendship f WHERE (f.joueurFrom = :joueur OR f.joueurTo = :joueur) AND f.status = 'ACCEPTED'")
    List<Friendship> findFriendsOf(@Param("joueur") Joueur joueur);

    @Query("SELECT f FROM Friendship f WHERE " +
           "((f.joueurFrom = :j1 AND f.joueurTo = :j2) OR (f.joueurFrom = :j2 AND f.joueurTo = :j1))")
    Optional<Friendship> findBetween(@Param("j1") Joueur j1, @Param("j2") Joueur j2);
}
