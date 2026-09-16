package com.chessmate.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Mappe la sortie JSON de {@code ml_engine/predict_game.py}.
 *
 * <p>Exemple de payload Python :</p>
 * <pre>
 * {
 *   "opening_family":      "Italian Game",
 *   "prob_white":          0.6123,
 *   "prob_black":          0.3234,
 *   "prob_draw":           0.0643,
 *   "insight_tag":         "Logique",
 *   "message":             "✅ Victoire maîtrisée...",
 *   "winner_prob_actual":  0.6123
 * }
 * </pre>
 *
 * En cas d'erreur Python, le champ {@code error} est renseigné.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MLAnalysisResponse {

    @JsonProperty("opening_family")
    private String openingFamily;

    @JsonProperty("prob_white")
    private Double probWhite;

    @JsonProperty("prob_black")
    private Double probBlack;

    @JsonProperty("prob_draw")
    private Double probDraw;

    @JsonProperty("insight_tag")
    private String insightTag;

    @JsonProperty("message")
    private String message;

    @JsonProperty("winner_prob_actual")
    private Double winnerProbActual;

    /** Présent uniquement si le script Python a renvoyé une erreur. */
    @JsonProperty("error")
    private String error;

    // ── Constructors ──────────────────────────────────────────────────────────

    public MLAnalysisResponse() {}

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** {@code true} si le script Python a retourné un objet d'erreur. */
    public boolean hasError() {
        return error != null && !error.isBlank();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public String getOpeningFamily() { return openingFamily; }
    public void setOpeningFamily(String openingFamily) { this.openingFamily = openingFamily; }

    public Double getProbWhite() { return probWhite; }
    public void setProbWhite(Double probWhite) { this.probWhite = probWhite; }

    public Double getProbBlack() { return probBlack; }
    public void setProbBlack(Double probBlack) { this.probBlack = probBlack; }

    public Double getProbDraw() { return probDraw; }
    public void setProbDraw(Double probDraw) { this.probDraw = probDraw; }

    public String getInsightTag() { return insightTag; }
    public void setInsightTag(String insightTag) { this.insightTag = insightTag; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Double getWinnerProbActual() { return winnerProbActual; }
    public void setWinnerProbActual(Double winnerProbActual) { this.winnerProbActual = winnerProbActual; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
