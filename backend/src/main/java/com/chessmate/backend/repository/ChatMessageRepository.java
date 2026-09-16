package com.chessmate.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chessmate.backend.entiter.ChatMessage;
import com.chessmate.backend.entiter.Joueur;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** Get chat history between two players (ordered by time) */
    @Query("SELECT m FROM ChatMessage m WHERE " +
           "((m.sender = :j1 AND m.receiver = :j2) OR (m.sender = :j2 AND m.receiver = :j1)) " +
           "AND m.gameId IS NULL " +
           "ORDER BY m.sentAt ASC")
    List<ChatMessage> findDirectMessages(@Param("j1") Joueur j1, @Param("j2") Joueur j2);

    /** Get in-game chat for a specific game */
    @Query("SELECT m FROM ChatMessage m WHERE m.gameId = :gameId ORDER BY m.sentAt ASC")
    List<ChatMessage> findByGameId(@Param("gameId") String gameId);

    /** Count unread messages for a player */
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.receiver = :joueur AND m.isRead = false AND m.gameId IS NULL")
    long countUnread(@Param("joueur") Joueur joueur);
}
