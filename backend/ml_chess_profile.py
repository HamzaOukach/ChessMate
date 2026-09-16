"""
ml_chess_profile.py
===================
Générateur de profil personnalisé d'échecs.

Compare les parties d'un joueur spécifique à une baseline globale (issue de games_final_clean.csv).
Génère un profil au format JSON consommable par une API Spring Boot.

Auteurs : Lichess 2025-2026
"""

import json
import logging
import argparse
import sys
from pathlib import Path
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def load_global_baseline(csv_path: str) -> pd.DataFrame:
    """Charge le dataset global utilisé UNIQUEMENT comme baseline."""
    log.info(f"Chargement de la baseline globale depuis: {csv_path}")
    df = pd.read_csv(csv_path)
    return df


def load_user_games(csv_path: str | None = None, df: pd.DataFrame | None = None) -> pd.DataFrame:
    """Charge les parties à analyser. Peut utiliser le dataframe déjà en mémoire."""
    if df is not None:
        return df.copy()
    if csv_path:
        return pd.read_csv(csv_path)
    raise ValueError("Il faut fournir soit csv_path soit un dataframe df.")


def filter_games_for_user(user_id: str, games_df: pd.DataFrame) -> pd.DataFrame:
    """Filtre les parties pour un utilisateur donné."""
    log.info(f"Filtrage des parties avec l'utilisateur: {user_id}")
    user_games = games_df[(games_df["white_id"] == user_id) | (games_df["black_id"] == user_id)].copy()
    return user_games


def compute_global_baseline_metrics(global_df: pd.DataFrame) -> dict:
    """Calcule les métriques globales (moyennes de la base au complet)."""
    log.info("Calcul des métriques globales (baseline)...")
    total = len(global_df)
    if total == 0:
        return {}

    white_wins = (global_df["winner"] == "white").sum()
    black_wins = (global_df["winner"] == "black").sum()
    draws = (global_df["winner"] == "draw").sum()

    return {
        "global_win_rate": (white_wins + black_wins) / total * 100,
        "global_draw_rate": draws / total * 100,
        "global_resign_rate": (global_df["victory_status"] == "resign").sum() / total * 100,
        "global_mate_rate": (global_df["victory_status"] == "mate").sum() / total * 100,
        "avg_turns": global_df["turns"].mean() if "turns" in global_df.columns else 0,
        "turns_series": global_df["turns"] if "turns" in global_df.columns else pd.Series(dtype=float),
    }


def compute_user_metrics(user_games_df: pd.DataFrame, user_id: str) -> dict:
    """Calcule les statistiques spécifiques à l'utilisateur."""
    log.info(f"Calcul des métriques utilisateur pour: {user_id}...")
    total = len(user_games_df)
    if total == 0:
        return {}

    wins = 0
    losses = 0
    draws = 0

    for _, row in user_games_df.iterrows():
        if row["winner"] == "draw":
            draws += 1
        elif (row["winner"] == "white" and row["white_id"] == user_id) or \
             (row["winner"] == "black" and row["black_id"] == user_id):
            wins += 1
        else:
            losses += 1

    fav_opening = "Unknown"
    if "opening_name" in user_games_df.columns:
        # Extraction astucieuse de la "famille" (le segment avant : ou #)
        families = user_games_df["opening_name"].astype(str).apply(lambda x: x.split(':')[0].split('#')[0].strip())
        if not families.empty:
            fav_opening = families.mode()[0]
            
    # S\'assurer qu'il a joué des parties pour calculer ses pourcentages vs resign
    resign_rate = (user_games_df["victory_status"] == "resign").sum() / total * 100
    mate_rate = (user_games_df["victory_status"] == "mate").sum() / total * 100
    timeout_rate = (user_games_df["victory_status"] == "outoftime").sum() / total * 100
    rated_rate = user_games_df["rated"].astype(int).mean() * 100 if "rated" in user_games_df.columns else 0.0
    
    # Check si avg_rating est présent
    # Dans les CSV nettoyés, c'est la moyenne elo ou le rating unique, sinon on tente white/black
    user_ratings = []
    if "white_rating" in user_games_df.columns and "black_rating" in user_games_df.columns:
        for _, row in user_games_df.iterrows():
            if row["white_id"] == user_id:
                user_ratings.append(row["white_rating"])
            else:
                user_ratings.append(row["black_rating"])
    
    avg_rating = sum(user_ratings) / len(user_ratings) if user_ratings else 1500

    return {
        "total_games": total,
        "win_rate": wins / total * 100,
        "draw_rate": draws / total * 100,
        "loss_rate": losses / total * 100,
        "avg_turns": user_games_df["turns"].mean() if "turns" in user_games_df.columns else 0,
        "avg_rating": avg_rating,
        "resign_rate": resign_rate,
        "mate_rate": mate_rate,
        "timeout_rate": timeout_rate,
        "rated_rate": rated_rate,
        "favorite_opening_family": fav_opening
    }


