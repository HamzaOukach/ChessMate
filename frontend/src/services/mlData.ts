/**
 * mlData.ts
 * Service de chargement des données ML depuis les fichiers statiques.
 *
 * Stratégie : Les fichiers games_ml_ready.csv et games_ml_ready.player_profile.json
 * sont placés dans /public/ml/ pour être servis statiquement par Vite.
 *
 * Pour mettre à jour les données : relancer ml_chess_profile.py et copier
 * les fichiers dans frontend/public/ml/
 *
 * Optimisations v2 :
 * - Double index : par lichessId (colonne "id") ET par titre normalisé
 * - Chargement avec timeout pour éviter le blocage sur fichier 7MB
 * - Cache opaque avec flag "loaded" pour éviter les fetch multiples
 */

import type { GameMLData, PlayerMLProfile } from '../types/gameML';

const ML_BASE = '/ml';

// ──────────────────────────────────────────────────────────────────────────────
// Chargement du profil joueur global (JSON)
// ──────────────────────────────────────────────────────────────────────────────

let _profileCache: PlayerMLProfile | null = null;

export async function loadPlayerProfile(): Promise<PlayerMLProfile | null> {
  if (_profileCache) return _profileCache;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${ML_BASE}/games_ml_ready.player_profile.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _profileCache = data as PlayerMLProfile;
    return _profileCache;
  } catch (err) {
    console.warn('[mlData] Profil joueur non disponible :', err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chargement et parsing du CSV ML (games_ml_ready.csv)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Double index :
 * - mlMapById    → clé = lichessId (colonne "id" du CSV)
 * - mlMapByTitle → clé = titre normalisé (white_player + " vs " + black_player)
 *
 * Le double index permet de matcher les parties backend même quand lichessId
 * n'est pas transmis (cas PartiesJouees avec IDs numériques).
 */
let _csvLoaded = false;
let _mlMapById = new Map<string, GameMLData>();
let _mlMapByTitle = new Map<string, GameMLData>();

/**
 * Parse un CSV brut (ligne par ligne) en tableau d'objets.
 * Parser minimal sans dépendance externe.
 */
function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

function rowToGameML(row: Record<string, string>): GameMLData {
  return {
    id: row['id'] ?? '',
    predicted_game_type: (row['predicted_game_type'] as GameMLData['predicted_game_type']) ?? 'Équilibrée',
    predicted_level: (row['predicted_level'] as GameMLData['predicted_level']) ?? 'Intermédiaire+',
    predicted_rhythm: (row['predicted_rhythm'] as GameMLData['predicted_rhythm']) ?? 'Moyenne',
    confidence_score: parseFloat(row['confidence_score']) || 0,
    player_profile_hint: (row['player_profile_hint'] as GameMLData['player_profile_hint']) ?? 'Équilibré',
    analytic_summary: row['analytic_summary'] ?? '',
    opening_family: row['opening_family'] ?? '',
    eco_group: row['eco_group'] ?? '',
    time_category: (row['time_category'] as GameMLData['time_category']) ?? 'Unknown',
    abs_rating_diff: parseInt(row['abs_rating_diff']) || 0,
    is_balanced: row['is_balanced'] === 'True',
    avg_rating: parseFloat(row['avg_rating']) || 0,
    turns: parseInt(row['turns']) || 0,
    victory_status: (row['victory_status'] as GameMLData['victory_status']) ?? 'resign',
    winner: (row['winner'] as GameMLData['winner']) ?? 'draw',
  };
}

/**
 * Normalise un titre/nom de joueur pour le matching approximatif.
 * Minuscule, sans accents, alphanumérique uniquement.
 */
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Construit une clé de titre normalisée depuis les colonnes du CSV.
 * Format: "{white_username}vs{black_username}"
 */
function buildTitleKey(row: Record<string, string>): string {
  const white = normalizeForMatch(row['white_username'] ?? row['white_id'] ?? '');
  const black = normalizeForMatch(row['black_username'] ?? row['black_id'] ?? '');
  if (!white && !black) return '';
  return `${white}vs${black}`;
}

async function _loadCsv(): Promise<void> {
  if (_csvLoaded) return;
  _csvLoaded = true; // prévenir les doubles fetch même si le premier échoue

  try {
    const controller = new AbortController();
    // Timeout 30s pour le fichier de 7.6 MB
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${ML_BASE}/games_ml_ready.csv`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const rows = parseCsv(raw);

    for (const row of rows) {
      const entry = rowToGameML(row);

      // Index 1 : par lichessId
      if (entry.id) {
        _mlMapById.set(entry.id, entry);
      }

      // Index 2 : par titre normalisé {white}vs{black}
      const titleKey = buildTitleKey(row);
      if (titleKey) {
        _mlMapByTitle.set(titleKey, entry);
      }
    }

    console.info(`[mlData] CSV chargé : ${_mlMapById.size} parties indexées.`);
  } catch (err) {
    console.warn('[mlData] CSV ML non disponible :', err);
    // Reset pour permettre retry
    _csvLoaded = false;
  }
}

export async function loadGameMLMap(): Promise<Map<string, GameMLData>> {
  await _loadCsv();
  return _mlMapById;
}

/**
 * Récupère les données ML d'une partie par son ID Lichess.
 * Retourne null si le CSV n'est pas chargé ou si l'ID est absent.
 */
export async function getGameML(lichessId: string): Promise<GameMLData | null> {
  await _loadCsv();
  return _mlMapById.get(lichessId) ?? null;
}

/**
 * Matching secondaire : cherche une entrée ML par les pseudos des joueurs.
 * Utilisé quand lichessId n'est pas disponible (parties locales backend).
 *
 * @param whitePseudo - Pseudo du joueur blanc
 * @param blackPseudo - Pseudo du joueur noir
 */
export async function getGameMLByPlayers(
  whitePseudo: string,
  blackPseudo: string,
): Promise<GameMLData | null> {
  await _loadCsv();

  const key = `${normalizeForMatch(whitePseudo)}vs${normalizeForMatch(blackPseudo)}`;
  return _mlMapByTitle.get(key) ?? null;
}
