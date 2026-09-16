package com.chessmate.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MlGameDto {

    @JsonProperty("white_id")
    private String whiteId;

    @JsonProperty("black_id")
    private String blackId;

    @JsonProperty("winner")
    private String winner;

    @JsonProperty("victory_status")
    private String victoryStatus;

    @JsonProperty("turns")
    private Integer turns;

    @JsonProperty("rated")
    private Boolean rated;

    @JsonProperty("white_rating")
    private Integer whiteRating;

    @JsonProperty("black_rating")
    private Integer blackRating;

    @JsonProperty("opening_name")
    private String openingName;

    public MlGameDto() {
    }

    public String getWhiteId() {
        return whiteId;
    }

    public void setWhiteId(String whiteId) {
        this.whiteId = whiteId;
    }

    public String getBlackId() {
        return blackId;
    }

    public void setBlackId(String blackId) {
        this.blackId = blackId;
    }

    public String getWinner() {
        return winner;
    }

    public void setWinner(String winner) {
        this.winner = winner;
    }

    public String getVictoryStatus() {
        return victoryStatus;
    }

    public void setVictoryStatus(String victoryStatus) {
        this.victoryStatus = victoryStatus;
    }

    public Integer getTurns() {
        return turns;
    }

    public void setTurns(Integer turns) {
        this.turns = turns;
    }

    public Boolean getRated() {
        return rated;
    }

    public void setRated(Boolean rated) {
        this.rated = rated;
    }

    public Integer getWhiteRating() {
        return whiteRating;
    }

    public void setWhiteRating(Integer whiteRating) {
        this.whiteRating = whiteRating;
    }

    public Integer getBlackRating() {
        return blackRating;
    }

    public void setBlackRating(Integer blackRating) {
        this.blackRating = blackRating;
    }

    public String getOpeningName() {
        return openingName;
    }

    public void setOpeningName(String openingName) {
        this.openingName = openingName;
    }
}
