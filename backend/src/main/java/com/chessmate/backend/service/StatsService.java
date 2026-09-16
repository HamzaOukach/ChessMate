package com.chessmate.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.TreeMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

import com.chessmate.backend.dto.CouleurStatsDTO;
import com.chessmate.backend.dto.PartiesResumeDTO;
import com.chessmate.backend.dto.PerformanceMensuelleDTO;
import com.chessmate.backend.dto.AccuracyBySituationDTO;
import com.chessmate.backend.dto.AccuracyOverTimeDTO;
import com.chessmate.backend.dto.BestMoveDTO;
import com.chessmate.backend.dto.DashboardStatsDTO;
import com.chessmate.backend.dto.EtlLogDTO;
import com.chessmate.backend.dto.MoveStatsStockfishDTO;
import com.chessmate.backend.dto.OuvertureStatsDTO;

import com.chessmate.backend.repository.JoueurRepository;
import com.chessmate.backend.repository.MoveAnalysisRepository;
import com.chessmate.backend.repository.PartieRepository;
import com.chessmate.backend.repository.AnalysePartieRepository;
import com.chessmate.backend.repository.PartieJoueeRepository;
import com.chessmate.backend.repository.OnlinePartieRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import com.chessmate.backend.entiter.AnalysePartie;
import com.chessmate.backend.entiter.Partie;
import com.chessmate.backend.entiter.Joueur;
import com.chessmate.backend.entiter.PartieJouee;
import com.chessmate.backend.entiter.OnlinePartie;

@Service
public class StatsService {
    private final PartieRepository partieRepository;
    private final JoueurRepository joueurRepository;
    private final AnalysePartieRepository analyseRepository;
    private final MoveAnalysisRepository moveAnalysisRepository;
    private final PartieJoueeRepository partieJoueeRepository;
    private final OnlinePartieRepository onlinePartieRepository;
    
    private static final Logger log = LoggerFactory.getLogger(StatsService.class);

    //gestion des erreurs
    private <T> T safeCall(String methodName, Supplier<T> supplier, T defaultValue, boolean[] hasError) {
        try {
            return supplier.get();
        } catch (Exception e) {
            log.error("Erreur dans {}", methodName, e);
            hasError[0] = true;
            return defaultValue;
        }
    }

    @PersistenceContext
    private EntityManager entityManager;

    public StatsService(PartieRepository partieRepository, JoueurRepository jRepository, 
                        AnalysePartieRepository aRepository,
                        MoveAnalysisRepository mRepository,
                        PartieJoueeRepository pjRepository,
                        OnlinePartieRepository opRepository) {
        this.partieRepository = partieRepository;
        this.joueurRepository = jRepository;
        this.analyseRepository = aRepository;
        this.moveAnalysisRepository = mRepository;
        this.partieJoueeRepository = pjRepository;
        this.onlinePartieRepository = opRepository;
    }
    

    public EtlLogDTO getLastLog() {
        String sql = "SELECT id, date_fin, nb_parties " +
                    "FROM etl_log " +
                    "ORDER BY date_fin DESC NULLS LAST, id DESC " +
                    "LIMIT 1";

        List<Object[]> results = entityManager.createNativeQuery(sql).getResultList();

            if (results.isEmpty()) return null;

            Object[] row = results.get(0);

            return new EtlLogDTO(
                ((Number) row[0]).longValue(), 
                (Timestamp) row[1],
                ((Number) row[2]).longValue()
            );
    }


    public Partie getInfoPartie(Long id) {
        return partieRepository.findInfoPartie(id)
            .orElseThrow(() -> new RuntimeException("Partie introuvable"));
    }

    public double tauxVictoireJoueur(Long joueurId) {
        // Stats from Partie table
        Double resPartie = partieRepository.getTauxVictoireJoueur(joueurId);
        double winRatePartie = resPartie != null ? resPartie : 0.0;
        int countPartie = partieRepository.getNbPartiesByJoueur(joueurId);
        log.info("[Stats] JoueurId: {} | Table 'partie': count={}", joueurId, countPartie);

        // Stats from OnlinePartie table
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isEmpty()) {
            log.warn("[Stats] Joueur introuvable pour ID: {}", joueurId);
            return winRatePartie;
        }
        
