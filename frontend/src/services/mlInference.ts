/**
 * mlInference.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Moteur d'inférence ML côté client.
 *
 * Reproduit exactement les règles du pipeline Python (ml_chess_profile.py)
 * pour calculer predicted_level, predicted_game_type, predicted_rhythm,
 * confidence_score, player_profile_hint et analytic_summary à partir
 * des champs disponibles dans chaque Partie du backend.
 *
 * Utilisé comme FALLBACK quand le CSV games_ml_ready.csv ne contient pas
 * la partie (IDs numériques backend ≠ IDs Lichess du CSV).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  GameMLData,
  GameLevel,
  GameRhythm,
  GameType,
  PlayerProfileHint,
} from '../types/gameML';

// ─── Types d'entrée ──────────────────────────────────────────────────────────

/**
 * Champs bruts disponibles depuis le backend (Partie + PartieJouee).
 * Tous les champs sont optionnels — l'inférence se dégrade gracieusement.
 */
export interface RawPartieFields {
  // Identifiant local (numérique)
  id: number;

  // Résultat : "Victoire blanc" | "Victoire noir" | "Nulle" | "Abandon" …
  typeResultat?: string;

  // Détail du résultat si disponible (resign, mate, outoftime, draw)
  victoryStatus?: string;

  // Ouverture
  openingName?: string;
  openingEco?: string;

  // ELO
  eloBlanc?: number;
  eloNoir?: number;

  // Coups (nombreCoups depuis PartieJouee, ou turns depuis CSV)
  nombreCoups?: number;

  // Cadence (ex: "10+0", "15+15", "Blitz", "Rapid" …)
  cadence?: string;

  // Variante
  variant?: string;
}

// ─── Règles ML : Niveau ──────────────────────────────────────────────────────

/**
 * Attribue un niveau selon l'ELO moyen.
 * Seuils identiques au pipeline Python.
 */
function inferLevel(eloBlanc?: number, eloNoir?: number): GameLevel {
  const b = eloBlanc ?? 0;
  const n = eloNoir ?? 0;
  const avg = b > 0 && n > 0 ? (b + n) / 2 : Math.max(b, n);

  if (avg <= 0)      return 'Intermédiaire+'; // inconnu → valeur centrale
  if (avg < 1300)    return 'Débutant';
  if (avg < 1500)    return 'Intermédiaire–';
  if (avg < 1700)    return 'Intermédiaire+';
  if (avg < 1900)    return 'Avancé';
  if (avg < 2100)    return 'Expert';
  return 'Maître';
}

// ─── Règles ML : Type de partie ──────────────────────────────────────────────

/**
 * Détermine le type de partie selon règles métier.
 * Reprend la logique du clustering K-Means sous forme de règles explicites
 * (defensible en soutenance sans dépendance au modèle entraîné).
 */
function inferGameType(
  typeResultat?: string,
  victoryStatus?: string,
  nombreCoups?: number,
  nombreCoups2?: number,  // alias
  openingName?: string,
): GameType {
  const coups = nombreCoups ?? nombreCoups2 ?? 0;
  const result = (typeResultat ?? '').toLowerCase();
  const status = (victoryStatus ?? '').toLowerCase();
  const opening = (openingName ?? '').toLowerCase();

  // Nulle → Défensive
  if (result.includes('nul') || result.includes('draw') || status === 'draw') {
    return 'Défensive';
  }

  // Mat : tactique par excellence
  if (status === 'mate' || result.includes('mat')) {
    return 'Tactique';
  }

  // Abandon très rapide (<25 coups) : partie explosive
  if ((status === 'resign' || result.includes('abandon')) && coups > 0 && coups < 25) {
    return 'Explosive';
  }

  // Partie longue (>80 coups) : stratégique
  if (coups > 80) {
    return 'Stratégique';
  }

  // Ouverture fermée → tendance stratégique
  const closedOpenings = ['queen', "king's indian", 'nimzo', 'catalan', 'english', 'réti', 'bird'];
  if (closedOpenings.some(o => opening.includes(o))) {
    return 'Stratégique';
  }

  // Ouverture ouverte ou semi-ouverte → tendance tactique
  const openOpenings = ['sicilian', 'french', 'caro', 'scandinavian', 'alekhine', 'petroff', 'king'];
  if (openOpenings.some(o => opening.includes(o))) {
    if (coups < 40) return 'Explosive';
    return 'Tactique';
  }

  // Abandon classique : équilibrée
  if (status === 'resign' || result.includes('abandon')) {
    return 'Équilibrée';
  }

  return 'Équilibrée';
}

