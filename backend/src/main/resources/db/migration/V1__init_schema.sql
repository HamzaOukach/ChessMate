-- ============================================================================
-- TABLES DE BASE
-- ============================================================================

CREATE TABLE IF NOT EXISTS Joueur (
    id SERIAL PRIMARY KEY,
    pseudonyme VARCHAR(50) NOT NULL UNIQUE,
    elo SMALLINT,
    nb_victoires INT DEFAULT 0,
    nb_defaites INT DEFAULT 0,
    nb_nulles INT DEFAULT 0,
    equipe VARCHAR(100),
    fide_id VARCHAR(20)
    );

CREATE TABLE IF NOT EXISTS Utilisateur (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    hash VARCHAR(255) NOT NULL,
    nom VARCHAR(50),
    prenom VARCHAR(50),
    inscription_a TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    connexion_a TIMESTAMP,
    banni_a TIMESTAMP,
    id_joueur INT NOT NULL UNIQUE,
    FOREIGN KEY (id_joueur) REFERENCES Joueur(id)
    );

-- On verifie si le type existe avant
DO $$ BEGIN
    CREATE TYPE CATEGORIE_CADENCE AS ENUM('Bullet', 'Blitz', 'Rapide', 'Classique');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS Cadence (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(50) NOT NULL UNIQUE,
    temps SMALLINT,
    increment SMALLINT,
    type_partie CATEGORIE_CADENCE NOT NULL
    );

CREATE TABLE IF NOT EXISTS Role (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(50)
    );

CREATE TABLE IF NOT EXISTS Profil (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(50)
    );

-- ============================================================================
-- STATS ET ANALYSE
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS Suite_Coups_Stats (
    id SERIAL PRIMARY KEY,
    pgn TEXT NOT NULL,
    pgn_hash UUID,
    nb_victoires INT DEFAULT 0,
    nb_defaites INT DEFAULT 0,
    nb_nulles INT DEFAULT 0,
    probabilite_coup VARCHAR(50),
    id_suite_coups_stats_precedente INT,
    FOREIGN KEY (id_suite_coups_stats_precedente) REFERENCES Suite_Coups_Stats(id)
    );

CREATE TABLE IF NOT EXISTS Position_Stats (
    id SERIAL PRIMARY KEY,
    hash UUID, -- Legacy reference if needed
    fen TEXT NOT NULL,
    nb_total BIGINT NOT NULL,
    nb_victoires_blanc BIGINT NOT NULL,
    nb_victoires_noir BIGINT NOT NULL,
    nb_nulles BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- ============================================================================
-- TOURNOIS ET PARTIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS Tournoi (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(255) UNIQUE,
    code VARCHAR(10),
    site TEXT,
    broadcast_url TEXT,
    date_debut DATE,
    cree_a TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modifie_a TIMESTAMP,
    id_organisateur INT NOT NULL,
    id_cadence INT NOT NULL,
    FOREIGN KEY (id_organisateur) REFERENCES Joueur(id),
    FOREIGN KEY (id_cadence) REFERENCES Cadence(id)
    );

CREATE TABLE IF NOT EXISTS Ouverture (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    id_suite_coups_stats INT,
    FOREIGN KEY (id_suite_coups_stats) REFERENCES Suite_Coups_Stats(id)
    );

CREATE TABLE IF NOT EXISTS Partie (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    resultat SMALLINT,
    pgn TEXT,
    date_heure_utc TIMESTAMP,
    elo_blanc SMALLINT,
    elo_noir SMALLINT,
    score_blanc_diff SMALLINT,
    score_noir_diff SMALLINT,
    titre_blanc VARCHAR(5),
    titre_noir VARCHAR(5),
    type_resultat VARCHAR(50),
    round INT,
    broadcast_url TEXT,
    game_url TEXT,
    variant VARCHAR(50),
    id_suite_coups_stats INT,
    hash_position_stats INT, -- Reference to Position_Stats(id)
    id_ouverture INT,
    id_cadence INT,
    id_joueur_blanc INT NOT NULL,
    id_joueur_noir INT NOT NULL,
    id_tournoi INT,
    FOREIGN KEY (id_suite_coups_stats) REFERENCES Suite_Coups_Stats(id),
    FOREIGN KEY (hash_position_stats) REFERENCES Position_Stats(id),
    FOREIGN KEY (id_ouverture) REFERENCES Ouverture(id),
    FOREIGN KEY (id_cadence) REFERENCES Cadence(id),
    FOREIGN KEY (id_joueur_blanc) REFERENCES Joueur(id),
    FOREIGN KEY (id_joueur_noir) REFERENCES Joueur(id),
    FOREIGN KEY (id_tournoi) REFERENCES Tournoi(id)
    );

-- ============================================================================
-- MULTIPLAYER & SOCIAL (LEGACY / DEV)
-- ============================================================================

CREATE TABLE IF NOT EXISTS Online_Partie (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL UNIQUE,
    id_joueur_blanc INT NOT NULL,
    id_joueur_noir INT NOT NULL,
    resultat SMALLINT,
    result_type VARCHAR(50),
    pgn TEXT,
    time_control VARCHAR(20),
    total_moves INT,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_joueur_blanc) REFERENCES Joueur(id),
    FOREIGN KEY (id_joueur_noir) REFERENCES Joueur(id)
);

CREATE TABLE IF NOT EXISTS Friendship (
    id SERIAL PRIMARY KEY,
    id_joueur_from INT NOT NULL,
    id_joueur_to INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_joueur_from) REFERENCES Joueur(id),
    FOREIGN KEY (id_joueur_to) REFERENCES Joueur(id),
    UNIQUE (id_joueur_from, id_joueur_to),
    CHECK (id_joueur_from != id_joueur_to)
);

CREATE TABLE IF NOT EXISTS Chat_Message (
    id SERIAL PRIMARY KEY,
    id_sender INT NOT NULL,
    id_receiver INT NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    game_id VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_sender) REFERENCES Joueur(id),
    FOREIGN KEY (id_receiver) REFERENCES Joueur(id)
);

-- ============================================================================
-- NEW FRIENDS SYSTEM (FRONTEND BRANCH)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE friendship_status AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED', 'REFUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS amis (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    status friendship_status NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Utilisateur(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES Utilisateur(id) ON DELETE CASCADE,
    CONSTRAINT unique_friendship
        UNIQUE (user_id, friend_id),
    CONSTRAINT chk_no_self_friend
        CHECK (user_id <> friend_id)
);

-- ============================================================================
-- ETL AND TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS TachePositionStats (
    id SERIAL PRIMARY KEY,
    debut_partie_id INTEGER NOT NULL,
    fin_partie_id INTEGER NOT NULL,
    statut VARCHAR(20) DEFAULT 'pending' CHECK (statut IN ('pending', 'running', 'completed', 'failed')),
    worker_rank INTEGER,
    debut_a TIMESTAMP,
    fin_a TIMESTAMP,
    tentative INTEGER DEFAULT 0,
    message_erreur TEXT,
    cree_a TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS etl_log (
    id SERIAL PRIMARY KEY,
    date_debut TIMESTAMP,
    date_fin TIMESTAMP,
    duree_ms BIGINT,
    nb_parties BIGINT,
    nb_ignores BIGINT
);