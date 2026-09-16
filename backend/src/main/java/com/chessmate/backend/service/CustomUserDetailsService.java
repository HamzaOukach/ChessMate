package com.chessmate.backend.service;

import java.util.Collections;
import java.util.Optional;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.chessmate.backend.entiter.Utilisateur;
import com.chessmate.backend.repository.UtilisateurRepository;

@Service // Indique que cette classe est un service Spring et peut être injectée dans d'autres composants
public class CustomUserDetailsService implements UserDetailsService {

    private final UtilisateurRepository utilisateurRepository; // Repository pour accéder aux utilisateurs

    // Constructeur pour l'injection du repository
    public CustomUserDetailsService(UtilisateurRepository rep) {
        this.utilisateurRepository = rep;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Recherche de l'utilisateur dans la base via son email
        Optional<Utilisateur> user = utilisateurRepository.findByEmail(email);

        // Si l'utilisateur n'existe pas, on lève une exception
        if (user.isEmpty()) {
            throw new UsernameNotFoundException("User not found: " + email);
        }

        /* Ancienne version commentée : création d'un UserDetails avec la liste d'autorités
        return new org.springframework.security.core.userdetails.User(
            user.get().getEmail(), 
            user.get().getHash(), 
            Collections.singletonList(new SimpleGrantedAuthority(user.get().getRole()))
        ); 
        */   

        // Version actuelle : utilisation du builder pour créer un UserDetails complet
        return org.springframework.security.core.userdetails.User.builder()
            .username(user.get().getEmail()) // Email utilisé comme nom d'utilisateur
            .password(user.get().getHash()) // Hash du mot de passe
            // Attribution du rôle de l'utilisateur à Spring Security
            .authorities(Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.get().getRole())))
            .accountExpired(false) // Compte non expiré
            .accountLocked(false) // Compte non verrouillé
            .credentialsExpired(false) // Identifiants non expirés
            .disabled(false) // Compte actif
            .build();
    } 
}