// ─── Règles ML : Rythme ──────────────────────────────────────────────────────

/**
 * Déduit le rythme depuis le nombre de coups et la cadence.
 */
function inferRhythm(nombreCoups?: number, cadence?: string): GameRhythm {
  const coups = nombreCoups ?? 0;
  const cad = (cadence ?? '').toLowerCase();

  // Bullet / ultra-rapide
  if (cad.includes('bullet') || cad.startsWith('1+') || cad.startsWith('2+')) {
    return 'Ultra-Rapide';
  }

  // Partie très courte
  if (coups > 0 && coups < 30) {
    if (cad.includes('blitz') || cad.startsWith('3+') || cad.startsWith('5+')) {
      return 'Ultra-Rapide';
    }
    return 'Courte';
  }

  // Classical longue
  if (coups > 80) {
    if (cad.includes('classical') || cad.includes('classic') || cad.startsWith('30+') || cad.startsWith('25+') || cad.startsWith('20+')) {
      return 'Profonde';
    }
    return 'Longue';
  }

  // Moyenne
  if (coups >= 30 && coups <= 80) return 'Moyenne';

  // Fallback sur la cadence seule
  if (cad.includes('classical') || cad.startsWith('30')) return 'Profonde';
  if (cad.includes('rapid'))     return 'Longue';
  if (cad.includes('blitz'))     return 'Courte';

  return 'Moyenne';
}

// ─── Règles ML : Confiance ────────────────────────────────────────────────────

/**
 * Score de confiance heuristique.
 * Plus on a d'informations disponibles, plus on est confiant.
 */
function inferConfidence(raw: RawPartieFields): number {
  let score = 0.35; // base pour une inférence purement réglementaire

  // ELO connus → +0.15
  if ((raw.eloBlanc ?? 0) > 0 && (raw.eloNoir ?? 0) > 0) score += 0.15;

  // Nombre de coups connu → +0.15
  if ((raw.nombreCoups ?? 0) > 5) score += 0.15;

  // Ouverture connue → +0.10
  if (raw.openingName && raw.openingName.length > 3) score += 0.10;

  // VictoryStatus précis → +0.10
  if (raw.victoryStatus && ['resign', 'mate', 'outoftime', 'draw'].includes(raw.victoryStatus)) {
    score += 0.10;
  }

  // ECO connu → +0.05
  if (raw.openingEco && raw.openingEco.length >= 2) score += 0.05;

  return Math.min(Math.round(score * 1000) / 1000, 0.82); // max 82% pour inférence locale
}

// ─── Règles ML : Profil joueur ────────────────────────────────────────────────

function inferPlayerProfileHint(
  type: GameType,
  victoryStatus?: string,
  nombreCoups?: number,
): PlayerProfileHint {
  const status = (victoryStatus ?? '').toLowerCase();
  const coups = nombreCoups ?? 0;

  if (status === 'mate') return 'Attaquant';
  if (status === 'draw') return 'Technicien';
  if (status === 'resign' && coups < 25) return 'Irrégulier';
  if (type === 'Stratégique') return 'Défenseur';
  if (type === 'Tactique')    return 'Attaquant';

  return 'Équilibré';
}

// ─── Règles ML : Famille d'ouverture ─────────────────────────────────────────

function extractOpeningFamily(openingName?: string): string {
  if (!openingName) return 'Ouverture inconnue';
  const sep = openingName.indexOf(':');
  if (sep > 0) return openingName.slice(0, sep).trim();
  const hash = openingName.indexOf('#');
  if (hash > 0) return openingName.slice(0, hash).trim();
  return openingName.trim();
}

// ─── Règles ML : Résumé analytique ───────────────────────────────────────────

function buildAnalyticSummary(
  type: GameType,
  level: GameLevel,
  rhythm: GameRhythm,
  typeResultat?: string,
  victoryStatus?: string,
  openingFamily?: string,
): string {
  const parts: string[] = [];

  parts.push(`Partie ${type.toLowerCase()} (${rhythm.toLowerCase()})`);
  parts.push(`niveau ${level}`);

  const result = (typeResultat ?? '').toLowerCase();
  const status = (victoryStatus ?? '').toLowerCase();

  let fin = '';
  if (result.includes('nul') || result.includes('draw') || status === 'draw') {
    fin = '— nulle';
  } else if (status === 'mate' || result.includes('mat')) {
    fin = `victoire ${result.includes('blanc') || result.includes('white') ? 'blanc' : 'noir'} par mat`;
  } else if (status === 'resign' || result.includes('abandon')) {
    fin = `victoire ${result.includes('blanc') || result.includes('white') ? 'blanc' : 'noir'} par abandon`;
  } else if (status === 'outoftime') {
    fin = 'par timeout';
  } else if (result.includes('blanc') || result.includes('white')) {
    fin = 'victoire blanc';
  } else if (result.includes('noir') || result.includes('black')) {
    fin = 'victoire noir';
  }

  if (fin) parts.push(fin);
  if (openingFamily && openingFamily !== 'Ouverture inconnue') {
    parts.push(`via ${openingFamily}`);
  }

  return parts.join(' | ') + '.';
}

