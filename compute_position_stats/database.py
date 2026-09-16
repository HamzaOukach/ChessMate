"""Opérations base de données"""

import psycopg

from config import (
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
    TABLE_POSITION_STAGE, TABLE_POSITION_STATS
)


def get_connection():
    """Crée une connexion PostgreSQL"""
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def init_staging_table(conn, cursor):
    """
    Initialise la table de progression (une seule fois).
    """
    cursor.execute("""
                   INSERT INTO PositionStatsProgress (id, derniere_partie_id_calculee)
                   VALUES (1, 0)
                       ON CONFLICT (id) DO NOTHING
                   """)
    conn.commit()
    print("Table de progression initialisée")


def clear_staging_table(conn, cursor):
    """
    Vide la table staging avant un nouveau batch.
    """
    cursor.execute(f"TRUNCATE TABLE {TABLE_POSITION_STAGE}")
    conn.commit()
    print("Table staging vidée")


def aggregate_staging_to_stats(conn, cursor):
    """
    Agrège staging vers Position_Stats (rank 0 seulement).
    Utilise UPSERT pour incrémenter les compteurs existants.
    """
    print("Agrégation staging → Position_Stats...")

    cursor.execute(f"""
        INSERT INTO {TABLE_POSITION_STATS} AS ps
            (hash, fen, nb_total, nb_victoires_blanc, nb_victoires_noir, nb_nulles, updated_at)
        SELECT
            hash,
            MIN(fen) AS fen,
            SUM(nb_total),
            SUM(nb_victoires_blanc),
            SUM(nb_victoires_noir),
            SUM(nb_nulles),
            NOW()
        FROM {TABLE_POSITION_STAGE}
        GROUP BY hash
        ON CONFLICT (hash) DO UPDATE
        SET nb_total = ps.nb_total + EXCLUDED.nb_total,
            nb_victoires_blanc = ps.nb_victoires_blanc + EXCLUDED.nb_victoires_blanc,
            nb_victoires_noir = ps.nb_victoires_noir + EXCLUDED.nb_victoires_noir,
            nb_nulles = ps.nb_nulles + EXCLUDED.nb_nulles,
            updated_at = NOW()
    """)

    rows_affected = cursor.rowcount
    conn.commit()
    print(f"Agrégation terminée : {rows_affected:,} positions mises à jour")


def get_parties_range_to_process(cursor):
    """
    Détermine la plage de parties à traiter.

    Returns:
        tuple: (start_id, end_id, total_new_parties)
    """
    # Récupérer la dernière partie traitée
    cursor.execute("""
                   SELECT derniere_partie_id_calculee
                   FROM PositionStatsProgress
                   WHERE id = 1
                   """)
    result = cursor.fetchone()
    last_processed = result[0] if result else 0

    # Récupérer l'ID max actuel
    cursor.execute("SELECT COALESCE(MAX(id), 0) FROM Partie")
    (max_id,) = cursor.fetchone()

    start_id = last_processed + 1
    end_id = max_id
    total_new = max(0, end_id - start_id + 1)

    return start_id, end_id, total_new


def update_processing_progress(conn, cursor, last_id_processed):
    """
    Met à jour le pointeur de dernière partie calculée.
    """
    cursor.execute("""
                   UPDATE PositionStatsProgress
                   SET derniere_partie_id_calculee = %s
                   WHERE id = 1
                   """, (last_id_processed,))
    conn.commit()
    print(f"Progression sauvegardée : dernière partie = {last_id_processed:,}")