import datetime
import random
import time
from math import ceil

import psycopg2
from psycopg2.extras import execute_values

# =========================
# CONFIGURATION
# =========================
DB_HOST = "postgres"
DB_PORT = 5432
DB_NAME = "chessmate"
DB_USER = "chessmate"
DB_PASSWORD = "ae24lc98"

TABLE_NAME = "Position_Stats"

TOTAL_ROWS = 100_000_000  # nombre total d'insertions à faire
BATCH_SIZE = 100_000  # taille d'un batch
LOG_EVERY_BATCH = 1  # log chaque batch (1), ou par ex tous les 10 batches


# =========================
# GÉNÉRATION DES DONNÉES
# =========================

def generate_fen(index: int) -> str:
    """
    Génère une FEN "représentative" mais fake.
    Ici on fait un truc simple et déterministe pour éviter
    d'avoir à implémenter un vrai générateur de positions valides.
    """
    # On encode juste l'index dans une pseudo-FEN
    # pour avoir des longueurs comparables.
    # Ça ne changera rien au coût d'insertion.
    return f"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 {index % 100}"


def generate_stats() -> tuple[int, int, int, int]:
    """
    Génère des stats cohérentes (total = wins blancs + wins noirs + draws).
    On garde des valeurs modestes, la volumétrie n'a aucun impact sur le perf DB.
    """
    nb_total = random.randint(1, 1000)
    nb_white_wins = random.randint(0, nb_total)
    nb_black_wins = random.randint(0, nb_total - nb_white_wins)
    nb_draws = nb_total - nb_white_wins - nb_black_wins
    return nb_total, nb_white_wins, nb_black_wins, nb_draws


def generate_batch(start_hash: int, batch_size: int) -> list[tuple]:
    """
    Génère un batch de lignes à insérer.
    - hash : on fait juste un BIGINT unique par ligne (start_hash + i)
    - fen : string représentative
    - stats : nb_total, nb_white_wins, nb_black_wins, nb_draws
    - updated_at : un timestamp commun pour le batch (comme un "now()" partiel)
    """
    rows = []
    now = datetime.datetime.utcnow()
    for i in range(batch_size):
        h = random.getrandbits(63)
        fen = generate_fen(h)
        nb_total, nb_white_wins, nb_black_wins, nb_draws = generate_stats()
        rows.append((h, fen, nb_total, nb_white_wins, nb_black_wins, nb_draws, now))
    return rows


# =========================
# BENCHMARK INSERTION
# =========================

def benchmark_inserts():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    conn.autocommit = False  # on contrôle les commits par batch
    cur = conn.cursor()

    total_batches = ceil(TOTAL_ROWS / BATCH_SIZE)
    print(f"Début du benchmark : {TOTAL_ROWS:,} lignes, {BATCH_SIZE:,} par batch "
          f"→ {total_batches} batches")
    global_start = time.time()

    # On choisit un point de départ pour les hash (évite les collisions si la table n'est pas vide)
    # Ici on suppose que la table est vide ; sinon récupère le max(hash) avant de commencer.
    next_hash = 1

    for batch_index in range(total_batches):
        remaining = TOTAL_ROWS - batch_index * BATCH_SIZE
        current_batch_size = min(BATCH_SIZE, remaining)

        rows = generate_batch(next_hash, current_batch_size)
        next_hash += current_batch_size

        # INSERT via execute_values pour limiter le nombre de round-trips
        insert_sql = f"""
            INSERT INTO {TABLE_NAME} 
                (hash, fen, nb_total, nb_victoires_blanc, nb_victoires_noir, nb_nulles, updated_at)
            VALUES %s
        """

        batch_start_time = time.time()

        execute_values(cur, insert_sql, rows)

        batch_duration = time.time() - batch_start_time

        conn.commit()

        rows_per_sec = current_batch_size / batch_duration if batch_duration > 0 else float('inf')

        if (batch_index + 1) % LOG_EVERY_BATCH == 0:
            print(
                f"Batch {batch_index + 1}/{total_batches} : "
                f"{current_batch_size:,} lignes en {batch_duration:.3f}s "
                f"({rows_per_sec:,.0f} rows/s)"
            )

    total_duration = time.time() - global_start
    overall_rps = TOTAL_ROWS / total_duration if total_duration > 0 else float('inf')
    print("\n=== Résumé ===")
    print(f"Total inséré : {TOTAL_ROWS:,} lignes")
    print(f"Durée totale : {total_duration:.3f} s")
    print(f"Débit moyen : {overall_rps:,.0f} rows/s")

    cur.close()
    conn.close()


if __name__ == "__main__":
    benchmark_inserts()
