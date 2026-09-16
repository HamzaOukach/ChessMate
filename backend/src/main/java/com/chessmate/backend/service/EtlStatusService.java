package com.chessmate.backend.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class EtlStatusService {
    // Stockage : JobId -> Status
    private final Map<String, String> statusMap = new ConcurrentHashMap<>();

    public void updateStatus(String jobId, String status) {
        statusMap.put(jobId, status);
    }

    public String getStatus(String jobId) {
        return statusMap.getOrDefault(jobId, "NOT_FOUND");
    }
}
