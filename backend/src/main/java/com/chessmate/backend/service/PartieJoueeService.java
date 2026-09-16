package com.chessmate.backend.service;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.chessmate.backend.dto.CreatePartieJoueeRequest;
import com.chessmate.backend.dto.MLAnalysisResponse;
import com.chessmate.backend.entiter.PartieJouee;
import com.chessmate.backend.repository.PartieJoueeRepository;
import com.chessmate.backend.repository.UtilisateurRepository;

/**
 * Service métier pour les parties jouées localement.
 *
 * <p>Regroupe la logique de création qui était auparavant dans
 * {@code PartieJoueeController}, et y intègre l'analyse ML
 * via {@link MLAnalysisService} <em>avant</em> la persistance.</p>
 */
@Service
public class PartieJoueeService {

    private static final Logger log = LoggerFactory.getLogger(PartieJoueeService.class);

    private final PartieJoueeRepository  partieJoueeRepository;
    private final UtilisateurRepository  utilisateurRepository;
    private final MLAnalysisService      mlAnalysisService;

    public PartieJoueeService(PartieJoueeRepository partieJoueeRepository,
                               UtilisateurRepository utilisateurRepository,
                               MLAnalysisService mlAnalysisService) {
        this.partieJoueeRepository = partieJoueeRepository;
        this.utilisateurRepository  = utilisateurRepository;
        this.mlAnalysisService      = mlAnalysisService;
    }

    /**
     * Crée, enrichit avec l'analyse ML, et persiste une nouvelle partie.
     *
     * @param request  données envoyées par le frontend
     * @param email    email de l'utilisateur connecté (extrait du JWT)
     * @return la partie sauvegardée (avec ou sans insight ML selon disponibilité)
     */
    public PartieJouee createAndSave(CreatePartieJoueeRequest request, String email) {

        // ── 1. Résolution du pseudo connecté ─────────────────────────────────
        String connectedUser = resolveConnectedUser(email);

        // ── 2. Construction de l'entité ───────────────────────────────────────
        PartieJouee partie = new PartieJouee();
        partie.setTitre(request.getTitre());
        partie.setVariant(request.getVariant());
        partie.setResultat(request.getResultat());
        partie.setOuverture(request.getOuverture());
        partie.setSource(request.getSource());
        partie.setNombreCoups(request.getNombreCoups());
        partie.setPgn(request.getPgn());
        partie.setResumeAnalyse(request.getResumeAnalyse());
        partie.setDateHeure(LocalDateTime.now());

        // Attribution des joueurs : le connecté est toujours du bon côté
        if (connectedUser.equalsIgnoreCase(request.getJoueurNoir())) {
            partie.setJoueurBlanc(request.getJoueurBlanc());
            partie.setJoueurNoir(connectedUser);
        } else {
            partie.setJoueurBlanc(connectedUser);
            partie.setJoueurNoir(request.getJoueurNoir());
        }

        // Normalisation du vainqueur
        String vainqueur = request.getVainqueur();
        if (vainqueur != null && (vainqueur.equalsIgnoreCase("Joueur")
                || vainqueur.equalsIgnoreCase(request.getJoueurBlanc()))) {
            vainqueur = connectedUser;
        }
        partie.setVainqueur(vainqueur);

        // ── 3. Analyse ML (non-bloquante) ─────────────────────────────────────
        enrichWithMlInsight(partie);

        // ── 4. Persistance ────────────────────────────────────────────────────
        return partieJoueeRepository.save(partie);
    }

    // ── Méthodes privées ──────────────────────────────────────────────────────

    /**
     * Appelle le moteur ML et injecte dans l'entité :
     * <ul>
     *   <li>{@code mlInsight}  — le message statistique dynamique</li>
     *   <li>{@code mlTag}      — le tag court (Exploit / Logique / Équilibré)</li>
     *   <li>{@code probWhite}  — probabilité victoire blanche [0.0 – 1.0]</li>
     *   <li>{@code probBlack}  — probabilité victoire noire   [0.0 – 1.0]</li>
     *   <li>{@code probDraw}   — probabilité nulle            [0.0 – 1.0]</li>
     * </ul>
     * En cas d'échec, l'entité reste inchangée (champs null) — la sauvegarde continue.
     */
    private void enrichWithMlInsight(PartieJouee partie) {
        try {
            String pgn    = partie.getPgn();
            int    turns  = partie.getNombreCoups() != null ? partie.getNombreCoups() : 0;
            String winner = normalizeWinnerForML(partie);

            MLAnalysisResponse analysis = mlAnalysisService.analyze(pgn, turns, winner);

            if (analysis != null && !analysis.hasError()) {
                // ── Champs texte ──────────────────────────────────────────────
                partie.setMlInsight(analysis.getMessage());
                partie.setMlTag(analysis.getInsightTag());

                // ── Probabilités brutes (Win-Probability Bar côté Frontend) ───
                partie.setProbWhite(analysis.getProbWhite());
                partie.setProbBlack(analysis.getProbBlack());
                partie.setProbDraw(analysis.getProbDraw());

                log.info("[ML] Insight injecté pour '{}' : [{}] W={} B={} D={}",
                        partie.getTitre(), analysis.getInsightTag(),
                        analysis.getProbWhite(), analysis.getProbBlack(), analysis.getProbDraw());
            } else {
                log.warn("[ML] Analyse indisponible pour la partie '{}'. Sauvegarde sans insight.", partie.getTitre());
            }

        } catch (Exception e) {
            // Sécurité ultime : l'analyse ML ne doit jamais empêcher la sauvegarde
            log.error("[ML] Erreur inattendue lors de l'enrichissement ML : {}", e.getMessage(), e);
        }
    }

    /**
     * Traduit le vainqueur stocké en entité vers le format attendu par le script Python
     * ("white", "black" ou "draw").
     */
    private String normalizeWinnerForML(PartieJouee partie) {
        String vainqueur = partie.getVainqueur();
        String resultat  = partie.getResultat();

        // Cas : résultat PGN standard
        if ("1-0".equals(resultat)) return "white";
        if ("0-1".equals(resultat)) return "black";
        if ("1/2-1/2".equals(resultat) || "draw".equalsIgnoreCase(resultat)) return "draw";

        // Cas : vainqueur explicite
        if (vainqueur == null || vainqueur.isBlank()
                || "draw".equalsIgnoreCase(vainqueur)
                || "1/2-1/2".equals(vainqueur)) {
            return "draw";
        }
        if (vainqueur.equalsIgnoreCase(partie.getJoueurBlanc())) return "white";
        if (vainqueur.equalsIgnoreCase(partie.getJoueurNoir()))  return "black";

        return "draw"; // défaut conservateur
    }

    /**
     * Résout le pseudo de l'utilisateur connecté à partir de son email.
     * Retourne "Anonyme" si l'email est null ou introuvable en base.
     */
    private String resolveConnectedUser(String email) {
        if (email == null) return "Anonyme";
        return utilisateurRepository.findByEmail(email)
                .map(u -> {
                    com.chessmate.backend.entiter.Joueur j = u.getJoueur();
                    return (j != null && j.getPseudo() != null) ? j.getPseudo() : u.getEmail();
                })
                .orElse(email);
    }

    /**
     * Enregistre directement une partie jouée déjà construite.
     * Utilisé par le contrôleur legacy qui construit l'entité lui-même.
     */
    public PartieJouee enregistrerPartie(PartieJouee partie) {
        return partieJoueeRepository.save(partie);
    }
}
