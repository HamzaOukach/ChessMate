/**
 * chessCommandParser.ts — Version 6 (Robustesse maximale + déduction contextuelle)
 *
 * Améliorations v6 :
 * 1. "pion 4" / "pion e" : déduction partielle de case (rang seul ou colonne seule)
 * 2. Passage de l'état du plateau au parser pour résolution contextuelle
 * 3. Nouveaux patterns de roque ("roque", "castle" seul = petit roque par défaut)
 * 4. Meilleure tokenisation : gestion des formes agglutinées "e4", "nf3"
 * 5. Variantes phonétiques enrichies pour l'ASR français
 * 6. Logique de "best-guess" quand le rang ou la colonne est manquant
 */

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export type ChessIntent =
  | { type: 'castle-short' }
  | { type: 'castle-long' }
  | { type: 'move'; piece: PieceType; toSquare: string; partialFile?: string; partialRank?: string };

export interface ParseResult {
  intent: ChessIntent;
  transcript: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Mots à ignorer lors de la tokenisation ───────────────────────────────────

const IGNORE_WORDS = new Set([
  // Verbes de jeu
  'joue', 'jouer', 'joues', 'joué',
  // Pronoms
  'tu', 'il', 'elle', 'nous', 'vous',
  // Articles
  'le', 'la', 'les', 'un', 'une', 'des',
  // Prépositions
  'au', 'sur', 'vers', 'jusqu', 'par', 'pour', 'avec', 'en', 'a', 'à', 'dans',
  // Verbes de déplacement et d'action
  'bouge', 'bouger', 'déplace', 'déplacer', 'va', 'aller',
  'mets', 'mettre', 'place', 'placer', 'avance', 'avancer', 'pousse', 'pousser',
  'prend', 'prends', 'prendre', 'mange', 'manger', 'manges', 'tue', 'capture', 'capturer',
  // Mots parasites
  'coup', 'coups', 'mouvement', 'case',
  'mon', 'ma', 'mes',
  // Instructions
  'veux', 'vouloir', 'faire', 'fais',
  // Connecteurs
  'puis', 'ensuite', 'alors', 'vas', 'vasy', 'zap',
]);

// ─── Dictionnaires de Correspondance Sémantique ──────────────────────────────

const PIECE_MAP: Record<string, PieceType> = {
  // Pions — variantes maximales
  'pion': 'pawn', 'pions': 'pawn', 'pawn': 'pawn', 'peon': 'pawn',
  'pie': 'pawn', 'pyon': 'pawn', 'pine': 'pawn', 'pin': 'pawn',
  'pian': 'pawn', 'pien': 'pawn', 'peons': 'pawn', 'piang': 'pawn',

  // Cavaliers — toutes variantes de prononciation ASR
  'cavalier': 'knight', 'cavaliers': 'knight',
  'cheval': 'knight', 'chevaux': 'knight', 'chevalier': 'knight',
  'knight': 'knight', 'cavalerie': 'knight',
  'calvalier': 'knight', 'cavallier': 'knight',
  'chevalerie': 'knight', 'cava': 'knight',
  'kavalier': 'knight', 'cavalie': 'knight',
  'chevalie': 'knight', 'cavali': 'knight',
  'cheva': 'knight', 'chevaliers': 'knight',

  // Fous — variantes
  'fou': 'bishop', 'fous': 'bishop', 'faux': 'bishop',
  'food': 'bishop', 'fout': 'bishop', 'flou': 'bishop',
  'bishop': 'bishop', 'fu': 'bishop', 'fo': 'bishop',
  'foux': 'bishop', 'phoque': 'bishop',

  // Tours — variantes
  'tour': 'rook', 'tours': 'rook', 'rook': 'rook',
  'rooks': 'rook', 'tor': 'rook', 'ture': 'rook',
  'roc': 'rook', 'tors': 'rook', 'toure': 'rook',

  // Dames — variantes
  'dame': 'queen', 'dames': 'queen', 'reine': 'queen',
  'reines': 'queen', 'queen': 'queen', 'dam': 'queen',
  'quine': 'queen', 'quene': 'queen', 'rein': 'queen',

  // Rois — variantes
  'roi': 'king', 'rois': 'king', 'king': 'king',
  'kings': 'king', 'row': 'king', 'roye': 'king',
  'roix': 'king', 'roya': 'king',
};

const FILE_MAP: Record<string, string> = {
  // Colonne A
  'a': 'a', 'ah': 'a', 'à': 'a', 'alpha': 'a', 'aa': 'a',
  // Colonne B
  'b': 'b', 'be': 'b', 'bay': 'b', 'baie': 'b', 'bé': 'b', 'bravo': 'b', 'bi': 'b',
  // Colonne C
  'c': 'c', 'ce': 'c', 'se': 'c', 'sait': 'c', 'cest': 'c', 'sais': 'c',
  'charlie': 'c', 'ça': 'c', 'sa': 'c', 'ci': 'c', 'cy': 'c', 'cé': 'c',
  // Colonne D
  'd': 'd', 'de': 'd', 'dé': 'd', 'dès': 'd', 'delta': 'd', 'di': 'd',
  // Colonne E
  'e': 'e', 'et': 'e', 'est': 'e', 'eu': 'e', 'he': 'e',
  'haie': 'e', 'é': 'e', 'è': 'e', 'ê': 'e', 'ai': 'e', 'echo': 'e',
  'eh': 'e', 'er': 'e',
  // Colonne F
  'f': 'f', 'ef': 'f', 'effe': 'f', 'oeuf': 'f', 'foxtrot': 'f', 'ph': 'f',
  'fe': 'f', 'fi': 'f',
  // Colonne G
  'g': 'g', 'ge': 'g', 'jai': 'g', 'jet': 'g', 'golf': 'g',
  'ji': 'g', 'guy': 'g', 'gui': 'g', 'gé': 'g',
  // Colonne H
  'h': 'h', 'ache': 'h', 'hache': 'h', 'ash': 'h', 'hotel': 'h',
  'hi': 'h', 'aitch': 'h', 'ha': 'h',
};

const RANK_MAP: Record<string, string> = {
  '1': '1', 'un': '1', 'une': '1', 'one': '1', 'hein': '1', 'han': '1', 'an': '1',
  '2': '2', 'deux': '2', 'two': '2', 'doux': '2', 'du': '2', 'deu': '2',
  '3': '3', 'trois': '3', 'troi': '3', 'toi': '3', 'three': '3', 'très': '3', 'tra': '3', 'twa': '3', 'troa': '3',
  '4': '4', 'quatre': '4', 'catre': '4', 'quat': '4', 'four': '4', 'cat': '4', 'katr': '4', 'katre': '4', 'quatt': '4',
  '5': '5', 'cinq': '5', 'sank': '5', 'sink': '5', 'five': '5', 'cink': '5', 'saint': '5', 'sen': '5', 'sang': '5',
  '6': '6', 'six': '6', 'sis': '6', 'cis': '6', 'si': '6', 'sex': '6', 'siz': '6',
  '7': '7', 'sept': '7', 'set': '7', 'cette': '7', 'seven': '7', 'sète': '7', 'sett': '7', 'septs': '7',
  '8': '8', 'huit': '8', 'whit': '8', 'wit': '8', 'uite': '8', 'oui': '8', 'eight': '8', 'wick': '8',
};

// ─── Patterns Roques ─────────────────────────────────────────────────────────

const LONG_CASTLE_PATTERNS: RegExp[] = [
  /\b(grand\s*roque|grande\s*roque|grand\s*rock|gros\s*roque|roque\s*long|roque\s*dame|long\s*castle|queenside\s*castle)\b/i,
  /\bo-o-o\b/i,
  /\b0-0-0\b/i,
];

const SHORT_CASTLE_PATTERNS: RegExp[] = [
  /\b(petit\s*roque|petite\s*roque|petit\s*rock|roque\s*court|roque\s*roi|short\s*castle|kingside\s*castle|roque\s*rapide)\b/i,
  /\bo-o\b(?!-o)/i,
  /\b0-0\b(?!-0)/i,
  // "roque" seul = petit roque par convention
  /^\s*roque\s*$/i,
  /^\s*rok\s*$/i,
  /^\s*roc\s*$/i,
];

// ─── Normalisation ───────────────────────────────────────────────────────────

/** Nettoyage total : minuscule, sans accents, sans ponctuation. */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['_\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nettoyage léger : minuscule + apostrophes/tirets en espaces. */
function softNormalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pré-traitement : supprime les locutions du type "je joue", "je vais jouer",
 * "vas-y", "joue le", tout en conservant les tokens utiles.
 */
function preProcessText(text: string): string {
  return text
    // "je + verbe"
    .replace(/\bje\s+(joue|jouer|joues|joué|vais|fais|veux|dois|peux|prends|déplace|bouge|mets|place|veux|voudrais|aimerais|voudrai)\b/gi, '')
    // "vas-y joue", "allez", "vas y"
    .replace(/\b(vasy|vas\s+y|allez|voila|voilà|voici|go)\b/gi, '')
    // "joue le coup", "fais le mouvement"
    .replace(/\b(joue|fais|fait)\s+(le|la|les|un|une)\s+/gi, '')
    // simples verbes en début de phrase
    .replace(/^(joue|jouer|joues|joué|avance|avancer|pousse|pousser|bouge|bouger|déplace|déplacer|mets|place|fais|fait)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Filtre les mots à ignorer d'un tableau de tokens. */
function filterTokens(tokens: string[]): string[] {
  return tokens.filter(t => t.length > 0 && !IGNORE_WORDS.has(t));
}

// ─── Détection de case depuis tokens ─────────────────────────────────────────

/**
 * Reconstruit une case depuis deux tokens consécutifs.
 * Ex : ["e", "quatre"] → "e4" ; ["et", "4"] → "e4"
 */
function matchSquareFromTokens(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    const fileToken = FILE_MAP[tokens[i]];
    const rankToken = RANK_MAP[tokens[i + 1]];
    if (fileToken && rankToken) {
      return fileToken + rankToken;
    }
  }

  // Token unique collé (cas "e4", "f3", "nf3"...)
  for (const t of tokens) {
    // Case pure "e4"
    if (/^[a-h][1-8]$/.test(t)) return t;

    // SAN collée pion "e4"
    const mPawn = t.match(/^([a-h])([1-8])$/);
    if (mPawn) return mPawn[1] + mPawn[2];
  }

  return null;
}

/** Tente de lire une case collée dans un token unique : "e4", "nf3", "bc4" */
function tryReadSANToken(word: string): ChessIntent | null {
  // SAN avec pièce : Nf3, Bc4, Qh5, Re1, Ke2
  const sanWithPiece = word.match(/^([kqrbnkqrbn])([a-h])([1-8])$/i);
  if (sanWithPiece) {
    let piece: PieceType = 'pawn';
    switch (sanWithPiece[1].toLowerCase()) {
      case 'k': piece = 'king'; break;
      case 'q': piece = 'queen'; break;
      case 'r': piece = 'rook'; break;
      case 'b': piece = 'bishop'; break;
      case 'n': piece = 'knight'; break;
    }
    return { type: 'move', piece, toSquare: sanWithPiece[2].toLowerCase() + sanWithPiece[3] };
  }

  // Pion seul : e4, d5, h6…
  const sanPawn = word.match(/^([a-h])([1-8])$/i);
  if (sanPawn) {
    return { type: 'move', piece: 'pawn', toSquare: sanPawn[1].toLowerCase() + sanPawn[2] };
  }

  return null;
}

/** Détection de type de pièce dans les tokens. */
function matchPieceFromTokens(tokens: string[]): PieceType | null {
  for (const t of tokens) {
    const piece = PIECE_MAP[t];
    if (piece) return piece;
  }
  return null;
}

/** Détection d'une colonne seule dans les tokens. */
function matchFileFromTokens(tokens: string[]): string | null {
  for (const t of tokens) {
    const f = FILE_MAP[t];
    if (f) return f;
  }
  return null;
}

/** Détection d'un rang seul dans les tokens. */
function matchRankFromTokens(tokens: string[]): string | null {
  for (const t of tokens) {
    const r = RANK_MAP[t];
    if (r) return r;
  }
  return null;
}

// ─── Logique Principale ──────────────────────────────────────────────────────

export function parseChessCommand(rawText: string): ChessIntent | null {
  if (!rawText?.trim()) return null;

  // ── 0. Pré-traitement ──────────────────────────────────────────────────────
  const preProcessed = preProcessText(rawText);

  const softText = softNormalize(preProcessed);
  const cleanText = normalize(preProcessed);

  // Textes originaux aussi pour les roques (ex : "O-O-O")
  const allTexts = [
    softText, cleanText,
    softNormalize(rawText), normalize(rawText),
    rawText.toLowerCase(),
  ];

  // ── 1. Détection Roques ────────────────────────────────────────────────────
  for (const pattern of LONG_CASTLE_PATTERNS) {
    if (allTexts.some(t => pattern.test(t))) {
      return { type: 'castle-long' };
    }
  }
  for (const pattern of SHORT_CASTLE_PATTERNS) {
    if (allTexts.some(t => pattern.test(t))) {
      return { type: 'castle-short' };
    }
  }

  // ── 2. SAN compacte mot-par-mot ────────────────────────────────────────────
  for (const word of cleanText.split(' ')) {
    const intent = tryReadSANToken(word);
    if (intent) {
      // Si la case pure est trouvée (ex: "c4" dans "fou c4"), le parser devine "pion".
      // On corrige en cherchant s'il y a une pièce explicite ailleurs dans la phrase.
      if (intent.type === 'move' && intent.piece === 'pawn') {
        const spokenPiece = matchPieceFromTokens(filterTokens(cleanText.split(' '))) ??
                            matchPieceFromTokens(filterTokens(softText.split(' ')));
        if (spokenPiece) {
          intent.piece = spokenPiece;
        }
      }
      return intent;
    }
  }

  // ── 3. Parsing naturel ─────────────────────────────────────────────────────
  const tokens     = filterTokens(cleanText.split(' '));
  const softTokens = filterTokens(softText.split(' '));

  // Détection pièce
  const piece: PieceType =
    matchPieceFromTokens(tokens) ??
    matchPieceFromTokens(softTokens) ??
    'pawn';

  // Détection case complète
  let toSquare = matchSquareFromTokens(tokens) ?? matchSquareFromTokens(softTokens);

  // ── 4. Regex de dernier recours sur le texte entier ────────────────────────
  if (!toSquare) {
    const fileKeys = Object.keys(FILE_MAP)
      .sort((a, b) => b.length - a.length)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const rankKeys = Object.keys(RANK_MAP)
      .sort((a, b) => b.length - a.length)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const squareRegex = new RegExp(`\\b(${fileKeys})\\s+(${rankKeys})\\b`, 'i');

    for (const text of [cleanText, softText]) {
      const m = text.match(squareRegex);
      if (m) {
        const f = FILE_MAP[m[1].toLowerCase()];
        const r = RANK_MAP[m[2].toLowerCase()];
        if (f && r) { toSquare = f + r; break; }
      }
    }
  }

  // ── 5. Cas "pion 4" / "pion e" : case partiellement spécifiée ────────────
  // Si on a une pièce mais pas de case complète, on retourne l'intention partielle
  // pour que le résolveur de coups puisse compléter avec l'état du plateau.
  if (!toSquare) {
    const partialFile = matchFileFromTokens(tokens) ?? matchFileFromTokens(softTokens);
    const partialRank = matchRankFromTokens(tokens) ?? matchRankFromTokens(softTokens);

    // "pion e" → partialFile = 'e', on aura besoin du plateau pour compléter
    // "pion 4" → partialRank = '4', on aura besoin du plateau pour compléter
    if (partialFile || partialRank) {
      return {
        type: 'move',
        piece,
        toSquare: `${partialFile ?? '?'}${partialRank ?? '?'}`,
        partialFile: partialFile ?? undefined,
        partialRank: partialRank ?? undefined,
      };
    }

    return null;
  }

  return { type: 'move', piece, toSquare };
}

// ─── Parsing avec alternatives ASR ───────────────────────────────────────────

export function parseWithAlternatives(
  primary: string,
  alternatives: string[] = [],
): ParseResult | null {
  // Essai 1 : transcription principale
  const primaryIntent = parseChessCommand(primary);
  if (primaryIntent) {
    return { intent: primaryIntent, transcript: primary, confidence: 'high' };
  }

  // Essai 2 : alternatives ASR
  for (const alt of alternatives) {
    if (!alt || alt === primary) continue;
    const altIntent = parseChessCommand(alt);
    if (altIntent) {
      return { intent: altIntent, transcript: alt, confidence: 'medium' };
    }
  }

  // Essai 3 : fusion primary + alternatives (mots-clés répartis)
  if (alternatives.length > 0) {
    const combined = [primary, ...alternatives].join(' ');
    const combinedIntent = parseChessCommand(combined);
    if (combinedIntent) {
      return { intent: combinedIntent, transcript: combined, confidence: 'low' };
    }

    // Essai 4 : combinaisons pairées
    for (const alt of alternatives) {
      if (!alt) continue;
      const pair = `${primary} ${alt}`;
      const pairIntent = parseChessCommand(pair);
      if (pairIntent) {
        return { intent: pairIntent, transcript: pair, confidence: 'low' };
      }
    }
  }

  return null;
}
