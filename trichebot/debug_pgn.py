"""
Script de diagnostic: vérifie l'extraction des features PGN
et les compare avec ce que le modèle attend.
"""
import re
import joblib
import pandas as pd
import numpy as np

# ── Chargement du pipeline ──────────────────────────────────────
pipeline = joblib.load("chess_cheating_model.joblib")
EXPECTED_FEATURES = list(pipeline.feature_names_in_)
print("Features attendues par le modèle:")
print(EXPECTED_FEATURES)
print(f"Nombre: {len(EXPECTED_FEATURES)}\n")

# ── Fonctions de nettoyage améliorées ──────────────────────────
def clean_pgn(pgn: str) -> str:
    pgn = re.sub(r'\[.*?\]', '', pgn)          # Retirer les tags
    pgn = re.sub(r'\{[^}]*\}', '', pgn)         # Retirer les commentaires {}
    pgn = re.sub(r'\([^)]*\)', '', pgn)          # Retirer les variantes ()
    pgn = re.sub(r'\d+\.{1,3}\s*', '', pgn)     # Retirer les numéros de coups (1. ou 1... ou 1..)
    pgn = re.sub(r'\b(1-0|0-1|1/2-1/2|\*)\b', '', pgn)  # Retirer le résultat
    pgn = pgn.replace('\n', ' ')
    pgn = re.sub(r'\s+', ' ', pgn)
    return pgn.strip()

def count_pattern(moves: list, pattern: str) -> int:
    return sum(1 for move in moves if re.search(pattern, move))

def extract_features_from_pgn(pgn: str, elo_white: float, elo_black: float) -> dict:
    cleaned = clean_pgn(pgn)
    tokens = [t for t in cleaned.split() if t]  # Filtrer les tokens vides
    
    white_moves = tokens[0::2]
    black_moves = tokens[1::2]
    
    features = {}
    # BLANC
    features['white_num_moves'] = len(white_moves)
    features['white_avg_move_len'] = float(np.mean([len(m) for m in white_moves])) if white_moves else 0.0
    features['white_captures'] = count_pattern(white_moves, r'x')
    features['white_checks'] = count_pattern(white_moves, r'\+')
    features['white_mates'] = count_pattern(white_moves, r'#')
    features['white_promotions'] = count_pattern(white_moves, r'=')
    features['white_castle_kingside'] = white_moves.count('O-O')
    features['white_castle_queenside'] = white_moves.count('O-O-O')
    features['white_queen_moves'] = count_pattern(white_moves, r'^Q')
    features['white_rook_moves'] = count_pattern(white_moves, r'^R')
    features['white_bishop_moves'] = count_pattern(white_moves, r'^B')
    features['white_knight_moves'] = count_pattern(white_moves, r'^N')
    features['white_king_moves'] = count_pattern(white_moves, r'^K')
    features['white_pawn_moves'] = count_pattern(white_moves, r'^[a-h]')
    # NOIR
    features['black_num_moves'] = len(black_moves)
    features['black_avg_move_len'] = float(np.mean([len(m) for m in black_moves])) if black_moves else 0.0
    features['black_captures'] = count_pattern(black_moves, r'x')
    features['black_checks'] = count_pattern(black_moves, r'\+')
    features['black_mates'] = count_pattern(black_moves, r'#')
    features['black_promotions'] = count_pattern(black_moves, r'=')
    features['black_castle_kingside'] = black_moves.count('O-O')
    features['black_castle_queenside'] = black_moves.count('O-O-O')
    features['black_queen_moves'] = count_pattern(black_moves, r'^Q')
    features['black_rook_moves'] = count_pattern(black_moves, r'^R')
    features['black_bishop_moves'] = count_pattern(black_moves, r'^B')
    features['black_knight_moves'] = count_pattern(black_moves, r'^N')
    features['black_king_moves'] = count_pattern(black_moves, r'^K')
    features['black_pawn_moves'] = count_pattern(black_moves, r'^[a-h]')
    # GLOBAUX
    features['total_tokens'] = len(tokens)
    features['game_len_chars'] = len(cleaned)
    features['white_black_move_diff'] = len(white_moves) - len(black_moves)
    features['total_captures'] = features['white_captures'] + features['black_captures']
    features['total_checks'] = features['white_checks'] + features['black_checks']
    features['elo_white'] = elo_white
    features['elo_black'] = elo_black
    features['elo_diff'] = elo_white - elo_black
    
    return features, white_moves, black_moves

# ── Test 1: PGN propre simple ───────────────────────────────────
pgn_simple = """[Event "Rated Bullet game"]
[White "Player1"] [Black "Player2"] [WhiteElo "1523"] [BlackElo "1487"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0"""

