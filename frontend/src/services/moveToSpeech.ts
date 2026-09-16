/**
 * moveToSpeech.ts
 *
 * Convertit le format interne `moveText` de ChessGame.tsx
 * en phrases françaises naturelles pour la synthèse vocale.
 *
 * Formats d'entrée attendus (exemples extraits de ChessGame.tsx) :
 *   "♙ e2 → e4"
 *   "♟ e7 → e5"
 *   "♘ g1 → f3 (capture ♟)"
 *   "♔ e1 → g1 (petit roque)"
 *   "♚ e8 → c8 (grand roque)"
 *   "♙ e7 → e8 (promotion ♕)"
 *   "♙ d7 → e8 (capture ♜) (promotion ♕)"
 *   Toutes les formes précédentes peuvent se terminer par " (Stockfish)"
 */

// ---------------------------------------------------------------------------
// Tables de correspondances
// ---------------------------------------------------------------------------

/** Pièce Unicode → nom générique (sans couleur) */
const PIECE_LABEL: Record<string, string> = {
  '♔': 'roi',
  '♚': 'roi',
  '♕': 'dame',
  '♛': 'dame',
  '♖': 'tour',
  '♜': 'tour',
  '♗': 'fou',
  '♝': 'fou',
  '♘': 'cavalier',
  '♞': 'cavalier',
  '♙': 'pion',
  '♟': 'pion',
};

/** Numéros de rangée → prononciation française */
const RANK_LABEL: Record<string, string> = {
  '1': 'un',
  '2': 'deux',
  '3': 'trois',
  '4': 'quatre',
  '5': 'cinq',
  '6': 'six',
  '7': 'sept',
  '8': 'huit',
};

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Détermine si un symbole Unicode représente une pièce blanche. */
const isWhiteSymbol = (symbol: string): boolean =>
  ['♔', '♕', '♖', '♗', '♘', '♙'].includes(symbol);

/**
 * Convertit une case algébrique ("e4") en prononciation française ("e quatre").
 * Gère les cas non reconnus avec un fallback brut.
 */
const squareToFrench = (sq: string): string => {
  if (sq.length !== 2) return sq;
  const rank = RANK_LABEL[sq[1]];
  return rank ? `${sq[0]} ${rank}` : sq;
};

// ---------------------------------------------------------------------------
// Fonction principale : moveText → phrase française
// ---------------------------------------------------------------------------

/**
 * Convertit un `moveText` (format interne de ChessGame.tsx) en phrase française
 * prête pour la synthèse vocale.
 *
 * La fonction est pure : aucun effet de bord, aucun appel réseau.
 * Elle retourne toujours une chaîne non-vide (fallback sur le texte brut si
 * le parsing échoue).
 */
export function moveTextToSpeech(moveText: string): string {
  // 1) Retirer le suffixe "(Stockfish)" s'il est présent
  const text = moveText.replace(/\s*\(Stockfish\)\s*$/u, '').trim();

  // 2) Déterminer la couleur du joueur depuis le premier caractère (emoji pièce)
  const firstChar = text[0] ?? '';
  const isWhite = isWhiteSymbol(firstChar);
  const playerLabel = isWhite ? 'Blancs' : 'Noirs';

  // ---------------------------------------------------------------------------
  // Cas 1 — Petit roque
  // ---------------------------------------------------------------------------
  if (text.includes('(petit roque)')) {
    return `Petit roque des ${playerLabel}.`;
  }

  // ---------------------------------------------------------------------------
  // Cas 2 — Grand roque
  // ---------------------------------------------------------------------------
  if (text.includes('(grand roque)')) {
    return `Grand roque des ${playerLabel}.`;
  }

  // ---------------------------------------------------------------------------
  // Parsing du format général : "PIÈCE FROM → TO [options]"
  //
  // Regex : un caractère Unicode dans la plage des pièces d'échecs,
  // suivi d'une case source, de " → ", d'une case dest, puis le reste optionnel.
  // ---------------------------------------------------------------------------
  const mainPattern = /^([\u2654-\u265F])\s([a-h][1-8])\s→\s([a-h][1-8])(.*)?$/u;
  const match = text.match(mainPattern);

  if (!match) {
    // Fallback : lecture directe du texte nettoyé
    return text;
  }

  const [, pieceSymbol, , toSquare, optionalPart = ''] = match;
  const pieceName = PIECE_LABEL[pieceSymbol] ?? 'pièce';
  const destination = squareToFrench(toSquare);

  // Extraire les informations optionnelles
  const captureMatch = optionalPart.match(/\(capture\s([\u2654-\u265F])\)/u);
  const promotionMatch = optionalPart.match(/\(promotion\s([\u2654-\u265F])\)/u);

  const capturedPieceName = captureMatch
    ? (PIECE_LABEL[captureMatch[1]] ?? 'pièce')
    : null;
  const promotedPieceName = promotionMatch
    ? (PIECE_LABEL[promotionMatch[1]] ?? 'dame')
    : null;

  // ---------------------------------------------------------------------------
  // Cas 3 — Promotion avec capture (ex : pion prend en diagonale et promeut)
  // ---------------------------------------------------------------------------
  if (promotedPieceName && capturedPieceName) {
    return `${playerLabel} : pion capture ${capturedPieceName} et se promeut en ${promotedPieceName} en ${destination}.`;
  }

  // ---------------------------------------------------------------------------
  // Cas 4 — Promotion simple
  // ---------------------------------------------------------------------------
  if (promotedPieceName) {
    return `${playerLabel} : pion promu en ${promotedPieceName} en ${destination}.`;
  }

  // ---------------------------------------------------------------------------
  // Cas 5 — Capture simple
  // ---------------------------------------------------------------------------
  if (capturedPieceName) {
    return `${playerLabel} : ${pieceName} capture ${capturedPieceName} en ${destination}.`;
  }

  // ---------------------------------------------------------------------------
  // Cas 6 — Coup normal
  // ---------------------------------------------------------------------------
  return `${playerLabel} : ${pieceName} en ${destination}.`;
}

// ---------------------------------------------------------------------------
// Fonction secondaire : état du jeu → phrase vocale
// ---------------------------------------------------------------------------

/**
 * Convertit le `gameStatus` et le `winner` en annonce vocale de fin de partie.
 * Retourne `null` si aucune annonce particulière n'est nécessaire.
 *
 * N'annonce PAS l'échec simple (géré directement dans useVoiceAccessibility
 * pour être combiné avec l'annonce du coup).
 */
export function gameStatusToSpeech(
  gameStatus: string,
  winner: string | null,
): string | null {
  // Échec et mat
  if (gameStatus.includes('Échec et mat') && winner === 'Blancs') {
    return 'Fin de la partie. Les blancs l\'emportent par échec et mat.';
  }
  if (gameStatus.includes('Échec et mat') && winner === 'Noirs') {
    return 'Fin de la partie. Les noirs l\'emportent par échec et mat.';
  }

  // Pat (nulle)
  if (gameStatus.includes('Pat')) {
    return 'Pat ! La partie est nulle.';
  }

  // Temps écoulé
  if (gameStatus.includes('Temps') && winner === 'Blancs') {
    return 'Temps écoulé ! Les blancs ont gagné.';
  }
  if (gameStatus.includes('Temps') && winner === 'Noirs') {
    return 'Temps écoulé ! Les noirs ont gagné.';
  }

  return null;
}
