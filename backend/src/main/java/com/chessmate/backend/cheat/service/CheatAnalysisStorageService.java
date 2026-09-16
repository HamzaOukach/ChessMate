package com.chessmate.backend.cheat.service;

import com.chessmate.backend.cheat.entity.CheatAnalysisEntity;
import com.chessmate.backend.cheat.model.CheatReport;
import com.chessmate.backend.cheat.repository.CheatAnalysisRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CheatAnalysisStorageService {

    private final CheatAnalysisRepository repository;

    public CheatAnalysisStorageService(CheatAnalysisRepository repository) {
        this.repository = repository;
    }

    public CheatAnalysisEntity saveAnalysis(String pgn, CheatReport report) {
        CheatAnalysisEntity entity = new CheatAnalysisEntity();
        entity.setPgn(pgn);
        entity.setGlobalScore(report.getScore());
        entity.setGlobalVerdict(report.getVerdict());
        entity.setWhiteScore(report.getWhiteSummary().getScore());
        entity.setWhiteVerdict(report.getWhiteSummary().getVerdict());
        entity.setBlackScore(report.getBlackSummary().getScore());
        entity.setBlackVerdict(report.getBlackSummary().getVerdict());
        entity.setReliable(report.isReliable());
        entity.setReliabilityMessage(report.getReliabilityMessage());
        entity.setCreatedAt(LocalDateTime.now());

        return repository.save(entity);
    }

    public List<CheatAnalysisEntity> findAll() {
        return repository.findAll();
    }

    public CheatAnalysisEntity findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Analyse introuvable, id=" + id));
    }
}