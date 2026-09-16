package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Component
public class MachineLearningDetector implements CheatDetector {

    @org.springframework.beans.factory.annotation.Value("${app.cheat-bot-url:http://trichebot:5000/api/predict/cheat}")
    private String pythonApiUrl;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public CheatSignal detect(GameData game, EngineOracle oracle) {
        // This is the standard interface method. 
        // For ML, we ideally need the PGN which isn't in GameData.
        // We will call this from a specialized method in CheatDetectionService or 
        // pass data via thread locals (not ideal) or just handle it separately.
        return new CheatSignal("MachineLearning", 0, "Requires full PGN context");
    }

    public CheatSignal detectWithPgn(String pgn, double eloWhite, double eloBlack) {
        try {
            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("pgn", pgn);
            rootNode.put("elo_white", eloWhite);
            rootNode.put("elo_black", eloBlack);

            String requestBody = objectMapper.writeValueAsString(rootNode);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(pythonApiUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode result = objectMapper.readTree(response.body());
                boolean cheatDetected = result.get("cheat_detected").asBoolean();
                double confidenceScore = result.get("confidence_score").asDouble();

                double suspicionScore = confidenceScore * 100;
                // If the model says "Not cheating" with 90% confidence, suspicion is 10.
                if (!cheatDetected) {
                    suspicionScore = (1 - confidenceScore) * 100;
                }

                return new CheatSignal("MachineLearning", suspicionScore,
                        "ML Verdict: " + (cheatDetected ? "Suspect" : "Legit") + " (Conf: " + Math.round(confidenceScore * 100) + "%)");
            } else {
                return new CheatSignal("MachineLearning", 0, "Python API Error: " + response.statusCode());
            }
        } catch (Exception e) {
            return new CheatSignal("MachineLearning", 0, "ML Service Offline: " + e.getMessage());
        }
    }
}
