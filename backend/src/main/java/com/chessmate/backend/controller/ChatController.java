package com.chessmate.backend.controller;

import java.time.LocalDateTime;
import java.util.*;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.chessmate.backend.entiter.ChatMessage;
import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.entiter.Utilisateur;
import com.chessmate.backend.repository.ChatMessageRepository;
import com.chessmate.backend.repository.JoueurRepository;
import com.chessmate.backend.repository.UtilisateurRepository;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatMessageRepository chatRepo;
    private final JoueurRepository joueurRepo;
    private final UtilisateurRepository utilisateurRepo;

    public ChatController(ChatMessageRepository cr, JoueurRepository jr, UtilisateurRepository ur) {
        this.chatRepo = cr;
        this.joueurRepo = jr;
        this.utilisateurRepo = ur;
    }

    private Joueur getCurrentJoueur(Authentication auth) {
        if (auth == null) return null;
        String email = auth.getName();
        Optional<Utilisateur> user = utilisateurRepo.findByEmail(email);
        if (user.isEmpty() || user.get().getJoueur() == null) return null;
        return user.get().getJoueur();
    }

    /** GET /api/chat/history/{pseudo} - Get direct message history with a friend */
    @GetMapping("/history/{pseudo}")
    public ResponseEntity<?> getHistory(@PathVariable String pseudo, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        Optional<Joueur> otherOpt = joueurRepo.findByPseudonyme(pseudo);
        if (otherOpt.isEmpty()) return ResponseEntity.notFound().build();

        List<ChatMessage> messages = chatRepo.findDirectMessages(me, otherOpt.get());
        List<Map<String, Object>> result = messages.stream().map(m -> {
            Map<String, Object> data = new HashMap<>();
            data.put("id", m.getId());
            data.put("sender", m.getSender().getPseudo());
            data.put("content", m.getContent());
            data.put("sentAt", m.getSentAt().toString());
            data.put("isRead", m.isRead());
            return data;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /** POST /api/chat/send - Send a direct message */
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, String> body, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        String toPseudo = body.get("to");
        String content = body.get("content");
        String gameId = body.get("gameId"); // optional

        if (toPseudo == null || content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body("'to' et 'content' requis");
        }

        Optional<Joueur> receiverOpt = joueurRepo.findByPseudonyme(toPseudo);
        if (receiverOpt.isEmpty()) return ResponseEntity.notFound().build();

        ChatMessage msg = new ChatMessage();
        msg.setSender(me);
        msg.setReceiver(receiverOpt.get());
        msg.setContent(content);
        msg.setSentAt(LocalDateTime.now());
        if (gameId != null) msg.setGameId(gameId);

        chatRepo.save(msg);

        Map<String, Object> response = new HashMap<>();
        response.put("id", msg.getId());
        response.put("sender", me.getPseudo());
        response.put("content", content);
        response.put("sentAt", msg.getSentAt().toString());
        return ResponseEntity.ok(response);
    }

    /** GET /api/chat/unread - Count unread messages */
    @GetMapping("/unread")
    public ResponseEntity<?> getUnreadCount(Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        long count = chatRepo.countUnread(me);
        return ResponseEntity.ok(Map.of("unread", count));
    }

    /** POST /api/chat/read/{pseudo} - Mark messages from a friend as read */
    @PostMapping("/read/{pseudo}")
    public ResponseEntity<?> markAsRead(@PathVariable String pseudo, Authentication auth) {
        Joueur me = getCurrentJoueur(auth);
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Joueur non trouvé");

        Optional<Joueur> otherOpt = joueurRepo.findByPseudonyme(pseudo);
        if (otherOpt.isEmpty()) return ResponseEntity.notFound().build();

        List<ChatMessage> messages = chatRepo.findDirectMessages(me, otherOpt.get());
        messages.stream()
            .filter(m -> m.getReceiver().getPseudo().equals(me.getPseudo()) && !m.isRead())
            .forEach(m -> { m.setRead(true); chatRepo.save(m); });

        return ResponseEntity.ok(Map.of("message", "Messages marqués comme lus"));
    }
}
