# Programme de calcul des statistiques de positions

Le script `compute_position_stats.py` calcule, à partir de la table `Partie` (PGN Lichess),
des statistiques agrégées par position (FEN) dans la table `Position_Stats`.

Il fonctionne en trois modes, contrôlés par la variable d'environnement `MODE` :

- `MODE=prepare` :
    - Crée (si nécessaire) et vide la table de staging `Position_Stats_Stage`.
    - À exécuter une seule fois avant de lancer les workers.

- `MODE=worker` :
    - Traite un sous-ensemble des parties et remplit la table de staging.
    - La répartition se fait par modulo sur l'identifiant de partie :
      `WHERE id % WORKERS = WORKER_INDEX`.
    - Ce mode est utilisé par les workers lancés sur les nœuds de calcul.

- `MODE=aggregate` :
    - Agrège la table de staging dans `Position_Stats` :
        - `GROUP BY hash`
        - `ON CONFLICT (hash) DO UPDATE` pour accumuler les compteurs.
    - À exécuter une fois que tous les workers ont terminé.

Les paramètres de connexion à Postgres sont passés via :

- `DB_HOST` (défaut : `postgres`)
- `DB_PORT` (défaut : `5432`)
- `DB_NAME` (défaut : `chessmate`)
- `DB_USER` (défaut : `chessmate`)
- `DB_PASSWORD` (défaut : `chessmate`)

Exemple, à lancer sur un noeud, attention par défaut postgres c'est 100 workers max :


   `nohup mpiexec --hostfile hosts.txt -n 90 -x DISPLAY ~/lichess_compute/compute_position_stats/.venv/bin/python main.py > mpi.log 2>&1 &`

Voir si ça tourne :

    `ps aux | grep mpiexec`