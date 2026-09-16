import joblib
import pandas as pd
import json

pipeline = joblib.load('chess_cheating_model.joblib')

# Try with 1500/1500
base_features = {'white_num_moves': 21, 'white_avg_move_len': 3.0952380952380953, 'white_captures': 4, 'white_checks': 1, 'white_mates': 0, 'white_promotions': 0, 'white_castle_kingside': 0, 'white_castle_queenside': 0, 'white_queen_moves': 1, 'white_rook_moves': 0, 'white_bishop_moves': 2, 'white_knight_moves': 3, 'white_king_moves': 10, 'white_pawn_moves': 5, 'black_num_moves': 21, 'black_avg_move_len': 3.3333333333333335, 'black_captures': 6, 'black_checks': 6, 'black_mates': 1, 'black_promotions': 0, 'black_castle_kingside': 1, 'black_castle_queenside': 0, 'black_queen_moves': 0, 'black_rook_moves': 3, 'black_bishop_moves': 5, 'black_knight_moves': 4, 'black_king_moves': 0, 'black_pawn_moves': 8, 'total_tokens': 42, 'game_len_chars': 176, 'white_black_move_diff': 0, 'total_captures': 10, 'total_checks': 7, 'elo_white': 1500.0, 'elo_black': 1500.0, 'elo_diff': 0.0}

df = pd.DataFrame([base_features])
df = df[pipeline.feature_names_in_]
pred1 = pipeline.predict(df)[0]
prob1 = pipeline.predict_proba(df)[0]
print("1500 vs 1500:")
print(f"Pred: {pred1}, Probs: {prob1}")

# Try with 1200 / 2800
base_features['elo_white'] = 1200
base_features['elo_black'] = 2800
base_features['elo_diff'] = -1600
df = pd.DataFrame([base_features])
df = df[pipeline.feature_names_in_]
pred2 = pipeline.predict(df)[0]
prob2 = pipeline.predict_proba(df)[0]
print("\n1200 vs 2800:")
print(f"Pred: {pred2}, Probs: {prob2}")

# Try an empty game
empty_features = {k: 0 for k in base_features}
df_empty = pd.DataFrame([empty_features])
df_empty = df_empty[pipeline.feature_names_in_]
print("\nEmpty game:")
print(f"Pred: {pipeline.predict(df_empty)[0]}, Probs: {pipeline.predict_proba(df_empty)[0]}")
