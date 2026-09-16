import { useEffect, useMemo, useState } from 'react';
import { ChessMiniBoard } from './ChessMiniBoard';
import { MlInsightBadge } from './MLGameBadges';
import { BACKEND_API_URL } from '../services/api';

type PartieDetailPageProps = {
  partieId: number;
  onBack: () => void;
};

type Board = string[][];

const DEMO_DETAILS: Record<number, any> = {
  101: {
    partie: {
      id: 101,
      title: 'Magnus vs Hikaru - Blitz',
      dateHeureUTC: '2026-03-20T18:30:00',
      typeResultat: 'Victoire blanc',
      variant: 'Blitz',
      eloBlanc: 2850,
      eloNoir: 2780,
    },
    joueurs: {
      joueurBlanc: { pseudonyme: 'Magnus' },
      joueurNoir: { pseudonyme: 'Hikaru' },
    },
    ouverture: {
      libelle: 'Défense sicilienne',
      code: 'B20',
    },
    tournoi: {
      libelle: 'Tournoi Démo Blitz',
      code: 'TDB-01',
      dateDebut: '2026-03-20',
    },
    suiteCoups: {
      pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O',
    },
  },
  102: {
    partie: {
      id: 102,
      title: 'Youssef vs Stockfish',
      dateHeureUTC: '2026-03-22T20:10:00',
      typeResultat: 'Victoire noir',
      variant: 'Rapide',
      eloBlanc: 1450,
      eloNoir: 3500,
    },
    joueurs: {
      joueurBlanc: { pseudonyme: 'Youssef' },
      joueurNoir: { pseudonyme: 'Stockfish' },
    },
    ouverture: {
      libelle: 'Partie italienne',
      code: 'C50',
    },
    tournoi: {
      libelle: 'Analyse locale',
      code: 'LOCAL-02',
      dateDebut: '2026-03-22',
    },
    suiteCoups: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7',
    },
  },
  103: {
    partie: {
      id: 103,
      title: 'Partie analysée Lichess',
      dateHeureUTC: '2026-03-25T14:45:00',
      typeResultat: 'Nulle',
      variant: 'Classique',
      eloBlanc: 2010,
      eloNoir: 1988,
    },
    joueurs: {
      joueurBlanc: { pseudonyme: 'AlphaPlayer' },
      joueurNoir: { pseudonyme: 'BetaPlayer' },
    },
    ouverture: {
      libelle: 'Ouverture espagnole',
      code: 'C60',
    },
    tournoi: {
      libelle: 'Import Lichess',
      code: 'LICHESS-01',
      dateDebut: '2026-03-25',
    },
    suiteCoups: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3',
    },
  },
};

const INITIAL_BOARD: Board = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function fileToCol(file: string) {
  return file.charCodeAt(0) - 'a'.charCodeAt(0);
}

function rankToRow(rank: string) {
  return 8 - Number(rank);
}

function getPieceFromLetter(letter: string, color: 'white' | 'black') {
  const whiteMap: Record<string, string> = {
    K: '♔',
    Q: '♕',
    R: '♖',
    B: '♗',
    N: '♘',
    P: '♙',
  };

  const blackMap: Record<string, string> = {
    K: '♚',
    Q: '♛',
    R: '♜',
    B: '♝',
    N: '♞',
    P: '♟',
  };

  return color === 'white' ? whiteMap[letter] : blackMap[letter];
}

function isPathClear(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number) {
  const rowStep = toRow === fromRow ? 0 : toRow > fromRow ? 1 : -1;
  const colStep = toCol === fromCol ? 0 : toCol > fromCol ? 1 : -1;

  let r = fromRow + rowStep;
  let c = fromCol + colStep;

  while (r !== toRow || c !== toCol) {
    if (board[r][c] !== '') return false;
    r += rowStep;
    c += colStep;
  }

  return true;
}

