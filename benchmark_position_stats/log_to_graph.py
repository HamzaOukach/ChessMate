import re
import matplotlib.pyplot as plt

LOG_FILE = "benchmark_position_stats.log"
ROWS_PER_BATCH = 100_000  # adapte si besoin

# Regex : récupère le numéro du batch et les rows/s
pattern = re.compile(
    r"Batch\s+(\d+)/\d+\s*:.*\(([\d,]+)\s+rows/s\)"
)

batch_nums = []
rows_per_sec = []

with open(LOG_FILE, "r", encoding="utf-8") as f:
    for line in f:
        m = pattern.search(line)
        if not m:
            continue
        batch = int(m.group(1))
        rps = int(m.group(2).replace(",", ""))

        batch_nums.append(batch)
        rows_per_sec.append(rps)

        # debug éventuel
        # print(batch, rps)

if not batch_nums:
    raise RuntimeError("Aucun batch trouvé dans le fichier log.")

# Lignes insérées cumulées
rows_inserted = [b * ROWS_PER_BATCH for b in batch_nums]

# Optionnel : export CSV pour analyse
with open("benchmark_position_stats_parsed.csv", "w", encoding="utf-8") as f:
    f.write("batch,rows_inserted,rows_per_sec\n")
    for b, ri, rps in zip(batch_nums, rows_inserted, rows_per_sec):
        f.write(f"{b},{ri},{rps}\n")

plt.figure(figsize=(10, 6))
plt.plot(batch_nums, rows_per_sec, marker="o")

plt.xlabel("Batch n°")
plt.ylabel("Rows/s")
plt.title("Débit d'insertion par batch")
plt.grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig("benchmark_position_stats_rps_vs_batch.png")
plt.show()