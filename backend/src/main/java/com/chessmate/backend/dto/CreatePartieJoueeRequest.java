package com.chessmate.backend.dto;

public class CreatePartieJoueeRequest {

    private String titre;
    private String joueurBlanc;
    private String joueurNoir;
    private String resultat;
    private String variant;
    private String ouverture;
    private String source;
    private String vainqueur;
    private Integer nombreCoups;
    private String pgn;
    private String resumeAnalyse;

    public CreatePartieJoueeRequest() {}

    public String getTitre() { return titre; }
    public void setTitre(String titre) { this.titre = titre; }

    public String getJoueurBlanc() { return joueurBlanc; }
    public void setJoueurBlanc(String joueurBlanc) { this.joueurBlanc = joueurBlanc; }

    public String getJoueurNoir() { return joueurNoir; }
    public void setJoueurNoir(String joueurNoir) { this.joueurNoir = joueurNoir; }

    public String getResultat() { return resultat; }
    public void setResultat(String resultat) { this.resultat = resultat; }

    public String getVariant() { return variant; }
    public void setVariant(String variant) { this.variant = variant; }

    public String getOuverture() { return ouverture; }
    public void setOuverture(String ouverture) { this.ouverture = ouverture; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVainqueur() { return vainqueur; }
    public void setVainqueur(String vainqueur) { this.vainqueur = vainqueur; }

    public Integer getNombreCoups() { return nombreCoups; }
    public void setNombreCoups(Integer nombreCoups) { this.nombreCoups = nombreCoups; }

    public String getPgn() { return pgn; }
    public void setPgn(String pgn) { this.pgn = pgn; }

    public String getResumeAnalyse() { return resumeAnalyse; }
    public void setResumeAnalyse(String resumeAnalyse) { this.resumeAnalyse = resumeAnalyse; }
}