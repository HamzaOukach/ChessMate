"""Gestion des tâches (jobs) MPI"""
import time

from config import MAX_RETRIES, CHUNK_SIZE, TABLE_TACHE, TABLE_PARTIE


def get_last_partie_id_in_tasks(cursor):
    """Récupère le dernier ID de partie déjà dans les tâches"""
    cursor.execute(f"SELECT MAX(fin_partie_id) FROM {TABLE_TACHE}")
    return cursor.fetchone()[0]


def create_new_tasks(conn, cursor, last_id):
    """
    Crée de nouvelles tâches pour les parties non encore traitées.

    :param conn:
    :param cursor: Curseur DB
    :param last_id: Dernier ID déjà traité (ou None)
    """
    if last_id is None:
        cursor.execute(f"SELECT MIN(id), MAX(id) FROM {TABLE_PARTIE}")
    else:
        cursor.execute(f"""
            SELECT MIN(id), MAX(id)
            FROM {TABLE_PARTIE}
            WHERE id > %s
        """, (last_id,))

    min_id, max_id = cursor.fetchone()

    if min_id is None:
        print("Aucune nouvelle partie à traiter")
        return

    jobs = []
    for start in range(min_id, max_id + 1, CHUNK_SIZE):
        end = min(start + CHUNK_SIZE - 1, max_id)
        jobs.append((start, end, 'pending'))

    cursor.executemany(f"""
        INSERT INTO {TABLE_TACHE} (debut_partie_id, fin_partie_id, statut)
        VALUES (%s, %s, %s)
    """, jobs)

    conn.commit()

    print(f"{len(jobs)} tâches créées")


def create_all_tasks(conn, cursor):
    """Point d'entrée pour créer les tâches (rank 0)"""
    last_id = get_last_partie_id_in_tasks(cursor)
    create_new_tasks(conn, cursor, last_id)


def claim_next_task(conn, cursor, rank):
    """
    Récupère atomiquement la prochaine tâche disponible.

    :param conn:
    :param cursor:
    :param rank: Rank du worker
    :return: (task_id, start_id, end_id) ou None
    """

    cursor.execute(f"""
        SELECT id, debut_partie_id, fin_partie_id
        FROM {TABLE_TACHE}
        WHERE statut = 'pending'
           OR (statut = 'failed' AND tentative < %s)
        ORDER BY tentative ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    """, (MAX_RETRIES,))

    result = cursor.fetchone()
    if result is None:
        return None

    task_id, start, end = result

    cursor.execute(f"""
        UPDATE {TABLE_TACHE}
        SET statut = 'running',
            worker_rank = %s,
            debut_a = NOW(),
            tentative = tentative + 1
        WHERE id = %s
    """, (rank, task_id))

    conn.commit()

    return task_id, start, end


def mark_task_completed(conn, cursor, task_id, rank):
    """Marque une tâche comme terminée"""

    cursor.execute(f"""
        UPDATE {TABLE_TACHE}
        SET statut = 'completed',
            fin_a = NOW()
        WHERE id = %s AND worker_rank = %s
    """, (task_id, rank))

    conn.commit()


def mark_task_failed(conn, cursor, task_id, error_msg, rank):
    """Marque une tâche comme échouée"""

    cursor.execute(f"""
        UPDATE {TABLE_TACHE}
        SET statut = 'failed',
            message_erreur = %s
        WHERE id = %s AND worker_rank = %s
    """, (error_msg[:500], task_id, rank))

    conn.commit()


def mark_task_timeout(conn, cursor):
    cursor.execute("""
                   UPDATE TachePositionStats
                   SET statut         = 'failed',
                       message_erreur = 'Timeout'
                   WHERE statut = 'running'
                     AND debut_a < NOW() - INTERVAL '10 minutes'
                     AND tentative
                       < %s
                   """, (MAX_RETRIES,))

    timeout_count = cursor.rowcount
    if timeout_count > 0:
        print(f"{timeout_count} tâches en timeout.")

    conn.commit()


def get_count_tasks_not_done(cursor):
    cursor.execute("""
                   SELECT COUNT(*)
                   FROM TachePositionStats
                   WHERE statut IN ('pending', 'running')
                      OR (statut = 'failed' AND tentative < %s)
                   """, (MAX_RETRIES,))

    return cursor.fetchone()[0]


def all_tasks_done(conn, cursor):
    """Version avec auto-récupération des tâches bloquées"""
    mark_task_timeout(conn, cursor)
    count = get_count_tasks_not_done(cursor)
    return count == 0


def wait_for_tasks_creation(cursor, rank):
    """
    Workers attendent que les tâches soient créées.

    :param cursor:
    :param rank: Rank du worker
    """
    print(f"Worker {rank}: Attente création des tâches...")

    while True:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {TABLE_TACHE}")
            count = cursor.fetchone()[0]
            if count > 0:
                print(f"Worker {rank}: {count} tâches détectées, démarrage !")
                return
        except Exception as e:
            print(f"Worker {rank}: Erreur attente tâches: {e}")

        time.sleep(2)


def wait_for_all_workers_done(conn, cursor, rank):
    """
    Rank 0 attend que tous les workers terminent.

    :param conn:
    :param cursor:
    :param rank: Rank (doit être 0)
    """
    print(f"\nRank {rank}: Attente fin des workers...")

    if all_tasks_done(conn, cursor):
        cursor.execute(f"""
            SELECT statut, COUNT(*) 
            FROM {TABLE_TACHE}
            GROUP BY statut
        """)
        stats = dict(cursor.fetchall())
        print(f"Progression: {stats}")

        time.sleep(10)

    print(f"Tous les workers ont terminé")


def get_parties_from_task(cursor, start_id, end_id, rank):
    """
    Récupère les parties d'une tâche.

    :param cursor:
    :param start_id: ID début
    :param end_id: ID fin
    :param rank: Rank (pour logging)
    :return: Liste de tuples (id, pgn, resultat)
    """

    cursor.execute(f"""
        SELECT id, pgn, resultat
        FROM {TABLE_PARTIE}
        WHERE id BETWEEN %s AND %s
          AND pgn IS NOT NULL
        ORDER BY id
    """, (start_id, end_id))

    parties = cursor.fetchall()
    print(f"Worker {rank}: {len(parties)} parties récupérées [{start_id}-{end_id}]")
    return parties


def print_final_report(cursor):
    """Affiche le rapport final des tâches"""

    cursor.execute(f"""
        SELECT statut, COUNT(*) as count
        FROM {TABLE_TACHE}
        GROUP BY statut
    """)

    stats = cursor.fetchall()

    print("\n" + "=" * 60)
    print("RAPPORT FINAL")
    print("=" * 60)
    for statut, count in stats:
        print(f"{statut:12s}: {count:6d}")
    print("=" * 60)