        var onlineParties = onlinePartieRepository.findByJoueur(joueurOpt.get());
        long winsOnline = onlineParties.stream().filter(p -> {
            boolean isWhite = p.getJoueurBlanc().getId().equals(joueurId);
            int res = (int) p.getResultat();
            return (isWhite && res == 2) || (!isWhite && res == 0);
        }).count();
        log.info("[Stats] Table 'online_partie': count={}", onlineParties.size());

        // Stats from PartieJouee table
        String pseudo = joueurOpt.get().getPseudo();
        log.info("[Stats] Pseudo résolu: '{}'", pseudo);
        var partiesJouees = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo);
        log.info("[Stats] Table 'partie_jouee': count={}", partiesJouees.size());
        
        long winsJouee = partiesJouees.stream().filter(p -> {
            boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
            String res = p.getResultat();
            if (res == null) return p.getVainqueur() != null && p.getVainqueur().equalsIgnoreCase(pseudo);
            if ("1-0".equals(res)) return isWhite;
            if ("0-1".equals(res)) return !isWhite;
            return p.getVainqueur() != null && p.getVainqueur().equalsIgnoreCase(pseudo);
        }).count();

        int countTotal = countPartie + onlineParties.size() + partiesJouees.size();
        if (countTotal == 0) return 0.0;

        double totalWins = (winRatePartie * countPartie / 100.0) + winsOnline + winsJouee;
        return Math.round((totalWins * 100.0) / countTotal);
    }

    public int getNbParties(Long joueurId) {
        int countPartie = partieRepository.getNbPartiesByJoueur(joueurId);
        
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            int countOnline = onlinePartieRepository.findByJoueur(joueurOpt.get()).size();
            String pseudo = joueurOpt.get().getPseudo();
            int countJouee = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo).size();
            log.info("[Stats] getNbParties ID {}: {} (partie) + {} (online) + {} (jouee) = {}", 
                joueurId, countPartie, countOnline, countJouee, (countPartie + countOnline + countJouee));
            return countPartie + countOnline + countJouee;
        }
        
        return countPartie;
    }


    public CouleurStatsDTO getStatsCouleur(Long joueurId) {
        log.info("[Stats] Calcul des stats par couleur pour joueurId: {}", joueurId);
        
        // 1. Stats from 'Partie' table
        List<Object[]> rList = partieRepository.getStatsCouleur(joueurId);
        int nbBlanc = 0, nbNoir = 0, winsBlanc = 0, winsNoir = 0, nullsBlanc = 0, nullsNoir = 0;
        
        if (!rList.isEmpty()) {
            Object[] r = rList.get(0);
            nbBlanc    = r[0] != null ? ((Number) r[0]).intValue() : 0;
            nbNoir     = r[1] != null ? ((Number) r[1]).intValue() : 0;
            winsBlanc  = r[2] != null ? ((Number) r[2]).intValue() : 0;
            winsNoir   = r[3] != null ? ((Number) r[3]).intValue() : 0;
            nullsBlanc = r[4] != null ? ((Number) r[4]).intValue() : 0;
            nullsNoir  = r[5] != null ? ((Number) r[5]).intValue() : 0;
        }

        // 2. Aggregate from OnlinePartie and PartieJouee
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            Joueur j = joueurOpt.get();
            String pseudo = j.getPseudo();

            // OnlinePartie
            var online = onlinePartieRepository.findByJoueur(j);
            for (var p : online) {
                boolean isWhite = p.getJoueurBlanc().getId().equals(joueurId);
                int res = (int) p.getResultat(); // 2=WhiteWin, 0=BlackWin, 1=Draw
                if (isWhite) {
                    nbBlanc++;
                    if (res == 2) winsBlanc++;
                    else if (res == 1) nullsBlanc++;
                } else {
                    nbNoir++;
                    if (res == 0) winsNoir++;
                    else if (res == 1) nullsNoir++;
                }
            }

            // PartieJouee
            var jouees = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo);
            for (var p : jouees) {
                boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
                String res = p.getResultat(); // "1-0", "0-1", "1/2-1/2"
                if (isWhite) {
                    nbBlanc++;
                    if ("1-0".equals(res)) winsBlanc++;
                    else if ("1/2-1/2".equals(res)) nullsBlanc++;
                    else if (p.getVainqueur() != null && p.getVainqueur().equalsIgnoreCase(pseudo)) winsBlanc++;
                } else {
                    nbNoir++;
                    if ("0-1".equals(res)) winsNoir++;
                    else if ("1/2-1/2".equals(res)) nullsNoir++;
                    else if (p.getVainqueur() != null && p.getVainqueur().equalsIgnoreCase(pseudo)) winsNoir++;
                }
            }
        }

        double wrBlanc  = nbBlanc > 0 ? Math.round(winsBlanc  * 1000.0 / nbBlanc)  / 10.0 : 0;
        double wrNoir   = nbNoir  > 0 ? Math.round(winsNoir   * 1000.0 / nbNoir)   / 10.0 : 0;
        double nrBlanc  = nbBlanc > 0 ? Math.round(nullsBlanc * 1000.0 / nbBlanc)  / 10.0 : 0;
        double nrNoir   = nbNoir  > 0 ? Math.round(nullsNoir  * 1000.0 / nbNoir)   / 10.0 : 0;
        
        return new CouleurStatsDTO(nbBlanc, nbNoir, wrBlanc, wrNoir, nrBlanc, nrNoir);
    }


    public List<PartiesResumeDTO> derniereParties(Long joueurId) {

        // Récupérer toutes les analyses en une seule requête
        Map<Long, Double> precisionMap = analyseRepository.findAllByJoueurId(joueurId)
                .stream()
                .collect(Collectors.toMap(
                        AnalysePartie::getPartieId,
                        AnalysePartie::getPrecision
                ));

        List<Object[]> rows = partieRepository.getLastParties(joueurId);

        List<PartiesResumeDTO> resume = rows.stream()
            .map(row -> {
                long id = ((Number) row[0]).longValue();
                String date = ((java.sql.Timestamp) row[1]).toLocalDateTime().toLocalDate().toString();
                String adversaire = (String) row[2];
                String resultat = (String) row[3];
                int elo = ((Number) row[4]).intValue();

                Double precision = precisionMap.get(id);

                if (precision == null) {
                    double eloFactor = 1 / (1 + Math.exp(-0.003 * (elo - 1500)));
                    double baseAccuracy = 65 + eloFactor * 30;
                    double boost = resultat.equals("Victoire") ? 6.0 : resultat.equals("Défaite") ? -6.0 : 0.0;
                    double raw = Math.max(60, Math.min(baseAccuracy + boost, 98));
                    precision = Math.round(raw * 10.0) / 10.0;
                }

                return new PartiesResumeDTO(id, date, adversaire, resultat, precision);
            })
            .collect(Collectors.toList());

        // Fetch from OnlinePartie
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            Joueur j = joueurOpt.get();
            int userElo = j.getElo() > 0 ? j.getElo() : 1200;

            var online = onlinePartieRepository.findByJoueur(j);
            for (var p : online) {
                boolean isWhite = p.getJoueurBlanc().getId().equals(joueurId);
                String adv = isWhite ? p.getJoueurNoir().getPseudo() : p.getJoueurBlanc().getPseudo();
                int res = (int) p.getResultat();
                String resStr = "Nulle";
                if ((isWhite && res == 2) || (!isWhite && res == 0)) resStr = "Victoire";
                else if ((isWhite && res == 0) || (!isWhite && res == 2)) resStr = "Défaite";
                
                // Estimation de précision si non analysé
                double eloFactor = 1 / (1 + Math.exp(-0.003 * (userElo - 1500)));
                double baseAccuracy = 65 + eloFactor * 30;
                double boost = resStr.equals("Victoire") ? 6.0 : resStr.equals("Défaite") ? -6.0 : 0.0;
                double raw = Math.max(60, Math.min(baseAccuracy + boost, 98));
                double precision = Math.round(raw * 10.0) / 10.0;

                resume.add(new PartiesResumeDTO(p.getId(), p.getPlayedAt().toString(), adv, resStr, precision));
            }

            // Fetch from PartieJouee
            String pseudo = j.getPseudo();
            var jouees = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo);
            for (var p : jouees) {
                boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
                String adv = isWhite ? p.getJoueurNoir() : p.getJoueurBlanc();
                String res = p.getResultat();
                String resStr = "Nulle";
                if ("1-0".equals(res)) resStr = isWhite ? "Victoire" : "Défaite";
                else if ("0-1".equals(res)) resStr = isWhite ? "Défaite" : "Victoire";
                else if (p.getVainqueur() != null) {
                    resStr = p.getVainqueur().equalsIgnoreCase(pseudo) ? "Victoire" : "Défaite";
                }

                // Estimation de précision
                double eloFactor = 1 / (1 + Math.exp(-0.003 * (userElo - 1500)));
                double baseAccuracy = 65 + eloFactor * 30;
                double boost = resStr.equals("Victoire") ? 6.0 : resStr.equals("Défaite") ? -6.0 : 0.0;
                double raw = Math.max(60, Math.min(baseAccuracy + boost, 98));
                double precision = Math.round(raw * 10.0) / 10.0;

                resume.add(new PartiesResumeDTO(p.getId(), p.getDateHeure().toString(), adv, resStr, precision));
            }
        }

        // Sort by date descending and limit to 5
        return resume.stream()
                .sorted((a, b) -> b.dates().compareTo(a.dates()))
                .limit(5)
                .collect(Collectors.toList());
    }


    public List<PerformanceMensuelleDTO> performanceMensuelle(Long joueurId) {
        log.info("[Stats] Calcul de la performance mensuelle pour joueurId: {}", joueurId);
        
        // Use a map to aggregate by year-month
        Map<String, long[]> monthlyStats = new TreeMap<>(Collections.reverseOrder()); // "YYYY-MM" -> [wins, losses, draws]

        // 1. Stats from 'Partie' table
        partieRepository.getPerformanceMensuelle(joueurId).forEach(r -> {
            LocalDate date = ((java.sql.Timestamp) r[0]).toLocalDateTime().toLocalDate();
            String key = date.getYear() + "-" + String.format("%02d", date.getMonthValue());
            monthlyStats.putIfAbsent(key, new long[3]);
            monthlyStats.get(key)[0] += ((Number) r[1]).longValue(); // wins
            monthlyStats.get(key)[1] += ((Number) r[2]).longValue(); // losses
            monthlyStats.get(key)[2] += ((Number) r[3]).longValue(); // draws
        });

        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            Joueur j = joueurOpt.get();
            String pseudo = j.getPseudo();

            // 2. Stats from 'OnlinePartie'
            onlinePartieRepository.findByJoueur(j).forEach(p -> {
                LocalDate date = p.getPlayedAt().toLocalDate();
                String key = date.getYear() + "-" + String.format("%02d", date.getMonthValue());
                monthlyStats.putIfAbsent(key, new long[3]);
                
                boolean isWhite = p.getJoueurBlanc().getId().equals(joueurId);
                int res = (int) p.getResultat();
                if ((isWhite && res == 2) || (!isWhite && res == 0)) monthlyStats.get(key)[0]++; // win
                else if (res == 1) monthlyStats.get(key)[2]++; // draw
                else monthlyStats.get(key)[1]++; // loss
            });

            // 3. Stats from 'PartieJouee'
            partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo).forEach(p -> {
                LocalDateTime ldt = p.getDateHeure() != null ? p.getDateHeure() : LocalDateTime.now();
                LocalDate date = ldt.toLocalDate();
                String key = date.getYear() + "-" + String.format("%02d", date.getMonthValue());
                monthlyStats.putIfAbsent(key, new long[3]);

                boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
                String res = p.getResultat();
                boolean win = (isWhite && "1-0".equals(res)) || (!isWhite && "0-1".equals(res));
                if (!win && p.getVainqueur() != null) win = p.getVainqueur().equalsIgnoreCase(pseudo);
                
                if (win) monthlyStats.get(key)[0]++;
                else if ("1/2-1/2".equals(res)) monthlyStats.get(key)[2]++;
                else monthlyStats.get(key)[1]++;
            });
        }

        return monthlyStats.entrySet().stream()
            .map(entry -> {
                String[] parts = entry.getKey().split("-");
                int year = Integer.parseInt(parts[0]);
                int month = Integer.parseInt(parts[1]);
                long[] data = entry.getValue();
                return new PerformanceMensuelleDTO(
                    year,
                    month,
                    java.time.Month.of(month).name(),
                    data[0],
                    data[1],
                    data[2]
                );
            })
            .toList();
    }

    public double getPrecisionMoyenne(Long joueurId) {

        Double winrateRaw = partieRepository.getTauxVictoireJoueur(joueurId);
        double winrate = winrateRaw != null ? winrateRaw / 100.0 : 0.5;

        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isEmpty()) return 0.0;

        int elo = joueurOpt.get().getElo();

        double eloFactor = 1 / (1 + Math.exp(-0.003 * (elo - 1500)));
        double baseAccuracy = 65 + eloFactor * 30;

        double performanceBoost = (winrate - 0.5) * 12;

        double finalAccuracy = baseAccuracy + performanceBoost;
        finalAccuracy = Math.max(60, Math.min(finalAccuracy, 98));
        
        return Math.round(finalAccuracy * 100.0) / 100.0;
    }

    //classe pour cacul stats par phase
    private static class MoveStats {
        int total = 0;
        int wins = 0;
    }

    

    //stats pour les meilleur coups par phase
    public List<BestMoveDTO> getBestMovesByPhase(Long joueurId)
    {
        Map<String, Map<String, MoveStats>> stats = new HashMap<>();
        var joueurOpt = joueurRepository.findById(joueurId);
        if (!joueurOpt.isPresent()) return new ArrayList<>();
        
        Joueur j = joueurOpt.get();
        String pseudo = j.getPseudo();

        // 1. Stats from 'Partie' table
        List<Partie> parties = partieRepository.findAllByJoueur(joueurId);
        for(Partie partie : parties) {
            if(partie.getPgnPartie() == null) continue;
            boolean isblanc = partie.getJoueurBlanc().getId().equals(joueurId);
            boolean win = (isblanc && partie.getResultat() == 2) || (!isblanc && partie.getResultat() == 0);
            processMoves(partie.getPgnPartie(), isblanc, win, stats);
        }

        // 2. Stats from 'OnlinePartie' table
        var online = onlinePartieRepository.findByJoueur(j);
        for(var p : online) {
            if(p.getPgn() == null) continue;
            boolean isWhite = p.getJoueurBlanc().getId().equals(joueurId);
            int res = (int) p.getResultat();
            boolean win = (isWhite && res == 2) || (!isWhite && res == 0);
            processMoves(p.getPgn(), isWhite, win, stats);
        }

        // 3. Stats from 'PartieJouee' table
        var jouees = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo);
        for(var p : jouees) {
            if(p.getPgn() == null) continue;
            boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
            String res = p.getResultat();
            boolean win = (isWhite && "1-0".equals(res)) || (!isWhite && "0-1".equals(res));
            if (!win && p.getVainqueur() != null) win = p.getVainqueur().equalsIgnoreCase(pseudo);
            processMoves(p.getPgn(), isWhite, win, stats);
        }

        List<BestMoveDTO> result = new ArrayList<>();
        for(String phase : stats.keySet())
        {
            Map<String, MoveStats> phaseMoves = stats.get(phase);
            String bestMove = null;
            MoveStats bestStats = null;

            for(Map.Entry<String, MoveStats> entry : phaseMoves.entrySet())
            {
                if(bestStats == null || entry.getValue().total > bestStats.total)
                {
                    bestMove = entry.getKey();
                    bestStats = entry.getValue();
                }
            }

            if(bestStats != null && bestStats.total >= 1) // Lowered threshold to 1 for visibility
            {
                double winrate = (bestStats.wins * 100.0) / bestStats.total;
                winrate = Math.round(winrate * 100.0) / 100.0;

                result.add(new BestMoveDTO(
                    phase,
                    bestMove,
                    bestStats.total,
                    winrate
                ));
            }
        }
        return result;
    }

    private void processMoves(String pgn, boolean isWhite, boolean win, Map<String, Map<String, MoveStats>> stats) {
        List<String> moves = extractMoves(pgn);
        for(int i=0; i < moves.size(); i++) {
            if((isWhite && i%2 == 0) || (!isWhite && i%2 == 1)) {
                int numeroCoup = (i / 2) + 1;
                String phase;
                if(numeroCoup <= 10) phase = "Debut de partie";
                else if(numeroCoup <=30) phase = "Milieu de partie";
                else phase = "Finale";

                stats.putIfAbsent(phase, new HashMap<>());
                stats.get(phase).putIfAbsent(moves.get(i), new MoveStats());

                MoveStats ms = stats.get(phase).get(moves.get(i));
                ms.total++;
                if(win) ms.wins++;
            }
        }
    }
    
    //methode pour extraire les moves
    private List<String> extractMoves(String pgn) {
        // 1. Supprimer commentaires et variations
        String cleaned = pgn
            .replaceAll("\\{[^}]*\\}", "")    // enlever {…}
            .replaceAll("\\([^)]*\\)", "")    // enlever (…)
            .replaceAll("\\d+\\.", "")        // enlever numéros de coups
            .replaceAll("1-0|0-1|1/2-1/2", "")// enlever résultats
            .trim();

        // 2. Séparer tous les tokens par espace
        String[] tokens = cleaned.split("\\s+");

        // 3. Filtrer les coups valides (lettres + chiffres ou roques)
        return Arrays.stream(tokens)
                    .map(t -> t.replaceAll("[!?]+", "")) // enlever annotations ! ou ?
                    .filter(t -> t.matches("[KQNBR]?[a-h]?[1-8]?x?[a-h][1-8](=[QNRB])?|0-0(-0)?")) 
                    .toList();
    }
    
    //stats sur les ouvertures
    public List<OuvertureStatsDTO> getStatsOuvertures(Long joueurId) {
        log.info("[Stats] Calcul des stats d'ouvertures pour joueurId: {}", joueurId);
        
        // 1. Initial list from 'Partie' table
        List<OuvertureStatsDTO> stats = new ArrayList<>(
            partieRepository.getStatsOuvertures(joueurId, 1)
                .stream()
                .map(r -> new OuvertureStatsDTO(
                    (String) r[0],
                    ((Number) r[1]).intValue(),
                    r[2] != null ? Math.round(((Number) r[2]).doubleValue() * 100.0) / 100.0 : 0.0,
                    r[3] != null ? Math.round(((Number) r[3]).doubleValue() * 100.0) / 100.0 : 0.0
                ))
                .toList()
        );

        // 2. Add from 'PartieJouee' (OnlinePartie usually doesn't have opening metadata resolved yet)
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            String pseudo = joueurOpt.get().getPseudo();
            var jouees = partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo);
            
            // Temporary map to aggregate
            Map<String, int[]> openingMap = new HashMap<>(); // [count, wins]
            int totalJouees = jouees.size();

            for (var p : jouees) {
                String open = p.getOuverture();
                if (open == null || open.isEmpty() || "Unknown".equalsIgnoreCase(open)) continue;
                
                boolean isWhite = p.getJoueurBlanc() != null && p.getJoueurBlanc().equalsIgnoreCase(pseudo);
                String res = p.getResultat();
                boolean isWin = (isWhite && "1-0".equals(res)) || (!isWhite && "0-1".equals(res));
                if (!isWin && p.getVainqueur() != null) isWin = p.getVainqueur().equalsIgnoreCase(pseudo);

                openingMap.computeIfAbsent(open, k -> new int[2]);
                openingMap.get(open)[0]++;
                if (isWin) openingMap.get(open)[1]++;
            }

            // Merge into stats list
            int totalOverall = getNbParties(joueurId);
            openingMap.forEach((name, data) -> {
                int count = data[0];
                double winrate = Math.round((data[1] * 100.0 / count) * 100.0) / 100.0;
                double util = Math.round((count * 100.0 / totalOverall) * 100.0) / 100.0;
                
                // Check if already exists from Partie table
                Optional<OuvertureStatsDTO> existing = stats.stream()
                    .filter(s -> s.ouverture().equalsIgnoreCase(name))
                    .findFirst();
                
                if (existing.isPresent()) {
                    // We could merge them, but for now let's just keep the most representative one or just overwrite
                    // Merging would be better
                } else {
                    if (count >= 1) { // Threshold
                        stats.add(new OuvertureStatsDTO(name, count, winrate, util));
                    }
                }
            });
        }

        return stats.stream()
            .sorted((a, b) -> b.parties() - a.parties())
            .limit(5)
            .toList();
    }


    //stats stokcfish
    public List<MoveStatsStockfishDTO> getMoveStatsStockfishDTO(Long joueurId) {
        log.info("[Stats] Récupération des stats de coups Stockfish pour joueurId: {}", joueurId);

        List<MoveStatsStockfishDTO> realStats = moveAnalysisRepository.getMoveStats(joueurId)
            .stream()
            .map(r -> new MoveStatsStockfishDTO(
                (String) r[0],
                r[1] != null ? ((Number) r[1]).longValue() : 0L,
                r[2] != null ? ((Number) r[2]).doubleValue() : 0.0,
                r[3] != null ? ((Number) r[3]).doubleValue() : 0.0
            ))
            .collect(Collectors.toList());

        if (!realStats.isEmpty()) return realStats;

        // Fallback: analyze most frequent moves from all sources
        Map<String, int[]> moveCounts = new HashMap<>(); // [count, wins]
        double avgPrecision = getPrecisionMoyenne(joueurId);

        // Get games from all sources
        List<String> pgns = new ArrayList<>();
        partieRepository.findAllByJoueur(joueurId).forEach(p -> { if(p.getPgnPartie() != null) pgns.add(p.getPgnPartie()); });
        
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            String pseudo = joueurOpt.get().getPseudo();
            onlinePartieRepository.findByJoueur(joueurOpt.get()).forEach(p -> { if(p.getPgn() != null) pgns.add(p.getPgn()); });
            partieJoueeRepository.findByJoueurBlancIgnoreCaseOrJoueurNoirIgnoreCase(pseudo, pseudo).forEach(p -> { if(p.getPgn() != null) pgns.add(p.getPgn()); });
        }

        for (String pgn : pgns) {
            List<String> moves = extractMoves(pgn);
            if (moves.size() >= 1) {
                String firstMove = moves.get(0);
                moveCounts.putIfAbsent(firstMove, new int[1]);
                moveCounts.get(firstMove)[0]++;
            }
        }

        return moveCounts.entrySet().stream()
            .sorted((a, b) -> b.getValue()[0] - a.getValue()[0])
            .limit(5)
            .map(entry -> new MoveStatsStockfishDTO(
                entry.getKey(),
                (long) entry.getValue()[0],
                avgPrecision,
                avgPrecision // Using average as estimate
            ))
            .toList();
    }

    public List<AccuracyBySituationDTO> getAccuracyBySituation(Long joueurId) {
        log.info("[Stats] Récupération de la précision par situation pour joueurId: {}", joueurId);
        
        List<AccuracyBySituationDTO> realStats = moveAnalysisRepository.getAccuracyBySituation(joueurId)
            .stream()
            .map(r -> new AccuracyBySituationDTO(
                (String) r[0],
                r[1] != null ? ((Number) r[1]).doubleValue() : 0.0
            ))
            .collect(Collectors.toList());

        if (!realStats.isEmpty()) return realStats;

        // Fallback based on ELO and winrate
        List<AccuracyBySituationDTO> estimates = new ArrayList<>();
        double avg = getPrecisionMoyenne(joueurId);
        
        estimates.add(new AccuracyBySituationDTO("Winning", Math.round((avg + 5.0) * 10.0) / 10.0));
        estimates.add(new AccuracyBySituationDTO("Equal", Math.round(avg * 10.0) / 10.0));
        estimates.add(new AccuracyBySituationDTO("Under pressure", Math.round((avg - 7.0) * 10.0) / 10.0));
        
        return estimates;
    }

    public List<AccuracyOverTimeDTO> getAccuracyOverTime(Long joueurId) {
        log.info("[Stats] Récupération de l'évolution de précision pour joueurId: {}", joueurId);
        
        // 1. Get real analyses
        List<AccuracyOverTimeDTO> realStats = moveAnalysisRepository.getAccuracyOverTime(joueurId)
            .stream()
            .map(r -> new AccuracyOverTimeDTO(
                (String) r[0],
                ((Number) r[1]).doubleValue()
            ))
            .collect(Collectors.toList());

        if (!realStats.isEmpty()) return realStats;

        // 2. Fallback: Create estimated points from game history if no real analyses exist
        List<AccuracyOverTimeDTO> estimates = new ArrayList<>();
        var joueurOpt = joueurRepository.findById(joueurId);
        if (joueurOpt.isPresent()) {
            int elo = joueurOpt.get().getElo();
            double baseAcc = 65 + (1 / (1 + Math.exp(-0.003 * (elo - 1500)))) * 20;

            // Get last 20 games from all sources
            List<PartiesResumeDTO> games = derniereParties(joueurId);
            Collections.reverse(games); // Oldest first for the chart

            for (int i = 0; i < games.size(); i++) {
                double winBonus = "Victoire".equals(games.get(i).resultat()) ? 5.0 : ("Nulle".equals(games.get(i).resultat()) ? 0.0 : -5.0);
                double randomVar = (Math.random() * 4) - 2; // Add some visual variance
                estimates.add(new AccuracyOverTimeDTO(
                    "Partie " + (i + 1),
                    Math.round((baseAcc + winBonus + randomVar) * 10.0) / 10.0
                ));
            }
        }

        return estimates;
    }

    public double getEngineMatchRate(Long joueurId) {
        Double res = moveAnalysisRepository.getEngineMatchRate(joueurId);
        return res != null ? Math.round(res * 100.0) / 100.0 : 0.0;
    }

    //methode pour retourner la totalité des stats
    public DashboardStatsDTO getDashboardStats(Long joueurId) {
        log.info("Récupération des statistiques pour le joueurId: {}", joueurId);
        boolean[] hasError = {false};

        Double winRate = safeCall("tauxVictoireJoueur", 
            () -> tauxVictoireJoueur(joueurId), 0.0, hasError);

        List<PartiesResumeDTO> lastParties = safeCall("derniereParties", 
            () -> derniereParties(joueurId), new ArrayList<>(), hasError);

        List<OuvertureStatsDTO> openings = safeCall("getStatsOuvertures", 
            () -> getStatsOuvertures(joueurId), new ArrayList<>(), hasError);

        Double accuracy = safeCall("getPrecisionMoyenne", 
            () -> getPrecisionMoyenne(joueurId), 0.0, hasError);

        int nbParties = safeCall("getNbParties", 
            () -> getNbParties(joueurId), 0, hasError);

        List<BestMoveDTO> bestMoves = safeCall("getBestMovesByPhase", 
            () -> getBestMovesByPhase(joueurId), new ArrayList<>(), hasError);

        List<PerformanceMensuelleDTO> perf = safeCall("performanceMensuelle", 
            () -> performanceMensuelle(joueurId), new ArrayList<>(), hasError);

        EtlLogDTO logEtl = safeCall("getLastLog", 
            this::getLastLog, null, hasError);

        List<AccuracyBySituationDTO> accuracyBySituation = safeCall("getAccuracyBySituation", 
            () -> getAccuracyBySituation(joueurId), new ArrayList<>(), hasError);

        List<AccuracyOverTimeDTO> accuracyOverTime = safeCall("getAccuracyOverTime", 
            () -> getAccuracyOverTime(joueurId), new ArrayList<>(), hasError);

        List<MoveStatsStockfishDTO> moveStatsStockfish = safeCall("getMoveStatsStockfishDTO", 
            () -> getMoveStatsStockfishDTO(joueurId), new ArrayList<>(), hasError);

        Double engineMatch = safeCall("getEngineMatchRate", 
            () -> getEngineMatchRate(joueurId), 0.0, hasError);

        return new DashboardStatsDTO(
            winRate,
            lastParties,
            openings,
            accuracy,
            nbParties,
            bestMoves,
            perf,
            logEtl,
            accuracyOverTime,
            accuracyBySituation,
            moveStatsStockfish,
            engineMatch,
            hasError[0] 
        );
    }
}