// ─── Inférence Cadence → time_category ───────────────────────────────────────

type TimeCategory = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Unknown';

function inferTimeCategory(cadence?: string): TimeCategory {
  const c = (cadence ?? '').toLowerCase().trim();
  if (!c) return 'Unknown';

  if (c === 'bullet' || c.startsWith('1+') || c.startsWith('2+') || c === '0+1') return 'Bullet';
  if (c === 'blitz'  || c.startsWith('3+') || c.startsWith('5+') || c === '5+0') return 'Blitz';
  if (c === 'rapid'  || c.startsWith('10+') || c.startsWith('15+')) return 'Rapid';
  if (c === 'classical' || c.startsWith('30+') || c.startsWith('25+') || c.startsWith('20+')) return 'Classical';

  // Parsing "base+inc" numérique
  const match = c.match(/^(\d+)\+(\d+)$/);
  if (match) {
    const base = parseInt(match[1]);
    const inc  = parseInt(match[2]);
    const estimated = base + 40 * inc / 60;
    if (estimated < 3)  return 'Bullet';
    if (estimated < 8)  return 'Blitz';
    if (estimated < 25) return 'Rapid';
    return 'Classical';
  }

  return 'Unknown';
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Calcule les métadonnées ML pour une partie à partir des champs bruts.
 * Retourne un objet GameMLData complet, prêt pour MLGameBadges.
 *
 * @param raw - Champs bruts de la partie (backend)
 * @param source - 'csv' si données exactes du CSV, 'inferred' si calculées ici
 */
export function inferGameML(
  raw: RawPartieFields,
  source: 'csv' | 'inferred' = 'inferred',
): GameMLData & { _source: 'csv' | 'inferred' } {
  const level    = inferLevel(raw.eloBlanc, raw.eloNoir);
  const type     = inferGameType(raw.typeResultat, raw.victoryStatus, raw.nombreCoups, undefined, raw.openingName);
  const rhythm   = inferRhythm(raw.nombreCoups, raw.cadence);
  const confidence = source === 'csv' ? 0.75 : inferConfidence(raw); // CSV → confiance absolue plus haute
  const hint     = inferPlayerProfileHint(type, raw.victoryStatus, raw.nombreCoups);
  const family   = extractOpeningFamily(raw.openingName);
  const avgRating = ((raw.eloBlanc ?? 0) + (raw.eloNoir ?? 0)) / 2;
  const absDiff  = Math.abs((raw.eloBlanc ?? 0) - (raw.eloNoir ?? 0));
  const timeCat  = inferTimeCategory(raw.cadence);

  const summary  = buildAnalyticSummary(type, level, rhythm, raw.typeResultat, raw.victoryStatus, family);

  // Déduire winner / victoryStatus depuis typeResultat si non fournis
  let winner: 'white' | 'black' | 'draw' = 'draw';
  let vStatus: 'resign' | 'mate' | 'outoftime' | 'draw' = 'resign';

  const r = (raw.typeResultat ?? '').toLowerCase();
  if (r.includes('blanc') || r.includes('white')) winner = 'white';
  else if (r.includes('noir') || r.includes('black')) winner = 'black';

  if (raw.victoryStatus) {
    vStatus = raw.victoryStatus as typeof vStatus;
  } else if (r.includes('nul') || r.includes('draw')) {
    vStatus = 'draw';
    winner = 'draw';
  }

  return {
    id: String(raw.id),
    predicted_game_type: type,
    predicted_level: level,
    predicted_rhythm: rhythm,
    confidence_score: confidence,
    player_profile_hint: hint,
    analytic_summary: summary,
    opening_family: family,
    eco_group: raw.openingEco?.charAt(0)?.toUpperCase() ?? '?',
    time_category: timeCat,
    abs_rating_diff: absDiff,
    is_balanced: absDiff < 100,
    avg_rating: avgRating,
    turns: raw.nombreCoups ?? 0,
    victory_status: vStatus,
    winner,
    _source: source,
  };
}