def compare_user_to_baseline(user_metrics: dict, baseline_metrics: dict) -> dict:
    """Génère les comparaisons par rapport au dataset global."""
    log.info("Comparaison des métriques utilisateur VS baseline...")
    if not user_metrics or not baseline_metrics:
        return {
            "speed_percentile": 50.0,
            "aggressiveness_percentile": 50.0,
            "resign_rate_delta": 0.0,
            "win_rate_delta": 0.0,
            "opening_diversity_percentile": 50.0
        }

    turns_series = baseline_metrics["turns_series"]
    user_turns = user_metrics["avg_turns"]

    # Speed: moins de tours = plus rapide (gagnant ou perdant vite). percentile de la vitesse = % de parties globales plus lentes
    speed_percentile = (turns_series > user_turns).mean() * 100 if not turns_series.empty else 50.0
    
    aggs = (user_metrics["mate_rate"] / max(0.1, baseline_metrics["global_mate_rate"])) * 50
    aggressiveness_percentile = min(100.0, aggs)

    resign_delta = user_metrics["resign_rate"] - baseline_metrics["global_resign_rate"]
    win_delta = user_metrics["win_rate"] - baseline_metrics["global_win_rate"]

    return {
        "speed_percentile": round(speed_percentile, 1),
        "aggressiveness_percentile": round(aggressiveness_percentile, 1),
        "resign_rate_delta": round(resign_delta, 1),
        "win_rate_delta": round(win_delta, 1),
        "opening_diversity_percentile": 50.0
    }


def calculate_user_profile(user_id: str, user_games_df: pd.DataFrame, global_baseline_df: pd.DataFrame) -> dict:
    """Orchestrateur qui assemble l\'output JSON final selon l'interface attendue."""
    baseline_metrics = compute_global_baseline_metrics(global_baseline_df)
    user_metrics = compute_user_metrics(user_games_df, user_id)
    
    if not user_metrics:
        raise ValueError(f"L'utilisateur {user_id} n'a aucune partie analysable.")
        
    comparisons = compare_user_to_baseline(user_metrics, baseline_metrics)

    # Catégoriser le niveau
    rating = user_metrics.get("avg_rating", 1500)
    if rating < 1300: level = "Débutant"
    elif rating < 1500: level = "Intermédiaire–"
    elif rating < 1700: level = "Intermédiaire+"
    elif rating < 1900: level = "Avancé"
    elif rating < 2100: level = "Expert"
    else: level = "Maître"

    # Style et rythme
    sp_pct = comparisons.get("speed_percentile", 50)
    ag_pct = comparisons.get("aggressiveness_percentile", 50)
    
    style = "Tactique" if ag_pct > 60 else "Stratégique" if ag_pct < 40 else "Équilibré"
    rhythm = "Rapide" if sp_pct > 65 else "Lent" if sp_pct < 35 else "Moyen"
        
    insights = {
        "player_tendency": f"Joueur {style.lower()}, évoluant généralement sur un rythme {rhythm.lower()}.",
        "strengths": [],
        "weaknesses": [],
        "recommendations": []
    }

    if comparisons["win_rate_delta"] > 5:
        insights["strengths"].append("Taux de victoire significativement au-dessus de la moyenne.")
    elif comparisons["win_rate_delta"] < -5:
        insights["weaknesses"].append("Taux de victoire en dessous de la moyenne.")

    if comparisons["resign_rate_delta"] > 10:
        insights["weaknesses"].append("Forte tendance à l'abandon prématuré.")
        insights["recommendations"].append("Essayez de jouer des positions difficiles, la résistance est clé pour votre progression.")
    elif comparisons["resign_rate_delta"] < -10:
        insights["strengths"].append("Très bonne ténacité (abandonne rarement comparé aux autres joueurs).")
        
    if user_metrics["mate_rate"] > baseline_metrics["global_mate_rate"] * 1.2:
        insights["strengths"].append("Fort instinct de finition (beaucoup de mats portés).")
        
    if not insights["recommendations"]:
        insights["recommendations"].append("Continuez de diversifier vos ouvertures et de travailler vos finales.")

    total_games = user_metrics["total_games"]
    min_recommended = 10

    profile = {
        "user_id": user_id,
        "source": {
            "profile_type": "user_personalized",
            "computation_mode": "heuristic",
            "baseline_used": True,
            "baseline_dataset": "games_final_clean.csv"
        },
        "sample_size": {
            "games_analyzed": total_games,
            "minimum_recommended_games": min_recommended,
            "is_small_sample": total_games < min_recommended
        },
        "global_profile": {
            "estimated_level": level,
            "dominant_style": style,
            "dominant_rhythm": rhythm,
            "favorite_opening_family": user_metrics["favorite_opening_family"]
        },
        "metrics": {
            "win_rate": round(user_metrics["win_rate"], 1),
            "draw_rate": round(user_metrics["draw_rate"], 1),
            "loss_rate": round(user_metrics["loss_rate"], 1),
            "avg_moves": round(user_metrics["avg_turns"], 1),
            "avg_rating": round(user_metrics["avg_rating"], 1),
            "resign_rate": round(user_metrics["resign_rate"], 1),
            "mate_rate": round(user_metrics["mate_rate"], 1),
            "timeout_rate": round(user_metrics["timeout_rate"], 1),
            "rated_rate": round(user_metrics["rated_rate"], 1)
        },
        "comparisons_vs_global_baseline": comparisons,
        "insights": insights,
        "confidence": {
            "score": round(min(1.0, total_games / 50.0), 2),
            "reason": f"Basé sur {total_games} parties (confiance maximale atteinte à 50 parties)."
        }
    }
    
    return profile


