// ─── Types ML Chess ─────────────────────────────────────────────────────────
// Générés depuis le pipeline ml_chess_profile.py
// Dataset : games_ml_ready.csv + games_ml_ready.player_profile.json

export type GameType =
  | 'Tactique'
  | 'Stratégique'
  | 'Équilibrée'
  | 'Explosive'
  | 'Défensive';

export type GameLevel =
  | 'Débutant'
  | 'Intermédiaire–'
  | 'Intermédiaire+'
  | 'Avancé'
  | 'Expert'
  | 'Maître';

export type GameRhythm =
  | 'Ultra-Rapide'
  | 'Courte'
  | 'Moyenne'
  | 'Longue'
  | 'Profonde';

export type PlayerProfileHint =
  | 'Attaquant'
  | 'Défenseur'
  | 'Technicien'
  | 'Irrégulier'
  | 'Équilibré'
  | 'Théoricien';

// Données ML d'une partie enrichie (depuis games_ml_ready.csv)
export interface GameMLData {
  id: string;
  predicted_game_type: GameType;
  predicted_level: GameLevel;
  predicted_rhythm: GameRhythm;
  confidence_score: number;
  player_profile_hint: PlayerProfileHint;
  analytic_summary: string;
  opening_family: string;
  eco_group: string;
  time_category: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Unknown';
  abs_rating_diff: number;
  is_balanced: boolean;
  avg_rating: number;
  turns: number;
  victory_status: 'resign' | 'mate' | 'outoftime' | 'draw';
  winner: 'white' | 'black' | 'draw';
}

// Profil global du joueur (généré dynamiquement par backend/Python)
export interface PlayerMLProfile {
  user_id?: string;
  source?: {
    profile_type: string;
    computation_mode: string;
    baseline_used: boolean;
    baseline_dataset: string;
  };
  sample_size?: {
    games_analyzed: number;
    minimum_recommended_games: number;
    is_small_sample: boolean;
  };
  global_profile?: {
    estimated_level: GameLevel;
    dominant_style: GameType;
    dominant_rhythm: GameRhythm;
    favorite_opening_family: string;
  };
  metrics?: {
    win_rate: number;
    draw_rate: number;
    loss_rate: number;
    avg_moves: number;
    avg_rating: number;
    resign_rate: number;
    mate_rate: number;
    timeout_rate: number;
    rated_rate: number;
  };
  comparisons_vs_global_baseline?: {
    speed_percentile: number;
    aggressiveness_percentile: number;
    resign_rate_delta: number;
    win_rate_delta: number;
    opening_diversity_percentile: number;
  };
  insights?: {
    player_tendency: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  confidence?: {
    score: number;
    reason: string;
  };
}