function canPieceReach(
  board: Board,
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  isCapture: boolean
) {
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  if (piece === '♙') {
    if (isCapture) return dr === -1 && adc === 1;
    if (dc !== 0) return false;
    if (dr === -1 && board[toRow][toCol] === '') return true;
    if (fromRow === 6 && dr === -2 && board[5][fromCol] === '' && board[4][fromCol] === '') return true;
    return false;
  }

  if (piece === '♟') {
    if (isCapture) return dr === 1 && adc === 1;
    if (dc !== 0) return false;
    if (dr === 1 && board[toRow][toCol] === '') return true;
    if (fromRow === 1 && dr === 2 && board[2][fromCol] === '' && board[3][fromCol] === '') return true;
    return false;
  }

  if (piece === '♘' || piece === '♞') {
    return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
  }

  if (piece === '♗' || piece === '♝') {
    return adr === adc && isPathClear(board, fromRow, fromCol, toRow, toCol);
  }

  if (piece === '♖' || piece === '♜') {
    return (dr === 0 || dc === 0) && isPathClear(board, fromRow, fromCol, toRow, toCol);
  }

  if (piece === '♕' || piece === '♛') {
    return (dr === 0 || dc === 0 || adr === adc) && isPathClear(board, fromRow, fromCol, toRow, toCol);
  }

  if (piece === '♔' || piece === '♚') {
    return adr <= 1 && adc <= 1;
  }

  return false;
}

function cleanPgnMoves(pgn: string) {
  return pgn
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function parseBoardFromPgn(pgn: string): Board {
  const board = cloneBoard(INITIAL_BOARD);
  const moves = cleanPgnMoves(pgn);
  let side: 'white' | 'black' = 'white';

  for (const rawMove of moves) {
    let move = rawMove.trim();
    if (!move) continue;

    move = move.replace(/[+#?!]+/g, '');

    if (move === 'O-O' || move === 'O-O-O') {
      if (side === 'white') {
        if (move === 'O-O') {
          board[7][6] = '♔';
          board[7][5] = '♖';
          board[7][4] = '';
          board[7][7] = '';
        } else {
          board[7][2] = '♔';
          board[7][3] = '♖';
          board[7][4] = '';
          board[7][0] = '';
        }
      } else {
        if (move === 'O-O') {
          board[0][6] = '♚';
          board[0][5] = '♜';
          board[0][4] = '';
          board[0][7] = '';
        } else {
          board[0][2] = '♚';
          board[0][3] = '♜';
          board[0][4] = '';
          board[0][0] = '';
        }
      }

      side = side === 'white' ? 'black' : 'white';
      continue;
    }

    let promotionLetter = '';
    const promotionMatch = move.match(/=([QRBN])/);
    if (promotionMatch) {
      promotionLetter = promotionMatch[1];
      move = move.replace(/=([QRBN])/, '');
    }

    const isCapture = move.includes('x');
    move = move.replace('x', '');

    const destinationMatch = move.match(/([a-h][1-8])$/);
    if (!destinationMatch) {
      side = side === 'white' ? 'black' : 'white';
      continue;
    }

    const destination = destinationMatch[1];
    const toCol = fileToCol(destination[0]);
    const toRow = rankToRow(destination[1]);

    const prefix = move.slice(0, move.length - 2);

    let pieceLetter = 'P';
    let disambiguation = '';

    if (/^[KQRBN]/.test(prefix)) {
      pieceLetter = prefix[0];
      disambiguation = prefix.slice(1);
    } else {
      pieceLetter = 'P';
      disambiguation = prefix;
    }

    const piece = getPieceFromLetter(pieceLetter, side);
    if (!piece) {
      side = side === 'white' ? 'black' : 'white';
      continue;
    }

    const candidates: { row: number; col: number }[] = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] !== piece) continue;

        if (disambiguation) {
          if (disambiguation.length === 1) {
            if (/[a-h]/.test(disambiguation) && col !== fileToCol(disambiguation)) continue;
            if (/[1-8]/.test(disambiguation) && row !== rankToRow(disambiguation)) continue;
          } else if (disambiguation.length === 2) {
            if (col !== fileToCol(disambiguation[0]) || row !== rankToRow(disambiguation[1])) continue;
          }
        }

        if (canPieceReach(board, piece, row, col, toRow, toCol, isCapture)) {
          candidates.push({ row, col });
        }
      }
    }

    if (candidates.length === 0) {
      side = side === 'white' ? 'black' : 'white';
      continue;
    }

    const chosen = candidates[0];
    let movingPiece = board[chosen.row][chosen.col];

    if ((movingPiece === '♙' || movingPiece === '♟') && isCapture && board[toRow][toCol] === '') {
      const capturedPawnRow = movingPiece === '♙' ? toRow + 1 : toRow - 1;
      if (capturedPawnRow >= 0 && capturedPawnRow < 8) {
        board[capturedPawnRow][toCol] = '';
      }
    }

    board[chosen.row][chosen.col] = '';

    if (promotionLetter) {
      movingPiece = getPieceFromLetter(promotionLetter, side);
    }

    board[toRow][toCol] = movingPiece;
    side = side === 'white' ? 'black' : 'white';
  }

  return board;
}

