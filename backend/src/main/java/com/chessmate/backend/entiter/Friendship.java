package com.chessmate.backend.entiter;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Friendship {

    public enum Status {
        PENDING, ACCEPTED, DECLINED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @ManyToOne
    @JoinColumn(name = "id_joueur_from", nullable = false)
    private Joueur joueurFrom;

    @ManyToOne
    @JoinColumn(name = "id_joueur_to", nullable = false)
    private Joueur joueurTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Friendship() {}

    // Getters
    public long getId() { return id; }
    public Joueur getJoueurFrom() { return joueurFrom; }
    public Joueur getJoueurTo() { return joueurTo; }
    public Status getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // Setters
    public void setJoueurFrom(Joueur j) { this.joueurFrom = j; }
    public void setJoueurTo(Joueur j) { this.joueurTo = j; }
    public void setStatus(Status s) { this.status = s; }
    public void setCreatedAt(LocalDateTime dt) { this.createdAt = dt; }
}
