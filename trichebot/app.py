import re
import joblib
import pandas as pd
import numpy as np
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 1. Chargement du Modèle (Au démarrage)
try:
    pipeline = joblib.load("chess_cheating_model.joblib")
    if pipeline is None or not hasattr(pipeline, 'predict'):
        print(f"ERREUR: Le modèle chargé est invalide (type={type(pipeline)}, valeur={pipeline})")
        pipeline = None
    else:
        print("Modèle XGBoost chargé avec succès !")
        if hasattr(pipeline, "feature_names_in_"):
            EXPECTED_FEATURES = list(pipeline.feature_names_in_)
            print(f"Features attendues : {len(EXPECTED_FEATURES)}")
        else:
            EXPECTED_FEATURES = None
except Exception as e:
    print(f"Erreur lors du chargement du modèle : {type(e).__name__}: {e}")
    traceback.print_exc()
    pipeline = None

app = FastAPI(
    title="API de Détection de Triche aux Échecs",
    description="Endpoint pour prédire si un joueur a triché (XGBoost Pipeline).",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CheatPredictionRequest(BaseModel):
    pgn: str
    elo_white: float
    elo_black: float

def clean_pgn(pgn: str) -> str:
    # 1. Retirer les tags comme [Event "..."]
    pgn = re.sub(r'\[.*?\]', '', pgn)
    # 2. Retirer les commentaires entre { ... }
    pgn = re.sub(r'\{[^}]*\}', '', pgn)
    # 3. Retirer les variations entre ( ... )
    pgn = re.sub(r'\([^)]*\)', '', pgn)
    # 4. Retirer les numéros de coups (1., 1..., 1..)
    pgn = re.sub(r'\d+\.{1,3}\s*', '', pgn)
    # 5. Retirer les résultats de fin de partie (1-0, 0-1, 1/2-1/2, *)
    pgn = re.sub(r'\b(1-0|0-1|1/2-1/2|\*)\b', '', pgn)
    # 6. Nettoyer les espaces et retours à la ligne
    pgn = pgn.replace('\n', ' ')
    pgn = re.sub(r'\s+', ' ', pgn)
    return pgn.strip()

def count_pattern(moves: list, pattern: str) -> int:
    return sum(1 for move in moves if re.search(pattern, move))

def extract_features(pgn: str, elo_white: float, elo_black: float) -> pd.DataFrame:
    cleaned_pgn = clean_pgn(pgn)
    tokens = cleaned_pgn.split()
    
    white_moves = list(tokens[0::2])
    black_moves = list(tokens[1::2])
    
    # Features demandées par le modèle (inspectées via inspect_model.py)
    # ['white_num_moves', 'white_avg_move_len', 'white_captures', 'white_checks', 'white_mates', 'white_promotions', 
    #  'white_castle_kingside', 'white_castle_queenside', 'white_queen_moves', 'white_rook_moves', 
    #  'white_bishop_moves', 'white_knight_moves', 'white_king_moves', 'white_pawn_moves', ...]
    
    features = {}
    
    # BLANC
    features['white_num_moves'] = len(white_moves)
    features['white_avg_move_len'] = np.mean([len(m) for m in white_moves]) if white_moves else 0
    features['white_captures'] = count_pattern(white_moves, r'x')
    features['white_checks'] = count_pattern(white_moves, r'\+')
    features['white_mates'] = count_pattern(white_moves, r'#')
    features['white_promotions'] = count_pattern(white_moves, r'=')
    features['white_castle_kingside'] = count_pattern(white_moves, r'^O-O$')
    features['white_castle_queenside'] = count_pattern(white_moves, r'^O-O-O$')
    features['white_queen_moves'] = count_pattern(white_moves, r'^Q')
    features['white_rook_moves'] = count_pattern(white_moves, r'^R')
    features['white_bishop_moves'] = count_pattern(white_moves, r'^B')
    features['white_knight_moves'] = count_pattern(white_moves, r'^N')
    features['white_king_moves'] = count_pattern(white_moves, r'^K')
    features['white_pawn_moves'] = count_pattern(white_moves, r'^[a-h]')
    
    # NOIR
    features['black_num_moves'] = len(black_moves)
    features['black_avg_move_len'] = np.mean([len(m) for m in black_moves]) if black_moves else 0
    features['black_captures'] = count_pattern(black_moves, r'x')
    features['black_checks'] = count_pattern(black_moves, r'\+')
    features['black_mates'] = count_pattern(black_moves, r'#')
    features['black_promotions'] = count_pattern(black_moves, r'=')
    features['black_castle_kingside'] = count_pattern(black_moves, r'^O-O$')
    features['black_castle_queenside'] = count_pattern(black_moves, r'^O-O-O$')
    features['black_queen_moves'] = count_pattern(black_moves, r'^Q')
    features['black_rook_moves'] = count_pattern(black_moves, r'^R')
    features['black_bishop_moves'] = count_pattern(black_moves, r'^B')
    features['black_knight_moves'] = count_pattern(black_moves, r'^N')
    features['black_king_moves'] = count_pattern(black_moves, r'^K')
    features['black_pawn_moves'] = count_pattern(black_moves, r'^[a-h]')
    
    # GLOBAUX
    features['total_tokens'] = len(tokens)
    features['game_len_chars'] = len(cleaned_pgn)
    features['white_black_move_diff'] = len(white_moves) - len(black_moves)
    features['total_captures'] = features['white_captures'] + features['black_captures']
    features['total_checks'] = features['white_checks'] + features['black_checks']
    
    features['elo_white'] = elo_white
    features['elo_black'] = elo_black
    features['elo_diff'] = elo_white - elo_black
    
    # Création du DataFrame avec une seule ligne
    df = pd.DataFrame([features])
    
    # S'assurer que l'ordre des colonnes est identique à celui du modèle
    if EXPECTED_FEATURES:
        df = df[EXPECTED_FEATURES]
        
    return df

@app.post("/api/predict/cheat")
async def predict_cheat(request: CheatPredictionRequest):
    if pipeline is None:
        raise HTTPException(status_code=500, detail="Modèle non chargé.")
        
    try:
        df = extract_features(request.pgn, request.elo_white, request.elo_black)
        
        # Log des features pour debug (aide à comprendre les résultats "pas logiques")
        print("--- FEATURES EXTRAITES ---")
        print(df.to_dict(orient='records')[0])
        
        prediction = pipeline.predict(df)[0]
        
        confidence_score = 1.0
        if hasattr(pipeline, "predict_proba"):
            probs = pipeline.predict_proba(df)[0]
            confidence_score = float(max(probs))
            
        return {
            "success": True,
            "cheat_detected": bool(prediction == 1),
            "confidence_score": round(confidence_score, 4),
            "details": {
                "total_analyzed_moves": int(len(df.columns)), # Juste informatif
                "white_elo": request.elo_white,
                "black_elo": request.elo_black,
                "parsed_moves": int(len(request.pgn.split())) # Estimation brute
            }
        }
    except Exception as e:
        print("--- ERREUR INFÉRENCE ---")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
