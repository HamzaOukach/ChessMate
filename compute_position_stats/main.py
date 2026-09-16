"""Point d'entrée principal du programme MPI en mode push par batches"""

from mpi4py import MPI

from database import (
    get_connection,
    init_staging_table,
    clear_staging_table,
    aggregate_staging_to_stats,
    get_parties_range_to_process,
    update_processing_progress
)
from worker import (
    process_local_batch,
    prepare_batch_distribution,
    collect_results_to_rank0
)


def main():
    """
    Architecture MPI Push par batches.

    - Rank 0 : charge les parties, distribue, collecte, insère en DB
    - Autres ranks : traitent localement (parsing PGN → positions)

    Traitement par tranches de BATCH_SIZE parties pour éviter saturation mémoire.
    """
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    BATCH_SIZE = 1_000_000  # 1M parties par batch

    # === PHASE 1 : INITIALISATION (rank 0 uniquement) ===
    if rank == 0:
        conn = get_connection()
        cursor = conn.cursor()

        print("=" * 60)
        print("PHASE 1 : INITIALISATION")
        print("=" * 60)

        init_staging_table(conn, cursor)

        start_id, end_id, total_new_parties = get_parties_range_to_process(cursor)

        if total_new_parties == 0:
            print("Aucune nouvelle partie à traiter.")
            num_batches = 0
        else:
            print(f"Nouvelles parties à traiter : {start_id:,} → {end_id:,} ({total_new_parties:,} parties)")
            num_batches = (total_new_parties + BATCH_SIZE - 1) // BATCH_SIZE
            print(f"Taille batch : {BATCH_SIZE:,}")
            print(f"Nombre de batches : {num_batches}")
            print(f"Nombre de workers : {size}\n")
    else:
        conn = None
        cursor = None
        num_batches = None
        start_id = None
        end_id = None

    # Broadcast des paramètres à tous les ranks
    num_batches = comm.bcast(num_batches, root=0)

    if num_batches == 0:
        if rank == 0:
            cursor.close()
            conn.close()
        return

    start_id = comm.bcast(start_id, root=0)
    end_id = comm.bcast(end_id, root=0)

    # === PHASE 2 : TRAITEMENT PAR BATCHES ===
    for batch_num in range(num_batches):

        if rank == 0:
            print("\n" + "=" * 60)
            print(f"BATCH {batch_num + 1}/{num_batches}")
            print("=" * 60)

            # Vider staging avant chaque batch
            clear_staging_table(conn, cursor)

            # Charger et préparer la distribution
            work_batches = prepare_batch_distribution(
                cursor, size, batch_num, BATCH_SIZE, start_id
            )
        else:
            work_batches = None

        # Scatter : rank 0 envoie un lot à chaque worker
        local_batch = comm.scatter(work_batches, root=0)

        # Traitement local (tous les ranks, y compris rank 0)
        local_results = process_local_batch(local_batch, rank)

        # Gather : rank 0 récupère tous les résultats
        all_results = comm.gather(local_results, root=0)

        # Rank 0 insère les résultats en DB
        if rank == 0:
            print(f"\nBatch {batch_num + 1}: Insertion des résultats...")
            collect_results_to_rank0(conn, cursor, all_results)

            # Agrégation immédiate après chaque batch
            aggregate_staging_to_stats(conn, cursor)

        # Synchronisation entre les batches
        comm.Barrier()

    # === PHASE 3 : FINALISATION ===
    if rank == 0:
        print("\n" + "=" * 60)
        print("PHASE 3 : FINALISATION")
        print("=" * 60)

        # Sauvegarder la progression
        update_processing_progress(conn, cursor, end_id)

        # Stats finales
        cursor.execute("SELECT COUNT(*) FROM Position_Stats")
        total_positions = cursor.fetchone()[0]
        print(f"Total positions en base : {total_positions:,}")

        cursor.close()
        conn.close()

        print("\n" + "=" * 60)
        print("TRAITEMENT TERMINÉ")
        print("=" * 60)


if __name__ == "__main__":
    main()