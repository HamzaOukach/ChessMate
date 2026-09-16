"""Logique de traitement des workers MPI"""

from pgn_parser import get_positions_from_parties


def process_local_batch(batch, rank):
    """
    Traite un lot de parties localement sans accès postgres.
    """
    if not batch:
        print(f"Rank {rank}: Aucune partie à traiter")
        return []

    total_parties = len(batch)
    print(f"Rank {rank}: Début traitement de {total_parties} parties")

    all_positions = get_positions_from_parties(batch)

    print(f"Rank {rank}: Traitement terminé - {len(all_positions)} positions générées")

    return all_positions


def prepare_batch_distribution(cursor, size, batch_num, batch_size, start_id):
    """
    Charge un batch de parties depuis postgres et prépare la distribution entre les workers.
    """
    batch_start_id = start_id + (batch_num * batch_size)
    batch_end_id = batch_start_id + batch_size - 1

    print(f"Chargement des parties {batch_start_id:,} → {batch_end_id:,}...")

    cursor.execute("""
                   SELECT id, pgn, resultat
                   FROM Partie
                   WHERE id >= %s AND id <= %s
                     AND pgn IS NOT NULL
                   ORDER BY id
                   """, (batch_start_id, batch_end_id))

    parties = cursor.fetchall()
    total_parties = len(parties)

    print(f"  {total_parties:,} parties chargées en mémoire")

    if total_parties == 0:
        return [[] for _ in range(size)]

    # Distribution équitable entre les workers
    parties_per_rank = total_parties // size
    reste = total_parties % size

    work_batches = []
    start_idx = 0

    for rank in range(size):
        # Les premiers 'reste' ranks reçoivent une partie supplémentaire
        rank_batch_size = parties_per_rank + (1 if rank < reste else 0)
        end_idx = start_idx + rank_batch_size

        rank_parties = parties[start_idx:end_idx]
        work_batches.append(rank_parties)

        if rank_parties:
            print(f"  Rank {rank}: {len(rank_parties):,} parties")

        start_idx = end_idx

    return work_batches


def collect_results_to_rank0(conn, cursor, all_results):
    """
    Collecter et insérer tous les résultats des workers dans la table staging.
    Appelé uniquement par rank 0 après le gather().
    """
    print("Collecte des résultats de tous les workers...")

    total_positions = 0

    for rank_idx, rank_results in enumerate(all_results):
        if not rank_results:
            continue

        num_positions = len(rank_results)
        total_positions += num_positions

        print(f"  Rank {rank_idx}: {num_positions:,} positions")

    all_positions = []
    for rank_results in all_results:
        if rank_results:
            all_positions.extend(rank_results)

    if all_positions:
        batch_insert_positions(conn, cursor, all_positions)

    print(f"Total : {total_positions:,} positions insérées dans staging")


def batch_insert_positions(conn, cursor, positions):
    """
    Insert un lot de positions dans staging via COPY.
    positions: Liste de tuples (hash, fen, nb_total, w, b, d)
    """
    if not positions:
        return

    with cursor.copy(
            "COPY Position_Stats_Stage (hash, fen, nb_total, nb_victoires_blanc, nb_victoires_noir, nb_nulles) FROM STDIN"
    ) as copy:
        for h, fen, total, w, b, d in positions:
            copy.write_row((h, fen, total, w, b, d))

    conn.commit()