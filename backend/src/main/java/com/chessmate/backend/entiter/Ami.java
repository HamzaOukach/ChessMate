package com.chessmate.backend.entiter;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "amis",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "friend_id"})
    }
)
public class Ami {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Utilisateur qui envoie la demande
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Utilisateur user;

    // Utilisateur qui reçoit la demande
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "friend_id", nullable = false)
    private Utilisateur friend;

    // Statut de la relation
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendshipStatus status;

    // Date de création
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Initialisation automatique de la date
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Constructeurs
    public Ami() {}

    public Ami(Utilisateur user, Utilisateur friend, FriendshipStatus status) {
        this.user = user;
        this.friend = friend;
        this.status = status;
    }

    // Getters & Setters
    public Long getId() { return id; }

    public Utilisateur getUser() { return user; }
    public void setUser(Utilisateur user) { this.user = user; }

    public Utilisateur getFriend() { return friend; }
    public void setFriend(Utilisateur friend) { this.friend = friend; }

    public FriendshipStatus getStatus() { return status; }
    public void setStatus(FriendshipStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }


    public enum FriendshipStatus {
        PENDING,
        ACCEPTED,
        BLOCKED,
        REFUSED
    }
}