function countOccurrences(text: string, pattern: RegExp) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function PartieDetailPage({ partieId, onBack }: PartieDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingDemo, setUsingDemo] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  const [partie, setPartie] = useState<any>(null);
  const [joueurs, setJoueurs] = useState<any>(null);
  const [ouverture, setOuverture] = useState<any>(null);
  const [tournoi, setTournoi] = useState<any>(null);
  const [suiteCoups, setSuiteCoups] = useState<any>(null);

  const API_URL = BACKEND_API_URL;

  useEffect(() => {
    const applyDemoData = () => {
      const demo = DEMO_DETAILS[Math.abs(partieId)];
      if (!demo) {
        setError('Aucune donnée disponible pour cette partie.');
        return;
      }

      setPartie(demo.partie);
      setJoueurs(demo.joueurs);
      setOuverture(demo.ouverture);
      setTournoi(demo.tournoi);
      setSuiteCoups(demo.suiteCoups);
      setUsingDemo(true);
      setError('');
    };

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        setUsingDemo(false);
        setAnalysisMessage('');
        setCopyMessage('');
        setExportMessage('');

        const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');

        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const isOnlineGame = partieId >= 2000000;
        const isPlayedGame = partieId < 0;
        const realId = isOnlineGame ? partieId - 2000000 : Math.abs(partieId);
        const basePath = isOnlineGame ? `/api/online-parties/${realId}` : (isPlayedGame ? `/parties-jouees/${realId}` : `/parties/${realId}`);

        const fetchJson = async (url: string) => {
          const response = await fetch(`${API_URL}${url}`, { headers });
          if (!response.ok) {
            throw new Error(`Erreur ${response.status} sur ${url}`);
          }
          return response.json();
        };

        const [partieData, joueursData, ouvertureData, tournoiData, suiteCoupsData] =
          await Promise.allSettled([
            fetchJson(basePath),
            fetchJson(`${basePath}/joueurs`),
            fetchJson(`${basePath}/ouverture`),
            fetchJson(`${basePath}/tournoi`),
            fetchJson(`${basePath}/suiteCoups`),
          ]);

        if (partieData.status === 'fulfilled') setPartie(partieData.value);
        if (joueursData.status === 'fulfilled') setJoueurs(joueursData.value);
        if (ouvertureData.status === 'fulfilled') setOuverture(ouvertureData.value);
        if (tournoiData.status === 'fulfilled') setTournoi(tournoiData.value);
        if (suiteCoupsData.status === 'fulfilled') setSuiteCoups(suiteCoupsData.value);

        const allRejected =
          partieData.status === 'rejected' &&
          joueursData.status === 'rejected' &&
          ouvertureData.status === 'rejected' &&
          tournoiData.status === 'rejected' &&
          suiteCoupsData.status === 'rejected';

        if (allRejected) {
          applyDemoData();
        }
      } catch (err) {
        console.error(err);
        applyDemoData();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL, partieId]);

  const movesText = useMemo(() => {
    if (!suiteCoups) return 'Aucune suite de coups disponible.';

    if (Array.isArray(suiteCoups)) {
      return suiteCoups
        .map((coup: any, index: number) =>
          typeof coup === 'string' ? `${index + 1}. ${coup}` : JSON.stringify(coup)
        )
        .join(' ');
    }

    if (typeof suiteCoups === 'object' && suiteCoups.pgn) {
      return String(suiteCoups.pgn);
    }

    return JSON.stringify(suiteCoups, null, 2);
  }, [suiteCoups]);

  const pgnText = useMemo(() => {
    if (typeof suiteCoups === 'object' && suiteCoups?.pgn) {
      return String(suiteCoups.pgn);
    }

    if (typeof partie?.pgn === 'string') {
      return partie.pgn;
    }

    return movesText;
  }, [suiteCoups, partie, movesText]);

  const moveCount = useMemo(() => {
    const matches = pgnText.match(/\d+\./g);
    return matches ? matches.length : 0;
  }, [pgnText]);

  const winner = useMemo(() => {
    const result = (partie?.typeResultat || partie?.resultat || '').toLowerCase();

    if (result.includes('blanc') || result.includes('white')) {
      return joueurs?.joueurBlanc?.pseudonyme || partie?.joueurBlanc || 'Blanc';
    }
    if (result.includes('noir') || result.includes('black')) {
      return joueurs?.joueurNoir?.pseudonyme || partie?.joueurNoir || 'Noir';
    }
    if (result.includes('nulle') || result.includes('nul') || result.includes('draw')) {
      return 'Aucun, partie nulle';
    }

    return partie?.vainqueur || 'Non déterminé';
  }, [partie, joueurs]);

  const finalBoard = useMemo(() => {
    if (!pgnText || pgnText === 'Aucune suite de coups disponible.') {
      return cloneBoard(INITIAL_BOARD);
    }

    try {
      return parseBoardFromPgn(pgnText);
    } catch (error) {
      console.error('Erreur parsing PGN :', error);
      return cloneBoard(INITIAL_BOARD);
    }
  }, [pgnText]);

  const boardStats = useMemo(() => {
    return {
      captures: countOccurrences(pgnText, /x/g),
      checks: countOccurrences(pgnText, /\+/g),
      mates: countOccurrences(pgnText, /#/g),
      promotions: countOccurrences(pgnText, /=/g),
      castlings: countOccurrences(pgnText, /O-O(-O)?/g),
    };
  }, [pgnText]);

  const autoReport = useMemo(() => {
    const openingName = ouverture?.libelle || partie?.ouverture || 'ouverture non renseignée';
    const variantName = partie?.variant || 'format non renseigné';
    const resultText = (partie?.typeResultat || partie?.resultat || '').toLowerCase();

    let summary = '';
    let strength = '';
    let weakness = '';
    let riskLevel = '';
    let recommendation = '';

    if (moveCount <= 10) {
      riskLevel = 'Élevé';
    } else if (moveCount <= 25) {
      riskLevel = 'Moyen';
    } else {
      riskLevel = 'Modéré';
    }

    if (resultText.includes('blanc') || resultText.includes('white')) {
      summary = `Le joueur blanc a gagné une partie ${variantName.toLowerCase()} issue de ${openingName.toLowerCase()}.`;
    } else if (resultText.includes('noir') || resultText.includes('black')) {
      summary = `Le joueur noir a gagné une partie ${variantName.toLowerCase()} issue de ${openingName.toLowerCase()}.`;
    } else if (
      resultText.includes('nul') ||
      resultText.includes('nulle') ||
      resultText.includes('draw')
    ) {
      summary = `La partie ${variantName.toLowerCase()} issue de ${openingName.toLowerCase()} s’est terminée par une nulle.`;
    } else {
      summary = `Partie ${variantName.toLowerCase()} jouée avec ${openingName.toLowerCase()}, sans conclusion automatique complètement précise.`;
    }

    if (boardStats.mates > 0) {
      strength =
        "La partie s’est terminée par un mat, ce qui montre une conclusion tactique nette et décisive.";
    } else if (boardStats.captures >= 8) {
      strength =
        'La partie comporte de nombreux échanges, signe d’une phase tactique active et d’un combat concret.';
    } else if (boardStats.castlings >= 1) {
      strength =
        'Le roque apparaît dans la partie, ce qui indique une volonté correcte de sécuriser le roi.';
    } else {
      strength =
        'La partie présente une structure exploitable pour une analyse stratégique progressive.';
    }

    if (moveCount <= 8) {
      weakness =
        "La partie est très courte, ce qui peut refléter une erreur rapide ou une mauvaise gestion de l’ouverture.";
    } else if (boardStats.checks === 0 && moveCount > 20) {
      weakness =
        'La partie semble manquer de pression directe sur le roi adverse, avec peu de signaux tactiques visibles.';
    } else if (boardStats.captures <= 2 && moveCount > 20) {
      weakness =
        'Le faible nombre d’échanges peut traduire un manque d’initiative concrète ou de conversion des avantages.';
    } else {
      weakness =
        'Certaines décisions critiques mériteraient une analyse moteur plus poussée pour être mieux comprises.';
    }

    if (boardStats.mates > 0) {
      recommendation =
        'Revoir les derniers coups pour comprendre précisément la séquence tactique qui mène au mat.';
    } else if (moveCount <= 10) {
      recommendation =
        "Travailler la préparation d’ouverture et éviter les imprécisions précoces dans les premiers coups.";
    } else if (boardStats.castlings === 0) {
      recommendation =
        'Améliorer la sécurité du roi plus tôt dans la partie, notamment par le roque lorsque la position le permet.';
    } else if (boardStats.captures >= 8) {
      recommendation =
        'Analyser les échanges majeurs pour identifier si chaque simplification était réellement favorable.';
    } else {
      recommendation =
        'Comparer cette partie avec une analyse Stockfish pour confirmer les moments clés et les meilleurs plans.';
    }

    return {
      summary,
      strength,
      weakness,
      riskLevel,
      recommendation,
    };
  }, [ouverture, partie, moveCount, boardStats]);

  const handleDownloadPGN = () => {
    const content = pgnText || 'Aucun PGN disponible.';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partie-${Math.abs(partieId)}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleCopyPGN = async () => {
    try {
      await navigator.clipboard.writeText(pgnText || 'Aucun PGN disponible.');
      setCopyMessage('PGN copié dans le presse-papiers.');
      setTimeout(() => setCopyMessage(''), 2500);
    } catch (error) {
      console.error(error);
      setCopyMessage('Copie impossible.');
      setTimeout(() => setCopyMessage(''), 2500);
    }
  };

  const handleAnalyze = () => {
    setAnalysisMessage(
      `Analyse rapide : ${moveCount} coups, ${boardStats.captures} capture(s), ${boardStats.checks} échec(s), ${boardStats.mates} mat, ${boardStats.castlings} roque(s), ${boardStats.promotions} promotion(s).`
    );
  };

  const handleExportSummary = () => {
    const summary = [
      `Résumé de la partie #${partie?.id ?? Math.abs(partieId)}`,
      `Titre : ${partie?.title || partie?.titre || 'Non renseigné'}`,
      `Date : ${partie?.dateHeureUTC || partie?.dateHeure || 'Non renseignée'}`,
      `Résultat : ${partie?.typeResultat || partie?.resultat || 'Non renseigné'}`,
      `Variant : ${partie?.variant || 'Non renseigné'}`,
      `Blanc : ${joueurs?.joueurBlanc?.pseudonyme || partie?.joueurBlanc || 'Non renseigné'}`,
      `Noir : ${joueurs?.joueurNoir?.pseudonyme || partie?.joueurNoir || 'Non renseigné'}`,
      `Elo blanc : ${partie?.eloBlanc ?? 'Non renseigné'}`,
      `Elo noir : ${partie?.eloNoir ?? 'Non renseigné'}`,
      `Ouverture : ${ouverture?.libelle || partie?.ouverture || 'Non renseignée'} (${ouverture?.code || 'Code inconnu'})`,
      `Tournoi : ${tournoi?.libelle || 'Non renseigné'}`,
      `Date début tournoi : ${tournoi?.dateDebut || 'Non renseignée'}`,
      `Gagnant : ${winner}`,
      `Nombre de coups : ${moveCount}`,
      `Captures : ${boardStats.captures}`,
      `Échecs : ${boardStats.checks}`,
      `Mats : ${boardStats.mates}`,
      `Roques : ${boardStats.castlings}`,
      `Promotions : ${boardStats.promotions}`,
      '',
      'PGN :',
      pgnText || 'Aucun PGN disponible.',
    ].join('\n');

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-partie-${Math.abs(partieId)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    setExportMessage('Résumé exporté avec succès.');
    setTimeout(() => setExportMessage(''), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">Détail d’une partie</h2>
          <p className="mt-2 text-gray-600">Analyse détaillée de la partie sélectionnée.</p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Retour à l’historique
        </button>
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Mode démonstration activé : affichage d’une partie d’exemple pour présenter la fonctionnalité.
        </div>
      )}

      {loading && (
        <div className="bg-white border rounded-xl p-6 shadow-sm text-gray-600">
          Chargement des détails...
        </div>
      )}

      {!loading && error && (
        <div className="bg-white border rounded-xl p-6 shadow-sm text-red-600">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Gagnant</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{winner}</p>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Nombre de coups</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{moveCount}</p>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Ouverture</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {ouverture?.libelle || partie?.ouverture || 'Non renseignée'}
              </p>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Cadence / Variant</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {partie?.variant || 'Non renseigné'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              onClick={handleDownloadPGN}
              className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Télécharger PGN
            </button>

            <button
              onClick={handleCopyPGN}
              className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Copier PGN
            </button>

            <button
              onClick={handleExportSummary}
              className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Exporter résumé
            </button>

            <button
              onClick={handleAnalyze}
              className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Analyser cette partie
            </button>
          </div>

          {copyMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {copyMessage}
            </div>
          )}

          {exportMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {exportMessage}
            </div>
          )}

          {analysisMessage && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              {analysisMessage}
            </div>
          )}

          {(partie?.mlTag || partie?.mlInsight || partie?.probWhite != null) && (
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🤖</span> Analyse Machine Learning
              </h3>
              <MlInsightBadge
                tag={partie?.mlTag}
                insight={partie?.mlInsight}
                probWhite={partie?.probWhite != null ? Number(partie.probWhite) : undefined}
                probBlack={partie?.probBlack != null ? Number(partie.probBlack) : undefined}
                probDraw={partie?.probDraw != null ? Number(partie.probDraw) : undefined}
              />
            </div>
          )}

          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rapport d’analyse automatique</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 border p-4">
                <p className="text-sm text-gray-500 mb-1">Résumé automatique</p>
                <p className="text-sm text-gray-800">{autoReport.summary}</p>
              </div>

              <div className="rounded-lg bg-gray-50 border p-4">
                <p className="text-sm text-gray-500 mb-1">Niveau de risque</p>
                <p className="text-sm font-semibold text-gray-900">{autoReport.riskLevel}</p>
              </div>

              <div className="rounded-lg bg-gray-50 border p-4">
                <p className="text-sm text-gray-500 mb-1">Point fort détecté</p>
                <p className="text-sm text-gray-800">{autoReport.strength}</p>
              </div>

              <div className="rounded-lg bg-gray-50 border p-4">
                <p className="text-sm text-gray-500 mb-1">Point faible détecté</p>
                <p className="text-sm text-gray-800">{autoReport.weakness}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Recommandation :</span> {autoReport.recommendation}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h3>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">ID :</span> {partie?.id ?? Math.abs(partieId)}
                  </p>
                  <p>
                    <span className="font-medium">Titre :</span> {partie?.title || partie?.titre || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Date :</span> {partie?.dateHeureUTC || partie?.dateHeure || 'Non renseignée'}
                  </p>
                  <p>
                    <span className="font-medium">Résultat :</span> {partie?.typeResultat || partie?.resultat || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Variant :</span> {partie?.variant || 'Non renseigné'}
                  </p>
                </div>
              </div>

              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Joueurs</h3>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Blanc :</span> {joueurs?.joueurBlanc?.pseudonyme || partie?.joueurBlanc || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Noir :</span> {joueurs?.joueurNoir?.pseudonyme || partie?.joueurNoir || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Elo blanc :</span> {partie?.eloBlanc ?? 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Elo noir :</span> {partie?.eloNoir ?? 'Non renseigné'}
                  </p>
                </div>
              </div>

              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ouverture</h3>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Nom :</span> {ouverture?.libelle || partie?.ouverture || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Code :</span> {ouverture?.code || 'Non renseigné'}
                  </p>
                </div>
              </div>

              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tournoi</h3>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Nom :</span> {tournoi?.libelle || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Code :</span> {tournoi?.code || partie?.source || 'Non renseigné'}
                  </p>
                  <p>
                    <span className="font-medium">Date début :</span> {tournoi?.dateDebut || 'Non renseignée'}
                  </p>
                </div>
              </div>
            </div>

            <div className="xl:col-span-1">
              <ChessMiniBoard board={finalBoard} title="Mini échiquier" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500">Captures</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{boardStats.captures}</p>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500">Échecs</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{boardStats.checks}</p>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500">Mats</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{boardStats.mates}</p>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500">Roques</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{boardStats.castlings}</p>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500">Promotions</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{boardStats.promotions}</p>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Suite des coups</h3>

            <div className="rounded-lg bg-gray-50 border p-4 overflow-x-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {movesText}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}