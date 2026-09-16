package com.chessmate.backend.entiter;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @ManyToOne
    @JoinColumn(name = "id_sender", nullable = false)
    private Joueur sender;

    @ManyToOne
    @JoinColumn(name = "id_receiver", nullable = false)
    private Joueur receiver;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    /** Optional: link to a game room if this is an in-game message */
    private String gameId;

    private boolean isRead = false;

    public ChatMessage() {}

    // Getters
    public long getId() { return id; }
    public Joueur getSender() { return sender; }
    public Joueur getReceiver() { return receiver; }
    public String getContent() { return content; }
    public LocalDateTime getSentAt() { return sentAt; }
    public String getGameId() { return gameId; }
    public boolean isRead() { return isRead; }

    // Setters
    public void setSender(Joueur s) { this.sender = s; }
    public void setReceiver(Joueur r) { this.receiver = r; }
    public void setContent(String c) { this.content = c; }
    public void setSentAt(LocalDateTime dt) { this.sentAt = dt; }
    public void setGameId(String gid) { this.gameId = gid; }
    public void setRead(boolean read) { this.isRead = read; }
}
