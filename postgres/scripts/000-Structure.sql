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
    inscription_a TIMESTAMP NOT NULL,
    connexion_a TIMESTAMP,
    banni_a TIMESTAMP,
    id_joueur INT NOT NULL UNIQUE,
    FOREIGN KEY (id_joueur) REFERENCES Joueur(id)
    );

CREATE TYPE CATEGORIE_CADENCE AS ENUM('Bullet', 'Blitz', 'Rapide', 'Classique');

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
--     pgn_hash CHAR(64) GENERATED ALWAYS AS (encode(digest(pgn, 'sha256'), 'hex')) STORED UNIQUE,
    pgn_hash UUID,
    nb_victoires INT DEFAULT 0,
    nb_defaites INT DEFAULT 0,
    nb_nulles INT DEFAULT 0,
    probabilite_coup VARCHAR(50),
    id_suite_coups_stats_precedente INT,
    FOREIGN KEY (id_suite_coups_stats_precedente) REFERENCES Suite_Coups_Stats(id)
    );

CREATE TABLE IF NOT EXISTS Position_Stats (
    hash UUID PRIMARY KEY,
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
    round VARCHAR(20),
    broadcast_url TEXT,
    game_url TEXT,
    variant VARCHAR(50),
    id_suite_coups_stats INT,
    hash_position_stats UUID,
    id_ouverture INT,
    id_cadence INT,
    id_joueur_blanc INT NOT NULL,
    id_joueur_noir INT NOT NULL,
    id_tournoi INT,
    FOREIGN KEY (id_suite_coups_stats) REFERENCES Suite_Coups_Stats(id),
    FOREIGN KEY (hash_position_stats) REFERENCES Position_Stats(hash),
    FOREIGN KEY (id_ouverture) REFERENCES Ouverture(id),
    FOREIGN KEY (id_cadence) REFERENCES Cadence(id),
    FOREIGN KEY (id_joueur_blanc) REFERENCES Joueur(id),
    FOREIGN KEY (id_joueur_noir) REFERENCES Joueur(id),
    FOREIGN KEY (id_tournoi) REFERENCES Tournoi(id)
    );

-- ============================================================================
-- TABLES DE LIAISON
-- ============================================================================

CREATE TABLE IF NOT EXISTS participer (
    id_joueur INT,
    id_tournoi INT,
    inscription TIMESTAMP,
    PRIMARY KEY (id_joueur, id_tournoi),
    FOREIGN KEY (id_joueur) REFERENCES Joueur(id),
    FOREIGN KEY (id_tournoi) REFERENCES Tournoi(id)
    );

CREATE TABLE IF NOT EXISTS Utilisateur_Role (
    id_utilisateur INT,
    id_role INT,
    PRIMARY KEY (id_utilisateur, id_role),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id),
    FOREIGN KEY (id_role) REFERENCES Role(id)
    );

CREATE TABLE IF NOT EXISTS Utilisateur_Profil (
    id_utilisateur INT,
    id_profil INT,
    PRIMARY KEY (id_utilisateur, id_profil),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id),
    FOREIGN KEY (id_profil) REFERENCES Profil(id)
    );

CREATE TABLE IF NOT EXISTS Profil_Role (
    id_role INT,
    id_profil INT,
    PRIMARY KEY (id_role, id_profil),
    FOREIGN KEY (id_role) REFERENCES Role(id),
    FOREIGN KEY (id_profil) REFERENCES Profil(id)
    );

-- ============================================================================
-- TABLE DE GESTION DES TÂCHES MPI
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

CREATE INDEX IF NOT EXISTS idx_tache_statut_tentative
    ON TachePositionStats(statut, tentative)
    WHERE statut IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_tache_worker
    ON TachePositionStats(worker_rank, statut);

CREATE TABLE IF NOT EXISTS PositionStatsProgress (
       id INTEGER PRIMARY KEY DEFAULT 1,
       derniere_partie_id_calculee INTEGER DEFAULT 0
    );

CREATE TABLE IF NOT EXISTS Position_Stats_Stage (
    hash UUID,
    fen TEXT NOT NULL,
    nb_total BIGINT NOT NULL,
    nb_victoires_blanc BIGINT NOT NULL,
    nb_victoires_noir BIGINT NOT NULL,
    nb_nulles BIGINT NOT NULL
);
-- ============================================================================
-- MULTIPLAYER & SOCIAL
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
