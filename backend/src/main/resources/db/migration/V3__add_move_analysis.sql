-- Table pour stocker l'analyse de chaque coup
CREATE TABLE move_analysis (
    id SERIAL PRIMARY KEY,
    partie_id BIGINT NOT NULL,
    joueur_id BIGINT NOT NULL,
    move_index INT,            -- Numéro du coup dans la partie
    move_uci VARCHAR(10),      -- Ex: "e2e4"
    is_white BOOLEAN,
    eval_before INT,           -- Score Stockfish avant le coup
    eval_after INT,            -- Score Stockfish après le coup
    best_engine_move VARCHAR(10), -- Ce que Stockfish voulait
    is_engine_match BOOLEAN,   -- Est-ce que move_uci == best_engine_move ?
    cpl INT,                   -- Centipawn Loss (eval_before - eval_after)
    accuracy_score DOUBLE PRECISION, -- Précision sur ce coup (0-100)
    phase VARCHAR(15)          -- 'OPENING', 'MIDGAME', 'ENDGAME'
);

-- Index pour la rapidité des stats
CREATE INDEX idx_player_move ON move_analysis(joueur_id, move_uci);