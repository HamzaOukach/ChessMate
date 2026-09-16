package com.chessmate.backend.configuration;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

import javax.crypto.spec.SecretKeySpec;

@Component // Déclare cette classe comme un bean Spring, injectable dans d'autres composants
public class JwtUtils {

    @Value("${app.secret-key}") // Injection de la clé secrète depuis application.properties
    private String secretKey;

    @Value("${app.expiration-time}") // Injection du temps d'expiration du token (en ms)
    private long expirationTime;

    // Génère un token JWT pour un utilisateur donné (username)
    public String generateToken(String username) {
        Map<String, Object> claims = new HashMap<>(); // Payload personnalisé (vide ici)
        return createToken(claims, username);
    }

    // Crée le token JWT avec les informations fournies
    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .setClaims(claims) // Ajoute les claims (payload)
                .setSubject(subject) // Sujet du token (ici, le username)
                .setIssuedAt(new Date(System.currentTimeMillis())) // Date d'émission
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime)) // Date d'expiration
                .signWith(getSignKey(), SignatureAlgorithm.HS256) // Signature du token avec la clé et algorithme
                .compact(); // Génère le token sous forme de String
    }

    // Récupère la clé de signature à partir de la clé secrète
    private Key getSignKey() {
        byte[] keyBytes = secretKey.getBytes(); // Convertit la chaîne en tableau d'octets
        return new SecretKeySpec(keyBytes, SignatureAlgorithm.HS256.getJcaName()); // Crée la clé pour HS256
    }

    // Vérifie si le token est valide pour l'utilisateur fourni
    public Boolean validateToken(String token, UserDetails userDetails) {
        String username = extractUsername(token); // Récupère le username depuis le token
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
        // Vérifie que le username correspond et que le token n'est pas expiré
    }

    // Vérifie si le token est expiré
    private boolean isTokenExpired(String token) {
        return extractExpirationDate(token).before(new Date()); // Expiré si date < maintenant
    }

    // Récupère le username (subject) depuis le token
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    // Récupère la date d'expiration du token
    private Date extractExpirationDate(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    // Méthode générique pour extraire une claim depuis le token
    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token); // Récupère toutes les claims
        return claimsResolver.apply(claims); // Applique la fonction pour extraire la claim spécifique
    }

    // Parse le token JWT et retourne toutes les claims
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .setSigningKey(getSignKey()) // Utilise la clé pour valider la signature
                .parseClaimsJws(token) // Parse le token
                .getBody(); // Retourne le payload
    }

}