def export_profile_json(profile: dict, output_path: str) -> None:
    """Exporte le profil JSON généré."""
    out_path = Path(output_path)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=4, ensure_ascii=False)
    log.info(f"Profil exporté avec succès dans: {out_path}")


def generate_profile_from_user_data(user_id: str, user_games_data: list[dict], global_baseline_df: pd.DataFrame) -> dict:
    """
    Point d'entrée principal recommandé pour la production (Spring Boot).
    - user_id: ID de l'utilisateur de l'application
    - user_games_data: Liste de dictionnaires représentant les parties de l'utilisateur (fournies par Spring Boot)
    - global_baseline_df: DataFrame de référence globale instancié une seule fois côté serveur Python
    """
    log.info(f"Création dynamique du profil personnalisé pour l'utilisateur: {user_id}")
    user_games_df = pd.DataFrame(user_games_data)
    return calculate_user_profile(user_id, user_games_df, global_baseline_df)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Générateur de profil d'échecs personnalisé CLI.")
    parser.add_argument("--target-user", type=str, required=True, help="ID de l'utilisateur à profiler.")
    parser.add_argument("--user-games-file", type=str, help="Attendu: chemin vers un fichier JSON contenant une liste de parties. Si non fourni, le script lira depuis l'entrée standard (stdin).")
    parser.add_argument("--baseline-default", type=str, default=r"C:\Users\33769\Downloads\archive\games_final_clean.csv", help="Chemin vers le fichier de données de comparaison globales (CSV).")
    
    args = parser.parse_args()

    user_games_data = []

    # 1. Obtenir les données utilisateur (Fichier JSON externe ou STDIN)
    if args.user_games_file:
        try:
            with open(args.user_games_file, "r", encoding="utf-8") as f:
                user_games_data = json.load(f)
        except Exception as e:
            log.error(f"Impossible de lire ou de décoder le fichier de données JSON '{args.user_games_file}': {e}")
            sys.exit(1)
    else:
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                log.error("Aucun argument --user-games-file spécifié et l'entrée standard STDIN est vide.")
                sys.exit(1)
            user_games_data = json.loads(stdin_data)
        except json.JSONDecodeError as e:
            log.error(f"Impossible de décoder les données JSON issues de STDIN: {e}")
            sys.exit(1)

    if not isinstance(user_games_data, list):
        log.error("Le format d'entrée JSON attend un tableau (array) d'objets parties de jeux.")
        sys.exit(1)
        
    if not len(user_games_data):
        log.error("Arrêt anticipé: aucune partie trouvée pour cet utilisateur dans le dataset fourni.")
        sys.exit(1)

    # 2. Charger le dataset global (Baseline)
    try:
        baseline_df = load_global_baseline(args.baseline_default)
    except Exception as e:
        log.error(f"Erreur de chargement de la baseline '{args.baseline_default}': {e}")
        sys.exit(1)

    # 3. Générer le profil personnalisé en les comparant
    try:
        profile = generate_profile_from_user_data(args.target_user, user_games_data, baseline_df)
        
        # 4. EXPORT FINAL SUR STDOUT pour l'application d'acquisition (Spring Boot)
        # Attention: utiliser print sans décoration supplémentaire ou de messages interactifs permet à Java de le lire fluidement.
        print(json.dumps(profile, indent=2, ensure_ascii=False))
        
    except ValueError as e:
        log.error(f"Erreur lors du calcul ML du profil: {e}")
        sys.exit(1)
