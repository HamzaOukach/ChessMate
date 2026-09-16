"""Configuration globale du projet"""

import os
from pathlib import Path


# =========================
# DATABASE
# =========================

DB_HOST = os.getenv("DB_HOST", "172.31.60.32")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "chessmate")
DB_USER = os.getenv("DB_USER", "chessmate")
DB_PASSWORD = os.getenv("DB_PASSWORD", "chessmate")


# =========================
# TABLES
# =========================

TABLE_PARTIE = "Partie"
TABLE_POSITION_STATS = "Position_Stats"
TABLE_POSITION_STAGE = "Position_Stats_Stage"
TABLE_TACHE = "TachePositionStats"


# =========================
# PERFORMANCE
# =========================

CHUNK_SIZE = 1000                    # Taille des chunks de parties
POSITION_FLUSH_THRESHOLD = 100_000   # Flush tous les 100k positions
MAX_RETRIES = 3                      # Nombre max de tentatives par job
TIMEOUT_MINUTES = 10                 # Timeout pour jobs bloqués


# =========================
# CHARGEMENT .ENV
# =========================

def load_simple_env(env_filename: str = ".env"):
    """Charge un fichier .env simple dans os.environ"""
    env_path = Path(__file__).parent / env_filename
    if not env_path.exists():
        return

    with env_path.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


# Charger au moment de l'import
load_simple_env()