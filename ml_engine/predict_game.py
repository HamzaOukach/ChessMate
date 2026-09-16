# -*- coding: utf-8 -*-
"""
predict_game.py — Production ML Inference Script
=================================================
Pont critique entre le Backend Java (Spring Boot) et le modèle ML.

Contrat strict :
  - STDOUT  → un unique objet JSON (résultat ou erreur)
  - STDERR  → tout log / warning de chargement
  - Exit 0  → toujours (le backend détecte les erreurs via le champ "error")
"""

# ── 0. Suppression totale des warnings avant tout import ──────────────────────
import warnings
warnings.filterwarnings("ignore")

import sys
import os
import json
import logging
import argparse

# Force stdout en UTF-8 sur Windows (évite UnicodeEncodeError avec les emojis)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Redirige les logs de bibliothèques tierces (sklearn, joblib…) vers stderr
logging.basicConfig(stream=sys.stderr, level=logging.ERROR)

# ── 1. Imports potentiellement bavards — APRÈS la neutralisation des warnings ──
try:
    import joblib
    import pandas as pd
except ImportError as e:
    print(json.dumps({"error": f"Dépendance manquante : {e}"}))
    sys.exit(0)


# ── 2. Chemins absolus basés sur l'emplacement du script ──────────────────────
_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_BASE_DIR, "opening_model.pkl")
_DICT_PATH  = os.path.join(_BASE_DIR, "opening_dict.json")


# ── 3. Parsing des arguments CLI ──────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Chess Opening ML Predictor — sortie JSON unique sur stdout"
    )
    parser.add_argument(
        "--moves",
        type=str,
        required=True,
        help="Chaîne de coups SAN séparés par des espaces (ex: 'e4 e5 Nf3 Nc6')"
    )
    parser.add_argument(
        "--turns",
        type=int,
        required=True,
        help="Nombre total de coups joués dans la partie"
    )
    parser.add_argument(
        "--winner",
        type=str,
        required=True,
        choices=["white", "black", "draw"],
        help="Vainqueur réel de la partie"
    )
    return parser.parse_args()


# ── 4. Extraction des 4 premiers coups ────────────────────────────────────────
def extract_opening_key(moves_str: str) -> str:
    """Retourne les 4 premiers tokens de la chaîne de coups."""
    tokens = moves_str.strip().split()
    return " ".join(tokens[:4])


# ── 5. Matching d'ouverture ───────────────────────────────────────────────────
def lookup_opening(opening_dict: dict, key: str) -> str:
    """Cherche la famille d'ouverture ; retourne 'Unknown Opening' si absente."""
    return opening_dict.get(key, "Unknown Opening")


# ── 6. Calcul de l'insight ────────────────────────────────────────────────────
def compute_insight(winner: str, prob_white: float, prob_black: float, prob_draw: float) -> dict:
    """
    Extrait la probabilité du vainqueur réel et détermine le tag d'insight,
    puis construit un message dynamique intégrant les probabilités réelles
    issues de predict_proba().

    Seuils :
      < 0.40  → Exploit   (victoire contre les pronostics)
      > 0.55  → Logique   (victoire attendue)
      sinon   → Équilibré (partie serrée)

    Format du message :
      📊 Analyse Statistiques : Victoire Blanc (X.X%) | Victoire Noir (X.X%) | Nul (X.X%). Résultat : {tag}.
    """
    prob_map = {
        "white": prob_white,
        "black": prob_black,
        "draw":  prob_draw,
    }
    winner_prob = round(prob_map.get(winner, 0.0), 4)

    # ── Détermination du tag ──────────────────────────────────────────────────
    if winner_prob < 0.40:
        tag = "Exploit"
    elif winner_prob > 0.55:
        tag = "Logique"
    else:
        tag = "Équilibré"

    # ── Formatage des probabilités à 1 décimale (valeurs réelles du modèle) ──
    p_w = f"{prob_white * 100:.1f}"
    p_b = f"{prob_black * 100:.1f}"
    p_d = f"{prob_draw  * 100:.1f}"

    # ── Construction du message dynamique ────────────────────────────────────
    msg = (
        f"📊 Analyse Statistiques : "
        f"Victoire Blanc ({p_w}%) | "
        f"Victoire Noir ({p_b}%) | "
        f"Nul ({p_d}%). "
        f"Résultat : {tag}."
    )

    return {
        "insight_tag":         tag,
        "message":             msg,
        "winner_prob_actual":  winner_prob,
    }


# ── 7. Inférence principale ───────────────────────────────────────────────────
def predict(moves: str, turns: int, winner: str) -> dict:
    """
    Charge les artefacts ML, effectue la prédiction et renvoie le dictionnaire
    de résultats. Lève une exception en cas d'erreur critique.
    """
    # 7.1 Chargement du dictionnaire d'ouvertures
    with open(_DICT_PATH, "r", encoding="utf-8") as fh:
        opening_dict = json.load(fh)

    # 7.2 Chargement du pipeline ML (redirige stdout/stderr interne vers /dev/null)
    pipeline = joblib.load(_MODEL_PATH)

    # 7.3 Matching d'ouverture
    opening_key    = extract_opening_key(moves)
    opening_family = lookup_opening(opening_dict, opening_key)

    # 7.4 Création du DataFrame d'inférence avec les colonnes attendues par le modèle
    X_input = pd.DataFrame([{
        "opening_family": opening_family,
        "turns":          turns,
    }])

    # 7.5 predict_proba → [p_black, p_draw, p_white]  (ordre alphabétique des classes)
    classes   = list(pipeline.classes_)          # ex: ['black', 'draw', 'white']
    proba_row = pipeline.predict_proba(X_input)[0]

    prob_map = dict(zip(classes, proba_row))
    prob_white = round(float(prob_map.get("white", 0.0)), 4)
    prob_black = round(float(prob_map.get("black", 0.0)), 4)
    prob_draw  = round(float(prob_map.get("draw",  0.0)), 4)

    # 7.6 Calcul de l'insight
    insight = compute_insight(winner, prob_white, prob_black, prob_draw)

    return {
        "opening_family":     opening_family,
        "prob_white":         prob_white,
        "prob_black":         prob_black,
        "prob_draw":          prob_draw,
        "insight_tag":        insight["insight_tag"],
        "message":            insight["message"],
        "winner_prob_actual": insight["winner_prob_actual"],
    }


# ── 8. Point d'entrée ─────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()

    try:
        result = predict(
            moves=args.moves,
            turns=args.turns,
            winner=args.winner,
        )
    except FileNotFoundError as e:
        result = {"error": f"Artefact ML introuvable : {e}"}
    except Exception as e:
        result = {"error": f"Erreur lors de l'inférence ML : {type(e).__name__}: {e}"}

    # Sortie UNIQUE sur stdout — le seul print autorisé dans ce script
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