print("=" * 60)
print("TEST 1: PGN simple (pas de triche attendu)")
print("=" * 60)
feats, wm, bm = extract_features_from_pgn(pgn_simple, 1523.0, 1487.0)
print(f"Coups blancs ({len(wm)}): {wm}")
print(f"Coups noirs  ({len(bm)}): {bm}")
df = pd.DataFrame([feats])[EXPECTED_FEATURES]
pred = pipeline.predict(df)[0]
probs = pipeline.predict_proba(df)[0]
print(f"→ Prédiction: {'TRICHE' if pred == 1 else 'PROPRE'}, confiance: {max(probs):.4f}")
print()

# ── Test 2: PGN avec annotations Lichess (commentaires eval) ──
pgn_annotated = """[Event "Rated Bullet game"]
[White "Player1"] [Black "Player2"] [WhiteElo "1523"] [BlackElo "1487"]
1. e4 { [%eval 0.32] } 1... e5 { [%eval 0.28] } 2. Nf3 { [%eval 0.41] } 2... Nc6 { [%eval 0.35] } 3. Bb5 { [%eval 0.55] } 3... a6 { [%eval 0.48] } 4. Ba4 { [%eval 0.52] } 4... Nf6 { [%eval 0.38] } 5. O-O { [%eval 0.45] } 5... Be7 { [%eval 0.40] } 6. Re1 { [%eval 0.44] } 6... b5 { [%eval 0.38] } 7. Bb3 { [%eval 0.48] } 7... d6 { [%eval 0.42] } 1-0"""

print("=" * 60)
print("TEST 2: PGN avec annotations %eval Lichess")
print("=" * 60)
feats, wm, bm = extract_features_from_pgn(pgn_annotated, 1523.0, 1487.0)
print(f"Coups blancs ({len(wm)}): {wm}")
print(f"Coups noirs  ({len(bm)}): {bm}")
df = pd.DataFrame([feats])[EXPECTED_FEATURES]
pred = pipeline.predict(df)[0]
probs = pipeline.predict_proba(df)[0]
print(f"→ Prédiction: {'TRICHE' if pred == 1 else 'PROPRE'}, confiance: {max(probs):.4f}")
print()

# ── Test 3: PGN avec Elo très élevé (doit déclencher TRICHE ?) ─
pgn_suspicious = """[Event "Rated Blitz game"]
[White "Cheater69"] [Black "Victim"] [WhiteElo "950"] [BlackElo "1800"]
1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Ndb5 d6 7. Bf4 e5 8. Bg5 a6 9. Na3 b5 10. Nd5 Be6 11. Bxf6 gxf6 12. c3 Bg7 13. Qa4 Qd7 14. Bxb5 axb5 15. Qxa8+ Kd7 16. Qxa8 f5 17. O-O Ne7 18. Nxb4+ Kc7 19. Nxb5+ Kb6 20. Nc3 Nc6 21. Qb8# 1-0"""

print("=" * 60)
print("TEST 3: PGN suspect (Elo 950 bat 1800 avec partie parfaite)")
print("=" * 60)
feats, wm, bm = extract_features_from_pgn(pgn_suspicious, 950.0, 1800.0)
print(f"Coups blancs ({len(wm)}): {wm}")
print(f"Coups noirs  ({len(bm)}): {bm}")
print(f"Captures blanc: {feats['white_captures']}, Vérifications: {feats['white_checks']}")
df = pd.DataFrame([feats])[EXPECTED_FEATURES]
pred = pipeline.predict(df)[0]
probs = pipeline.predict_proba(df)[0]
print(f"→ Prédiction: {'TRICHE' if pred == 1 else 'PROPRE'}, confiance: {max(probs):.4f}")
print(f"   Prob[propre]={probs[0]:.4f}, Prob[triche]={probs[1] if len(probs) > 1 else 'N/A'}")
print()

# ── Vérification: features manquantes ou inattendues ───────────
print("=" * 60)
print("VÉRIFICATION ALIGNEMENT FEATURES")
print("=" * 60)
features_extraites = set(feats.keys())
features_modele = set(EXPECTED_FEATURES)
missing = features_modele - features_extraites
extra = features_extraites - features_modele
print(f"Features dans le modèle: {len(features_modele)}")
print(f"Features extraites: {len(features_extraites)}")
if missing:
    print(f"⚠️  MANQUANTES: {missing}")
else:
    print("✅ Aucune feature manquante")
if extra:
    print(f"⚠️  EN TROP: {extra}")
else:
    print("✅ Aucune feature en trop")
