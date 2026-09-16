import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Download, Brain, Circle } from 'lucide-react';
import { getStockfishBestMove, analyzePosition, getCustomBotMove, evaluatePosition, ML_BOT_API_URL, STOCKFISH_API_URL, createPartieJouee } from '../services/api';
import { useVoiceAccessibility } from '../hooks/useVoiceAccessibility';
import { useASR } from '../hooks/useASR';
import { VoiceToggle } from './VoiceToggle';
import { MicButton } from './MicButton';
import { parseWithAlternatives, type ChessIntent } from '../services/chessCommandParser';

interface ChessGameProps {
  username?: string;
  mode: 'human' | 'bot' | 'bot_ml';
  timeControl?: {
    minutes: number;
    increment: number;
  };
  engineSettings?: {
    depth: number | null;
    movetime: number | null;
    useDepth: boolean;
  } | null;
}

interface EngineSettings {
  depth: number | null;
  movetime: number | null;
}

interface BlunderInfo {
  moveIndex: number;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  evalDrop: number;
  fromSquare: { row: number; col: number };
  toSquare: { row: number; col: number };
}

const INITIAL_BOARD = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

export function ChessGame({ username: propUsername, mode, timeControl, engineSettings: passedEngineSettings }: ChessGameProps) {
  const username = propUsername || localStorage.getItem('username') || 'Joueur';
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [pgnMoves, setPgnMoves] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<string>('En cours');
  const [backendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  // Silence unused variable warning until used in UI
  useEffect(() => { if (backendStatus) { } }, [backendStatus]);
  const [thinking, setThinking] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const [lastMove, setLastMove] = useState<{ from: [number, number], to: [number, number] } | null>(null);
  const [markedSquares, setMarkedSquares] = useState<string[]>([]);

  const [whiteTime, setWhiteTime] = useState((timeControl?.minutes || 5) * 60);
  const [blackTime, setBlackTime] = useState((timeControl?.minutes || 5) * 60);
  const [isTimerActive, setIsTimerActive] = useState(true);

  // Track pieces that have moved for castling validation
  const [movedPieces, setMovedPieces] = useState<Set<string>>(new Set());

  // Track the last pawn double move for en passant
  const [lastEnPassantFile, setLastEnPassantFile] = useState<number | null>(null);

  // Track UCI moves for Stockfish (more reliable than parsing moveHistory)
  const uciMovesRef = useRef<string[]>([]);

  // Blunder detection state
  const [blunders, setBlunders] = useState<BlunderInfo[]>([]);
  const [lastBlunderSquares, setLastBlunderSquares] = useState<{ from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null>(null);
  const lastEvalRef = useRef<number | null>(null);

  const [engineSettings] = useState<EngineSettings>(() => {
    if (passedEngineSettings) {
      if (passedEngineSettings.useDepth) {
        return {
          depth: passedEngineSettings.depth,
          movetime: null,
        };
      } else {
        return {
          depth: null,
          movetime: passedEngineSettings.movetime,
        };
      }
    }
    // Default: use depth mode
    return {
      depth: 15,
      movetime: null,
    };
  });

  const [promotionState, setPromotionState] = useState<{
    row: number;
    col: number;
    isWhite: boolean;
    fromRow: number;
    fromCol: number;
  } | null>(null);

  // Guard against concurrent bot moves
  const botMoveInProgress = useRef(false);

  // Voice Accessibility Integration
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [micFeedback, setMicFeedback] = useState<string>('');
  const [pendingClicks, setPendingClicks] = useState<{ row: number, col: number }[]>([]);

  const { isSupported: voiceSupported, speak } = useVoiceAccessibility({
    isEnabled: voiceEnabled,
    moveHistory,
    gameStatus,
    winner,
  });

  const handleVoiceToggle = (enabled: boolean) => {
    setVoiceEnabled(enabled);
    try {
      if (enabled) speak("Accessibilité vocale activée");
      else speak("Accessibilité vocale désactivée");
    } catch (e) {
      console.warn("TTS error", e);
    }
  };
  const [userElo, setUserElo] = useState<number>(800);

  useEffect(() => {
    const fetchElo = async () => {
      try {
        const joueurId = localStorage.getItem('joueurId');
        if (joueurId) {
          const resp = await fetch(`${BACKEND_API_URL}/api/joueurs/${joueurId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.elo) setUserElo(data.elo);
          }
        }
      } catch (e) {
        console.error("Erreur fetch elo:", e);
      }
    };
    fetchElo();
  }, []);

  const isMoveLegal = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (!isValidMove(board, fromRow, fromCol, toRow, toCol)) return false;
    const testBoard = board.map(r => [...r]);
    testBoard[toRow][toCol] = testBoard[fromRow][fromCol];
    testBoard[fromRow][fromCol] = '';
    return !isKingInCheck(testBoard, currentTurn === 'white');
  };

  const resolveVoiceMove = (intent: ChessIntent): { ok: true, fromRow: number, fromCol: number, toRow: number, toCol: number } | { ok: false, error: string } => {
    if (intent.type === 'castle-short' || intent.type === 'castle-long') {
      const kingRow = currentTurn === 'white' ? 7 : 0;
      const toCol = intent.type === 'castle-short' ? 6 : 2;
      if (isMoveLegal(kingRow, 4, kingRow, toCol)) {
        return { ok: true as const, fromRow: kingRow, fromCol: 4, toRow: kingRow, toCol };
      }
      return { ok: false as const, error: 'illegal' };
    }

    if (intent.type !== 'move') return { ok: false as const, error: 'illegal' };

    const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
      pawn: { white: '♙', black: '♟' },
      knight: { white: '♘', black: '♞' },
      bishop: { white: '♗', black: '♝' },
      rook: { white: '♖', black: '♜' },
      queen: { white: '♕', black: '♛' },
      king: { white: '♔', black: '♚' }
    };
    const pieceSymbol = PIECE_SYMBOLS[intent.piece]?.[currentTurn];
    if (!pieceSymbol) return { ok: false, error: 'illegal' };

    const hasPartial = intent.toSquare.includes('?');
    if (hasPartial) {
      const partialFile = intent.partialFile;
      const partialRank = intent.partialRank;
      const allCandidates = [];
      for (let fromR = 0; fromR < 8; fromR++) {
        for (let fromC = 0; fromC < 8; fromC++) {
          if (board[fromR][fromC] !== pieceSymbol) continue;
          for (let toR = 0; toR < 8; toR++) {
            for (let toC = 0; toC < 8; toC++) {
              if (partialRank !== undefined && toR !== (8 - parseInt(partialRank, 10))) continue;
              if (partialFile !== undefined && toC !== (partialFile.charCodeAt(0) - 'a'.charCodeAt(0))) continue;
              if (isMoveLegal(fromR, fromC, toR, toC)) {
                allCandidates.push({ fromRow: fromR, fromCol: fromC, toRow: toR, toCol: toC });
              }
            }
          }
        }
      }
      if (allCandidates.length === 1) return { ok: true as const, ...allCandidates[0] };
      if (allCandidates.length > 1 && intent.piece === 'pawn') {
        const sorted = [...allCandidates].sort((a, b) => currentTurn === 'white' ? a.fromRow - b.fromRow : b.fromRow - a.fromRow);
        const oneStep = sorted.filter(c => Math.abs(c.toRow - c.fromRow) === 1);
        if (oneStep.length === 1) return { ok: true as const, ...oneStep[0] };
        return { ok: true as const, ...sorted[0] };
      }
      return { ok: false as const, error: allCandidates.length === 0 ? 'illegal' : 'ambiguous' };
    }

    const toCol = intent.toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRow = 8 - parseInt(intent.toSquare[1], 10);
    if (toCol < 0 || toCol > 7 || toRow < 0 || toRow > 7) return { ok: false as const, error: 'illegal' };

    const candidates = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === pieceSymbol && isMoveLegal(r, c, toRow, toCol)) {
          candidates.push({ fromRow: r, fromCol: c });
        }
      }
    }

    if (candidates.length === 1) return { ok: true as const, ...candidates[0], toRow, toCol };
    if (candidates.length > 1 && intent.piece === 'pawn') {
      const oneStep = candidates.filter(c => Math.abs(toRow - c.fromRow) === 1);
      if (oneStep.length === 1) return { ok: true as const, ...oneStep[0], toRow, toCol };
      const sameFile = candidates.filter(c => c.fromCol === toCol);
      if (sameFile.length === 1) return { ok: true as const, ...sameFile[0], toRow, toCol };
      return { ok: false as const, error: 'ambiguous' };
    }
    if (candidates.length > 1) return { ok: false as const, error: 'ambiguous' };
    return { ok: false as const, error: 'illegal' };
  };

  const handleVoiceCommand = (primary: string, alternatives: string[]) => {
    if (winner) {
      setMicFeedback('⚠ Partie terminée.');
      if (voiceEnabled) speak('La partie est terminée.');
      return;
    }
    if (thinking) {
      setMicFeedback('⚠ L\'adversaire réfléchit…');
      return;
    }
    if (mode === 'bot' && currentTurn !== 'white') {
      setMicFeedback("⚠ Ce n'est pas votre tour.");
      return;
    }

    const parsed = parseWithAlternatives(primary, alternatives);
    if (!parsed) {
      setMicFeedback(`❌ Entendu: « ${primary} » — non compris`);
      if (voiceEnabled) speak('Non compris. Répétez en disant par exemple : e quatre.');
      return;
    }

    const resolution = resolveVoiceMove(parsed.intent);
    if (!resolution.ok) {
      if (resolution.error === 'ambiguous') {
        setMicFeedback(`⚠ Ambigu : plusieurs pièces peuvent jouer ce coup.`);
        if (voiceEnabled) speak('Coup ambigu. Précisez la pièce.');
      } else {
        setMicFeedback(`❌ Coup illégal ou impossible.`);
        if (voiceEnabled) speak('Coup impossible.');
      }
      return;
    }

    // Trigger programmatic click sequence for the UI to handle the move natively
    setSelectedSquare(null); // Reset selection just in case
    setPendingClicks([
      { row: resolution.fromRow, col: resolution.fromCol },
      { row: resolution.toRow, col: resolution.toCol }
    ]);
  };

  const { isListening, startListening, stopListening } = useASR({
    onResult: (primary, alternatives) => handleVoiceCommand(primary, alternatives),
    onInterim: (text) => {
      if (text.trim()) setMicFeedback(`🎤 « ${text} »…`);
    },
    onError: (err) => {
      setMicFeedback(`❌ ${err}`);
      if (voiceEnabled) speak(err);
    },
    lang: 'fr-FR',
  });

  const handleMicToggle = () => {
    if (isListening) stopListening();
    else {
      setMicFeedback('');
      startListening();
    }
  };

  useEffect(() => {
    if (pendingClicks.length > 0) {
      const nextClick = pendingClicks[0];
      handleSquareClick(nextClick.row, nextClick.col);
      setPendingClicks(prev => prev.slice(1));
    }
  }, [pendingClicks, selectedSquare]);

  // Timer
  useEffect(() => {
    if (!isTimerActive || winner || thinking) return;

    const interval = setInterval(() => {
      if (currentTurn === 'white') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            setWinner('Noirs');
            setGameStatus('Temps écoulé ! Les noirs ont gagné !');
            setIsTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            setWinner('Blancs');
            setGameStatus('Temps écoulé ! Les blancs ont gagné !');
            setIsTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTurn, isTimerActive, winner, thinking]);

  // Trigger bot move when it's the bot's turn
  useEffect(() => {
    if (mode !== 'bot' || currentTurn !== 'white' || thinking || winner) {
      return;
    }

    // Don't do anything - bot moves are triggered by currentTurn changing to 'black' below
  }, [currentTurn, mode, thinking, winner]);

  // Formater le temps en mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isWhitePiece = (piece: string) => {
    return ['♙', '♖', '♘', '♗', '♕', '♔'].includes(piece);
  };

  const isBlackPiece = (piece: string) => {
    return ['♟', '♜', '♞', '♝', '♛', '♚'].includes(piece);
  };

  const pieceToNotation = (piece: string): string => {
    const notationMap: { [key: string]: string } = {
      '♔': 'K', '♚': 'K',
      '♕': 'Q', '♛': 'Q',
      '♖': 'R', '♜': 'R',
      '♗': 'B', '♝': 'B',
      '♘': 'N', '♞': 'N',
      '♙': '', '♟': '', // Les pions n'ont pas de lettre
    };
    return notationMap[piece] || '';
  };

  const findKing = (boardState: string[][], isWhite: boolean): { row: number; col: number } | null => {
    const kingPiece = isWhite ? '♔' : '♚';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (boardState[row][col] === kingPiece) {
          return { row, col };
        }
      }
    }
    return null;
  };

  const isSquareAttacked = (boardState: string[][], row: number, col: number, byWhite: boolean): boolean => {
    // Vérifier si une case est attaquée par un joueur
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece === '') continue;

        // Vérifier si la pièce appartient à l'attaquant
        const isPieceWhite = isWhitePiece(piece);
        if (isPieceWhite !== byWhite) continue;

        // Vérifier si cette pièce peut légalement attaquer la case cible
        if (isValidMove(boardState, r, c, row, col, true)) {
          return true;
        }
      }
    }
    return false;
  };

  const isPathClear = (boardState: string[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
    const rowDir = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colDir = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;

    let currentRow = fromRow + rowDir;
    let currentCol = fromCol + colDir;

    while (currentRow !== toRow || currentCol !== toCol) {
      if (boardState[currentRow][currentCol] !== '') {
        return false; // Obstacle trouvé
      }
      currentRow += rowDir;
      currentCol += colDir;
    }

    return true;
  };

  const [mlStatus, setMlStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const [stockfishStatus, setStockfishStatus] = useState<'checking' | 'ok' | 'fail'>('checking');

  const checkBackendStatus = async () => {
    // Check ML Bot
    try {
      setMlStatus('checking');
      const ML_URL = ML_BOT_API_URL;
      const response = await fetch(`${ML_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      setMlStatus(response.ok ? 'ok' : 'fail');
    } catch {
      setMlStatus('fail');
    }

    // Check Stockfish
    try {
      setStockfishStatus('checking');
      const SF_URL = STOCKFISH_API_URL;
      const response = await fetch(`${SF_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      setStockfishStatus(response.ok ? 'ok' : 'fail');
    } catch {
      setStockfishStatus('fail');
    }
  };

  // Check backend status on component mount and periodically
  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 30000); // Check every 30 seconds instead of 10
    return () => clearInterval(interval);
  }, []);

  const isValidMove = (boardState: string[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isAttackCheck: boolean = false): boolean => {
    const piece = boardState[fromRow][fromCol];
    const targetPiece = boardState[toRow][toCol];

    //pour ne pas bouffer ses pieces
    if (targetPiece !== '' && (isWhitePiece(piece) === isWhitePiece(targetPiece))) {
      return false;
    }

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    // Pion blanc (♙)
    if (piece === '♙') {
      // Avance simple
      if (colDiff === 0 && rowDiff === -1 && targetPiece === '') {
        return true;
      }
      // Avance double depuis la position initiale
      if (colDiff === 0 && rowDiff === -2 && fromRow === 6 && targetPiece === '' && boardState[fromRow - 1][fromCol] === '') {
        return true;
      }
      // Capture en diagonale (must capture an enemy piece)
      if (absColDiff === 1 && rowDiff === -1 && targetPiece !== '' && !isWhitePiece(targetPiece)) {
        return true;
      }
      // En passant: capture diagonale sur case vide
      if (absColDiff === 1 && rowDiff === -1 && targetPiece === '' && fromRow === 3 && lastEnPassantFile === toCol) {
        return true;
      }
      return false;
    }

    // Pion noir (♟)
    if (piece === '♟') {
      // Avance simple
      if (colDiff === 0 && rowDiff === 1 && targetPiece === '') {
        return true;
      }
      // Avance double depuis la position initiale
      if (colDiff === 0 && rowDiff === 2 && fromRow === 1 && targetPiece === '' && boardState[fromRow + 1][fromCol] === '') {
        return true;
      }
      // Capture en diagonale (must capture an enemy piece)
      if (absColDiff === 1 && rowDiff === 1 && targetPiece !== '' && isWhitePiece(targetPiece)) {
        return true;
      }
      // En passant: capture diagonale sur case vide
      if (absColDiff === 1 && rowDiff === 1 && targetPiece === '' && fromRow === 4 && lastEnPassantFile === toCol) {
        return true;
      }
      return false;
    }

    // Tour (♖, ♜)
    if (piece === '♖' || piece === '♜') {
      if ((rowDiff === 0 || colDiff === 0) && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) {
        return true;
      }
      return false;
    }

    // Cavalier (♘, ♞)
    if (piece === '♘' || piece === '♞') {
      if ((absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2)) {
        return true;
      }
      return false;
    }

    // Fou (♗, ♝)
    if (piece === '♗' || piece === '♝') {
      if (absRowDiff === absColDiff && absRowDiff > 0 && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) {
        return true;
      }
      return false;
    }

    // Reine (♕, ♛)
    if (piece === '♕' || piece === '♛') {
      if ((rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) {
        return true;
      }
      return false;
    }

    // Roi (♔, ♚)
    if (piece === '♔' || piece === '♚') {
      // Mouvement normal du roi (1 case dans n'importe quelle direction)
      if (absRowDiff <= 1 && absColDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
        return true;
      }

      // Castling (grand roque et petit roque)
      if (rowDiff === 0 && absColDiff === 2 && !isAttackCheck) {
        const isWhiteKing = piece === '♔';
        const kingRow = isWhiteKing ? 7 : 0;
        const rookCol = colDiff > 0 ? 7 : 0; // Petit roque = col droite (7), Grand roque = col gauche (0)

        // Vérifier que le roi est en position initiale
        if (fromRow === kingRow && fromCol === 4) {
          // Vérifier que la tour est en place
          const rook = boardState[kingRow][rookCol];
          const isWhiteRook = rook === '♖';
          const isBlackRook = rook === '♜';

          if ((isWhiteKing && isWhiteRook) || (!isWhiteKing && isBlackRook)) {
            // Vérifier que le chemin est dégagé
            if (isPathClear(boardState, fromRow, fromCol, kingRow, rookCol)) {
              // Vérifier que ni le roi ni la tour n'ont bougé
              const kingPieceId = isWhiteKing ? 'K' : 'k';
              const rookPieceId = isWhiteKing ? `R${rookCol}` : `r${rookCol}`;

              const kingHasMoved = movedPieces.has(kingPieceId);
              const rookHasMoved = movedPieces.has(rookPieceId);

              return !kingHasMoved && !rookHasMoved;
            }
          }
        }
      }

      return false;
    }

    return false;
  };

  const isKingInCheck = (boardState: string[][], isWhiteKing: boolean): boolean => {
    const kingPos = findKing(boardState, isWhiteKing);
    if (!kingPos) return false;

    // Vérifier si le roi est attaqué par l'adversaire
    return isSquareAttacked(boardState, kingPos.row, kingPos.col, !isWhiteKing);
  };

  // Vérifier si le joueur a des coups légaux disponibles
  const hasLegalMoves = (boardState: string[][], isWhite: boolean): boolean => {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = boardState[fromRow][fromCol];
        if (piece === '') continue;

        // Vérifier si la pièce appartient au joueur
        const isPieceWhite = isWhitePiece(piece);
        if (isPieceWhite !== isWhite) continue;

        // Tester tous les coups possibles pour cette pièce
        for (let toRow = 0; toRow < 8; toRow++) {
          for (let toCol = 0; toCol < 8; toCol++) {
            // Vérifier que ce n'est pas la case source
            if (toRow === fromRow && toCol === fromCol) continue;

            // Vérifier qu'on n'essaie pas de capturer une pièce alliée
            const targetPiece = boardState[toRow][toCol];
            if (targetPiece !== '' && isWhitePiece(targetPiece) === isWhite) continue;

            if (isValidMove(boardState, fromRow, fromCol, toRow, toCol)) {
              // Simuler le coup
              const testBoard = boardState.map(r => [...r]);
              testBoard[toRow][toCol] = testBoard[fromRow][fromCol];
              testBoard[fromRow][fromCol] = '';

              // Si le roi n'est pas en échec après ce coup, c'est un coup légal
              if (!isKingInCheck(testBoard, isWhite)) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  };

  const checkGameOver = (boardState: string[][], nextPlayerIsWhite: boolean) => {
    // Vérifier si le joueur suivant a des coups légaux
    const canMove = hasLegalMoves(boardState, nextPlayerIsWhite);

    if (!canMove) {
      // Vérifier si le roi est en échec
      const inCheck = isKingInCheck(boardState, nextPlayerIsWhite);

      if (inCheck) {
        // Échec et mat
        if (nextPlayerIsWhite) {
          setGameStatus('Échec et mat ! Les noirs ont gagné !');
          setWinner('Noirs');
          setIsTimerActive(false);
        } else {
          setGameStatus('Échec et mat ! Les blancs ont gagné !');
          setWinner('Blancs');
          setIsTimerActive(false);
        }
        return true;
      } else {
        // Pat (nulle)
        setGameStatus('Pat ! Match nul');
        setWinner('Nul');
        setIsTimerActive(false);
        return true;
      }
    }

    return false;
  };

  const handleSquareClick = (row: number, col: number) => {
    // Si la partie est terminée ou en cours de réflexion, ne rien faire
    if (winner || thinking) return;

    const piece = board[row][col];

    // Si aucune pièce n'est sélectionnée
    if (!selectedSquare) {
      // Vérifier si la pièce appartient au joueur actuel
      if (currentTurn === 'white' && isWhitePiece(piece)) {
        setSelectedSquare({ row, col });
      } else if (currentTurn === 'black' && isBlackPiece(piece)) {
        setSelectedSquare({ row, col });
      }
    } else {
      // Si on clique sur la même case, désélectionner
      if (selectedSquare.row === row && selectedSquare.col === col) {
        setSelectedSquare(null);
        return;
      }

      // Si on clique sur une de nos propres pièces, la sélectionner à la place
      const clickedPiece = board[row][col];
      if (currentTurn === 'white' && isWhitePiece(clickedPiece)) {
        setSelectedSquare({ row, col });
        return;
      }
      if (currentTurn === 'black' && isBlackPiece(clickedPiece)) {
        setSelectedSquare({ row, col });
        return;
      }

      // Déplacer la pièce
      const newBoard = board.map(r => [...r]);
      const movingPiece = newBoard[selectedSquare.row][selectedSquare.col];
      const capturedPiece = newBoard[row][col];

      // Vérifier si le coup est valide selon les règles de la pièce
      if (!isValidMove(board, selectedSquare.row, selectedSquare.col, row, col)) {
        setSelectedSquare(null);
        return;
      }

      // Enregistrer le coup pour l'affichage
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      let move = `${movingPiece} ${files[selectedSquare.col]}${8 - selectedSquare.row} → ${files[col]}${8 - row}`;

      if (capturedPiece) {
        move += ` (capture ${capturedPiece})`;
      }

      // Appliquer le coup et vérifier le castling
      newBoard[row][col] = movingPiece;
      newBoard[selectedSquare.row][selectedSquare.col] = '';

      // Gérer la capture en passant (pion capture en diagonale sur case vide)
      if ((movingPiece === '♙' || movingPiece === '♟') && !capturedPiece && selectedSquare.col !== col) {
        // C'est une capture en diagonale sur case vide - enlever le pion capturé
        const capturedPawnRow = selectedSquare.row; // Le pion capturé est sur la même ligne que la source
        newBoard[capturedPawnRow][col] = '';
        const capturedPawn = movingPiece === '♙' ? '♟' : '♙';
        move = `${movingPiece} ${files[selectedSquare.col]}${8 - selectedSquare.row} → ${files[col]}${8 - row} (en passant ${capturedPawn})`;
      }

      // Gérer le castling (déplacer aussi la tour)
      if ((movingPiece === '♔' || movingPiece === '♚') && Math.abs(col - selectedSquare.col) === 2) {
        const kingRow = selectedSquare.row;
        if (col > selectedSquare.col) {
          // Petit roque (roi se déplace vers la droite)
          const rookCol = 7;
          const rook = newBoard[kingRow][rookCol];
          newBoard[kingRow][5] = rook; // La tour se déplace en col 5
          newBoard[kingRow][rookCol] = '';
          move = `${movingPiece} ${files[selectedSquare.col]}${8 - kingRow} → ${files[col]}${8 - kingRow} (petit roque)`;
        } else {
          // Grand roque (roi se déplace vers la gauche)
          const rookCol = 0;
          const rook = newBoard[kingRow][rookCol];
          newBoard[kingRow][3] = rook; // La tour se déplace en col 3
          newBoard[kingRow][rookCol] = '';
          move = `${movingPiece} ${files[selectedSquare.col]}${8 - kingRow} → ${files[col]}${8 - kingRow} (grand roque)`;
        }
      }

      // Créer la notation PGN standard
      const pieceNotation = pieceToNotation(movingPiece);
      // const fromSquare = `${files[selectedSquare.col]}${8 - selectedSquare.row}`;
      const toSquare = `${files[col]}${8 - row}`;

      // Check for pawn promotion (white pawns reach row 0, black pawns reach row 7)
      if ((movingPiece === '♙' && row === 0) || (movingPiece === '♟' && row === 7)) {
        // Promotion needed - update board with pawn position first, then show promotion dialog
        setBoard(newBoard);
        setPromotionState({
          row,
          col,
          isWhite: movingPiece === '♙',
          fromRow: selectedSquare.row,
          fromCol: selectedSquare.col
        });
        // Store the move info for after promotion
        setSelectedSquare(null);
        return;
      }

      // Vérifier si le roi actuel serait en échec après le coup (coup illégal)
      const isWhiteTurn = currentTurn === 'white';
      if (isKingInCheck(newBoard, isWhiteTurn)) {
        // Coup illégal - on reste en échec ou on se met en échec
        return;
      }

      // Vérifier si on met l'adversaire en échec
      const opponentInCheck = isKingInCheck(newBoard, !isWhiteTurn);

      // Vérifier si la partie est terminée après le coup
      const willBeGameOver = checkGameOver(newBoard, !isWhiteTurn);

      // Construire le coup en notation PGN
      let pgnMove = '';

      // Check for castling
      if ((movingPiece === '♔' || movingPiece === '♚') && Math.abs(col - selectedSquare.col) === 2) {
        // Castling notation in PGN
        if (col > selectedSquare.col) {
          pgnMove = 'O-O'; // King-side castling (petit roque)
        } else {
          pgnMove = 'O-O-O'; // Queen-side castling (grand roque)
        }
      } else if (capturedPiece) {
        // Capture
        if (pieceNotation === '') {
          // Pion qui capture
          pgnMove = `${files[selectedSquare.col]}x${toSquare}`;
        } else {
          pgnMove = `${pieceNotation}x${toSquare}`;
        }
      } else {
        // Déplacement simple
        pgnMove = `${pieceNotation}${toSquare}`;
      }

      // Ajouter # pour échec et mat, ou + pour échec
      if (willBeGameOver) {
        pgnMove += '#';
        move += ' (échec et mat)';
      } else if (opponentInCheck) {
        pgnMove += '+';
        move += ' (échec)';
        setGameStatus('Échec !');
      }
      // Vérifier si le pion avance de deux cases (pour la prise en passant au prochain coup)
      const isPawnDoubleMoveWhite = movingPiece === '♙' && selectedSquare.row === 6 && row === 4;
      const isPawnDoubleMoveBlack = movingPiece === '♟' && selectedSquare.row === 1 && row === 3;

      // Track UCI move for Stockfish
      const fromFile = String.fromCharCode('a'.charCodeAt(0) + selectedSquare.col);
      const fromRank = 8 - selectedSquare.row;
      const toFile = String.fromCharCode('a'.charCodeAt(0) + col);
      const toRank = 8 - row;
      const uciMove = `${fromFile}${fromRank}${toFile}${toRank}`;
      uciMovesRef.current = [...uciMovesRef.current, uciMove];
      console.log('=== PLAYER MOVE TRACKING ===');
      console.log('Player UCI move:', uciMove);
      console.log('All UCI moves:', uciMovesRef.current.join(' '));

      // Détection de blunder: on évalue la position après le coup
      const movesBeforeThis = uciMovesRef.current.slice(0, -1).join(' ');
      const movesAfterThis = uciMovesRef.current.join(' ');
      const moveIdx = uciMovesRef.current.length - 1;
      const moveFrom = { row: selectedSquare.row, col: selectedSquare.col };
      const moveTo = { row, col };

      // on évalue les deux positions de manière asynchrone (on bloque pas le jeu, on décale de 500ms pour permettre au bot de récupérer son coup)
      setTimeout(() => {
        (async () => {
          try {
            // on évalue les deux positions
            const [evalBefore, evalAfter] = await Promise.all([
              evaluatePosition(movesBeforeThis, 10),
              evaluatePosition(movesAfterThis, 10),
            ]);

            //en francais
            // les scores sont calculés du point de vue du joueur qui doit jouer.
            // avant notre coup : c'est notre tour, donc un score positif = bon pour nous.
            // après notre coup : c'est le tour de l'adversaire, donc on inverse le score pour le comparer de notre point de vue.
            const scoreBefore = evalBefore.score;
            const scoreAfter = -evalAfter.score; // on inverse le score car c'est le tour de l'adversaire

            const evalDrop = scoreBefore - scoreAfter;
            console.log(`Eval avant: ${scoreBefore}cp, après: ${scoreAfter}cp, chute: ${evalDrop}cp`);

            let severity: 'inaccuracy' | 'mistake' | 'blunder' | null = null;
            if (evalDrop >= 200) {
              severity = 'blunder';
            } else if (evalDrop >= 100) {
              severity = 'mistake';
            } else if (evalDrop >= 50) {
              severity = 'inaccuracy';
            }

            if (severity) {
              const blunderInfo: BlunderInfo = {
                moveIndex: moveIdx,
                severity,
                evalDrop,
                fromSquare: moveFrom,
                toSquare: moveTo,
              };
              setBlunders(prev => [...prev, blunderInfo]);
              setLastBlunderSquares({ from: moveFrom, to: moveTo, severity });

              // Clear highlight after 3 seconds
              setTimeout(() => setLastBlunderSquares(null), 3000);
            }
          } catch (err) {
            console.error('Erreur détection blunder:', err);
          }
        })();
      }, 500);

      const updatedMoveHistory = [...moveHistory, move];
      setBoard(newBoard);
      setMoveHistory(updatedMoveHistory);
      setPgnMoves([...pgnMoves, pgnMove]);
      setLastMove({ from: [selectedSquare.row, selectedSquare.col], to: [row, col] });
      setSelectedSquare(null);

      // Track pieces that have moved (for castling validation)
      const newMovedPieces = new Set(movedPieces);
      if (movingPiece === '♔' || movingPiece === '♚') {
        newMovedPieces.add(movingPiece === '♔' ? 'K' : 'k');
      } else if (movingPiece === '♖' || movingPiece === '♜') {
        newMovedPieces.add(movingPiece === '♖' ? `R${selectedSquare.col}` : `r${selectedSquare.col}`);
      }
      setMovedPieces(newMovedPieces);

      // Update en passant file if pawn double move
      if (isPawnDoubleMoveWhite || isPawnDoubleMoveBlack) {
        setLastEnPassantFile(col);
      } else {
        setLastEnPassantFile(null);
      }

      // Ajouter l'incrément de temps après le coup
      if (currentTurn === 'white') {
        setWhiteTime(prev => prev + (timeControl?.increment || 0));
      } else {
        setBlackTime(prev => prev + (timeControl?.increment || 0));
      }

      if (!willBeGameOver) {
        setCurrentTurn(currentTurn === 'white' ? 'black' : 'white');
        // Bot move will be triggered by useEffect when turn changes
      } else {
        // Game is over - disable all interaction
        setIsTimerActive(false);
        setSelectedSquare(null);
      }
    }
  };

  // Calculer les coups légaux pour la pièce sélectionnée
  const getLegalMoves = (): { row: number; col: number }[] => {
    if (!selectedSquare) return [];

    const legalMoves: { row: number; col: number }[] = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (isValidMove(board, selectedSquare.row, selectedSquare.col, row, col)) {
          // Vérifier que ce coup ne mettrait pas notre roi en échec
          const testBoard = board.map(r => [...r]);
          testBoard[row][col] = testBoard[selectedSquare.row][selectedSquare.col];
          testBoard[selectedSquare.row][selectedSquare.col] = '';

          const isWhiteTurn = currentTurn === 'white';
          if (!isKingInCheck(testBoard, isWhiteTurn)) {
            legalMoves.push({ row, col });
          }
        }
      }
    }

    return legalMoves;
  };

  const legalMoves = getLegalMoves();

  const handlePromotion = (piece: string) => {
    if (!promotionState) return;

    const newBoard = board.map((r: string[]) => [...r]);
    newBoard[promotionState.row][promotionState.col] = piece;

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const toSquare = `${files[promotionState.col]}${8 - promotionState.row}`;
    const fromSquare = `${files[promotionState.fromCol]}${8 - promotionState.fromRow}`;

    // Build descriptive move string
    const moveStr = `Promotion: ${fromSquare} → ${toSquare} = ${piece}`;

    // Build PGN notation for promotion (e.g., e8=Q)
    const promotedPieceNotation: { [key: string]: string } = {
      '♕': 'Q', '♛': 'Q',
      '♖': 'R', '♜': 'R',
      '♗': 'B', '♝': 'B',
      '♘': 'N', '♞': 'N',
    };
    const pgnMove = `${toSquare}=${promotedPieceNotation[piece] || 'Q'}`;

    // Track UCI move for Stockfish (with promotion piece)
    const uciPromotion = promotedPieceNotation[piece]?.toLowerCase() || 'q';
    const uciMove = `${fromSquare}${toSquare}${uciPromotion}`;
    uciMovesRef.current = [...uciMovesRef.current, uciMove];
    console.log('=== PROMOTION MOVE TRACKING ===');
    console.log('Promotion move:', `${fromSquare}${toSquare}=${promotedPieceNotation[piece] || 'Q'}`);
    console.log('Promotion UCI move:', uciMove);
    console.log('All UCI moves:', uciMovesRef.current.join(' '));
    console.log('===================================');

    const isWhiteTurn = currentTurn === 'white';
    // const opponentInCheck = isKingInCheck(newBoard, !isWhiteTurn);
    const gameOver = checkGameOver(newBoard, !isWhiteTurn);

    // Update board and move history
    setBoard(newBoard);
    setMoveHistory([...moveHistory, moveStr]);
    setPgnMoves([...pgnMoves, pgnMove]);

    // Add increment time
    if (currentTurn === 'white') {
      setWhiteTime((prev: number) => prev + (timeControl?.increment || 0));
    } else {
      setBlackTime((prev: number) => prev + (timeControl?.increment || 0));
    }

    setPromotionState(null);

    if (!gameOver) {
      setCurrentTurn(currentTurn === 'white' ? 'black' : 'white');
      // Bot move will be triggered by useEffect when turn changes
    } else {
      setIsTimerActive(false);
    }
  };

  // Trigger bot move when it's the bot's turn (after makeBotMove is defined)
  useEffect(() => {
    console.log('=== BOT USEEFFECT TRIGGERED ===');
    console.log('Mode:', mode, 'Current turn:', currentTurn, 'Thinking:', thinking, 'Winner:', winner);
    console.log('Bot move in progress:', botMoveInProgress.current);
    console.log('Current UCI moves when bot turn starts:', uciMovesRef.current.join(' '));

    // Early exit conditions - must be bot mode, black's turn, not thinking, no winner, and bot not in progress
    if (!['bot', 'bot_ml'].includes(mode) || currentTurn !== 'black' || thinking || winner || botMoveInProgress.current) {
      console.log('Bot move skipped due to conditions');
      return;
    }

    console.log('✅ Starting bot move process...');

    // Set bot move in progress immediately to prevent race conditions
    botMoveInProgress.current = true;
    setThinking(true);

    const makeBotMove = async () => {
      // Validate engine settings before making a move
      if ((engineSettings.depth === null || engineSettings.depth === undefined) &&
        (engineSettings.movetime === null || engineSettings.movetime === undefined)) {
        console.warn('Engine settings not configured');
        setThinking(false);
        botMoveInProgress.current = false;
        return;
      }

      try {
        // Use the UCI moves ref directly (more reliable than parsing moveHistory)
        const uciMoves = [...uciMovesRef.current];
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

        console.log('Sending UCI moves to Stockfish:', uciMoves.join(' '));

        let bestMove = "";

        if (mode === 'bot_ml') {
          console.log('Appel de votre Bot ML TensorFlow personnalisé...');
          bestMove = await getCustomBotMove(uciMoves.join(' '), 'black');
        } else {
          // Use movetime if set, otherwise use depth
          const modeVal = engineSettings.movetime && engineSettings.movetime > 0 ? 'movetime' : 'depth';
          const depthValue = engineSettings.depth || 15;
          const movetimeValue = engineSettings.movetime || 1000;

          // Appeler Stockfish via l'API backend
          bestMove = await getStockfishBestMove(
            uciMoves.join(' '),
            modeVal,
            'black',
            depthValue,
            movetimeValue
          );
        }

        // Parser le coup retourné par Stockfish (format: "e7e5" ou "e7e8q" pour promotion)
        if (bestMove && bestMove.length >= 4) {
          const fromCol = bestMove.charCodeAt(0) - 'a'.charCodeAt(0);
          const fromRow = 8 - parseInt(bestMove[1]);
          const toCol = bestMove.charCodeAt(2) - 'a'.charCodeAt(0);
          const toRow = 8 - parseInt(bestMove[3]);

          // Check for promotion piece (5th character: q, r, b, n)
          let promotionPiece: string | null = null;
          if (bestMove.length === 5) {
            const promoPiece = bestMove[4].toLowerCase();
            // Map UCI promotion chars to chess pieces (black pieces for bot)
            const promoMap: { [key: string]: string } = {
              'q': '♛', // Queen
              'r': '♜', // Rook
              'b': '♝', // Bishop
              'n': '♞'  // Knight
            };
            promotionPiece = promoMap[promoPiece] || '♛'; // Default to queen
          }

          // Use the current board state directly - this should match what was sent to Stockfish
          const currentBoard = [...board.map((r: string[]) => [...r])];

          // Enhanced debugging - log current board state and UCI moves
          const fromSquare = bestMove.substring(0, 2);
          const toSquare = bestMove.substring(2, 4);
          const piece = currentBoard[fromRow]?.[fromCol];
          const targetPiece = currentBoard[toRow]?.[toCol];

          console.log('=== BOT MOVE ANALYSIS ===');
          console.log('UCI moves sent to Stockfish:', uciMovesRef.current.join(' '));
          console.log('Stockfish returned move:', bestMove);
          console.log(`Parsed move: ${fromSquare} → ${toSquare} (fromRow: ${fromRow}, fromCol: ${fromCol}, toRow: ${toRow}, toCol: ${toCol})`);
          console.log('Piece at source position:', piece);
          console.log('Piece at target position:', targetPiece);
          console.log('Current board state:');
          console.log(currentBoard.map((row: string[]) =>
            row.map((cell: string) => cell || '.').join(' ')
          ).join('\n'));

          // Check if the coordinates are valid first
          if (fromRow < 0 || fromRow >= 8 || fromCol < 0 || fromCol >= 8 ||
            toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) {
            console.error('Invalid coordinates:', { fromRow, fromCol, toRow, toCol });
            setThinking(false);
            botMoveInProgress.current = false;
            return;
          }

          // Check if there's actually a piece at the source
          if (!piece || piece === '') {
            console.error('No piece at source position');
            setThinking(false);
            botMoveInProgress.current = false;
            return;
          }

          // Check if it's a black piece (bot should only move black pieces)
          if (isWhitePiece(piece)) {
            console.error('Bot trying to move white piece');
            setThinking(false);
            botMoveInProgress.current = false;
            return;
          }

          // Valider le coup
          if (!isValidMove(currentBoard, fromRow, fromCol, toRow, toCol)) {
            console.error('Invalid move returned by Stockfish:', bestMove);
            console.error('Move validation failed for:', { fromRow, fromCol, toRow, toCol, piece, targetPiece });
            console.error('Expected move format: UCI notation (e.g., e7e5)');
            setThinking(false);
            botMoveInProgress.current = false;
            return;
          }

          console.log('✅ Move validation passed');

          const newBoard = currentBoard;
          const movingPiece = newBoard[fromRow][fromCol];
          const capturedPiece = newBoard[toRow][toCol];

          // Appliquer le coup
          newBoard[toRow][toCol] = movingPiece;
          newBoard[fromRow][fromCol] = '';

          // Gérer la capture en passant
          if ((movingPiece === '♙' || movingPiece === '♟') && !capturedPiece && fromCol !== toCol) {
            // C'est une capture en diagonale sur case vide - enlever le pion capturé
            const capturedPawnRow = fromRow; // Le pion capturé est sur la même ligne que la source
            newBoard[capturedPawnRow][toCol] = '';
          }

          // Gérer le castling (déplacer aussi la tour)
          if ((movingPiece === '♔' || movingPiece === '♚') && Math.abs(toCol - fromCol) === 2) {
            const kingRow = fromRow;
            if (toCol > fromCol) {
              // Petit roque (roi se déplace vers la droite)
              const rookCol = 7;
              const rook = newBoard[kingRow][rookCol];
              newBoard[kingRow][5] = rook;
              newBoard[kingRow][rookCol] = '';
            } else {
              // Grand roque (roi se déplace vers la gauche)
              const rookCol = 0;
              const rook = newBoard[kingRow][rookCol];
              newBoard[kingRow][3] = rook;
              newBoard[kingRow][rookCol] = '';
            }
          }

          // Handle black pawn promotion
          if (movingPiece === '♟' && toRow === 7) {
            // Use the promotion piece from Stockfish move, or default to queen
            newBoard[toRow][toCol] = promotionPiece || '♛';
          }
          // Handle white pawn promotion (for completeness, though bot plays black)
          if (movingPiece === '♙' && toRow === 0) {
            // Map to white pieces for white promotion
            const whitePromoMap: { [key: string]: string } = {
              '♛': '♕', '♜': '♖', '♝': '♗', '♞': '♘'
            };
            newBoard[toRow][toCol] = promotionPiece ? (whitePromoMap[promotionPiece] || '♕') : '♕';
          }

          // Construire la notation descriptive
          let moveStr = `${movingPiece} ${files[fromCol]}${8 - fromRow} → ${files[toCol]}${8 - toRow}`;
          if (capturedPiece) {
            moveStr += ` (capture ${capturedPiece})`;
          }
          moveStr += mode === 'bot_ml' ? ' (Bot ML)' : ' (Stockfish)';

          // Construire la notation PGN
          const pieceNotation = pieceToNotation(movingPiece);
          const toSquareNotation = `${files[toCol]}${8 - toRow}`;

          let pgnMove = '';
          if (capturedPiece) {
            if (pieceNotation === '') {
              pgnMove = `${files[fromCol]}x${toSquareNotation}`;
            } else {
              pgnMove = `${pieceNotation}x${toSquareNotation}`;
            }
          } else {
            pgnMove = `${pieceNotation}${toSquareNotation}`;
          }

          // Vérifier si le roi blanc est en échec
          const whiteInCheck = isKingInCheck(newBoard, true);
          const gameOver = checkGameOver(newBoard, true);  // Check if white (next player) has legal moves

          if (gameOver) {
            pgnMove += '#';
            moveStr += ' (échec et mat)';
          } else if (whiteInCheck) {
            pgnMove += '+';
            moveStr += ' (échec)';
            setGameStatus('Échec !');
          }

          // Track UCI move for Stockfish (use the original bestMove which may include promotion)
          uciMovesRef.current = [...uciMovesRef.current, bestMove];
          console.log('=== BOT MOVE TRACKING ===');
          console.log('Bot UCI move added:', bestMove);
          console.log('Complete UCI game:', uciMovesRef.current.join(' '));
          console.log('==========================');

          setBoard(newBoard);
          setMoveHistory((prev: string[]) => [...prev, moveStr]);
          setPgnMoves((prev: string[]) => [...prev, pgnMove]);
          setLastMove({ from: [fromRow, fromCol], to: [toRow, toCol] });

          // Track pieces that have moved (for castling validation)
          const newMovedPieces = new Set(movedPieces);
          if (movingPiece === '♔' || movingPiece === '♚') {
            newMovedPieces.add(movingPiece === '♔' ? 'K' : 'k');
          } else if (movingPiece === '♖' || movingPiece === '♜') {
            newMovedPieces.add(movingPiece === '♖' ? `R${fromCol}` : `r${fromCol}`);
          }
          setMovedPieces(newMovedPieces);

          // Update en passant file if pawn double move
          const isPawnDoubleMoveBlack = movingPiece === '♟' && fromRow === 1 && toRow === 3;
          if (isPawnDoubleMoveBlack) {
            setLastEnPassantFile(toCol);
          } else {
            setLastEnPassantFile(null);
          }

          // Ajouter l'incrément de temps
          setBlackTime((prev: number) => prev + (timeControl?.increment || 0));

          if (!gameOver) {
            setCurrentTurn('white');
          } else {
            // Game is over - disable timer and interaction
            setIsTimerActive(false);
            setSelectedSquare(null);
          }
        }
      } catch (error) {
        console.error('Bot move failed:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('Backend server not responding')) {
          setGameStatus('Erreur: Le serveur backend n\'est pas disponible. Veuillez le redémarrer.');
        } else if (errorMessage.includes('Failed to fetch')) {
          setGameStatus('Erreur: Connexion au serveur interrompue.');
        } else {
          setGameStatus(`Erreur Stockfish: ${errorMessage}`);
        }

        // Don't show alert for network errors, just update game status
        if (!errorMessage.includes('Backend server not responding') && !errorMessage.includes('Failed to fetch')) {
          alert('Erreur Stockfish: ' + errorMessage);
        }
      } finally {
        setThinking(false);
        botMoveInProgress.current = false;
      }
    };

    // Execute bot move with a small delay to allow state to settle
    const timer = setTimeout(() => {
      makeBotMove();
    }, 100);

    return () => clearTimeout(timer);
  }, [currentTurn, mode, winner]); // Removed thinking and engineSettings to prevent loops

  // ── Sauvegarder la partie au backend quand elle se termine ──────────────
  useEffect(() => {
    if (!winner) return;

    // Construire le PGN complet
    let formattedMoves = '';
    for (let i = 0; i < pgnMoves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = pgnMoves[i];
      const blackMove = pgnMoves[i + 1];
      formattedMoves += blackMove
        ? `${moveNumber}. ${whiteMove} ${blackMove} `
        : `${moveNumber}. ${whiteMove} `;
    }

    let result = '1/2-1/2';
    if (winner === 'Blancs') result = '1-0';
    if (winner === 'Noirs') result = '0-1';

    const opponentName = mode === 'bot' ? 'Stockfish Bot'
      : mode === 'bot_ml' ? 'ML Bot'
      : 'Joueur 2';

    const fullPgn = formattedMoves.trim() + ' ' + result;

    createPartieJouee({
      titre: `Partie vs ${opponentName}`,
      joueurBlanc: username,
      joueurNoir: opponentName,
      resultat: result,
      variant: 'standard',
      ouverture: 'Partie locale',
      source: 'app',
      vainqueur: winner === 'Blancs' ? 'blanc' : winner === 'Noirs' ? 'noir' : 'nul',
      nombreCoups: pgnMoves.length,
      pgn: fullPgn,
      resumeAnalyse: gameStatus,
    })
      .then(() => console.log('\u2705 Partie sauvegard\u00e9e dans l\'historique'))
      .catch((err) => console.error('\u274c Erreur sauvegarde partie:', err));
  }, [winner]); // Se d\u00e9clenche uniquement quand winner passe de null \u00e0 une valeur

  const resetGame = () => {
    setBoard(INITIAL_BOARD);
    setMoveHistory([]);
    setPgnMoves([]);
    uciMovesRef.current = []; // Reset UCI moves for Stockfish
    setSelectedSquare(null);
    setCurrentTurn('white');
    setGameStatus('En cours');
    setWinner(null);
    setWhiteTime((timeControl?.minutes || 5) * 60);
    setBlackTime((timeControl?.minutes || 5) * 60);
    setIsTimerActive(true);
    setPromotionState(null);
    setMovedPieces(new Set());
    setLastEnPassantFile(null);
    setBlunders([]);
    setLastBlunderSquares(null);
    lastEvalRef.current = null;
  };

  const exportPGN = () => {
    // Formater les coups par paires (blancs, noirs)
    let formattedMoves = '';
    for (let i = 0; i < pgnMoves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = pgnMoves[i];
      const blackMove = pgnMoves[i + 1];

      if (blackMove) {
        formattedMoves += `${moveNumber}. ${whiteMove} ${blackMove}\n`;
      } else {
        formattedMoves += `${moveNumber}. ${whiteMove}\n`;
      }
    }

    // Ajouter le résultat
    let result = '1/2-1/2'; // Match nul par défaut
    if (winner === 'Blancs') result = '1-0';
    if (winner === 'Noirs') result = '0-1';

    const pgn = `[Event "Chess Game"]
[Site "ChessMate"]
[Date "${new Date().toISOString().split('T')[0]}"]
[Round "1"]
[White "${username}"]
[Black "${mode === 'bot' ? 'Stockfish Bot' : mode === 'bot_ml' ? 'ML Bot' : 'Joueur 2'}"]
[Result "${result}"]

${formattedMoves}${result}`;

    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-game-${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const analyzeWithStockfish = async () => {
    try {
      const uciMoves = uciMovesRef.current.join(' ');
      const result = await analyzePosition(uciMoves, 20);

      const blunderCount = blunders.filter(b => b.severity === 'blunder').length;
      const mistakeCount = blunders.filter(b => b.severity === 'mistake').length;
      const inaccuracyCount = blunders.filter(b => b.severity === 'inaccuracy').length;

      alert(
        `Analyse Stockfish complétée!\n\n` +
        `Évaluation: ${result.evaluation > 0 ? '+' : ''}${(result.evaluation / 100).toFixed(2)}\n` +
        `Meilleur coup: ${result.bestmove}\n` +
        `Position: ${moveHistory.length} coups joués\n\n` +
        `--- Résumé des erreurs ---\n` +
        `🔴 Blunders: ${blunderCount}\n` +
        `🟠 Erreurs: ${mistakeCount}\n` +
        `🟡 Imprécisions: ${inaccuracyCount}`
      );
    } catch (error) {
      console.error('Erreur analyse Stockfish:', error);
      alert('Erreur lors de l\'analyse: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-gray-900 mb-2">
            {mode === 'bot' ? 'Jouer contre Stockfish' : 'Jouer aux échecs'}
          </h2>
          <p className="text-gray-600">
            {mode === 'bot'
              ? 'Affrontez le moteur d\'échecs Stockfish'
              : 'Jouez une partie libre'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <VoiceToggle
            enabled={voiceEnabled}
            onToggle={handleVoiceToggle}
            isSupported={voiceSupported}
          />
          <MicButton
            isListening={isListening}
            onToggle={handleMicToggle}
            feedback={micFeedback}
            isSupported={voiceSupported}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Échiquier */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-xl p-8 border border-slate-200">
            {/* Indicateurs de joueurs */}
            <div className="flex justify-center items-center mb-6">
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 ${currentTurn === 'white' && !winner
                ? 'bg-white shadow-lg ring-2 ring-blue-500 scale-105'
                : 'bg-white/50 shadow'
                }`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 border-2 border-slate-400 flex items-center justify-center">
                  <Circle className="w-4 h-4 text-slate-700 fill-white" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Blancs</div>
                  <div className={`text-lg font-mono ${whiteTime < 30 ? 'text-red-600 animate-pulse' : 'text-gray-900'
                    }`}>
                    {formatTime(whiteTime)}
                  </div>
                </div>
                {currentTurn === 'white' && !winner && (
                  <div className="ml-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 ${currentTurn === 'black' && !winner
                ? 'bg-slate-800 shadow-lg ring-2 ring-purple-500 scale-105'
                : 'bg-slate-800/50 shadow'
                }`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600 flex items-center justify-center">
                  <Circle className="w-4 h-4 text-slate-300 fill-slate-800" />
                </div>
                <div>
                  <div className="text-sm text-slate-200">Noirs</div>
                  <div className={`text-lg font-mono ${blackTime < 30 ? 'text-red-400 animate-pulse' : 'text-slate-100'
                    }`}>
                    {formatTime(blackTime)}
                  </div>
                </div>
                {currentTurn === 'black' && !winner && (
                  <div className="ml-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-2xl mx-auto">
              {/* Échiquier avec coordonnées */}
              <div className="inline-block">
                {/* Échiquier */}
                <div className="flex">
                  {/* Colonne de chiffres à gauche */}
                  <div className="flex flex-col justify-around pr-2">
                    {[8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                      <div key={num} className="h-16 sm:h-20 flex items-center justify-center text-slate-600 font-mono text-sm">
                        {num}
                      </div>
                    ))}
                  </div>

                <div className="flex flex-col items-center">
                  {/* Info Joueur Haut (Noir ou Bot) */}
                  <div className="mb-4 flex items-center gap-4 bg-slate-800 text-white px-6 py-2 rounded-xl shadow-lg border border-slate-700 w-full max-w-md justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs">🤖</div>
                      <span className="font-bold">{mode === 'bot' ? 'Stockfish' : mode === 'bot_ml' ? 'Bot ML' : 'Adversaire'}</span>
                    </div>
                    <div className="text-amber-400 font-mono font-bold">ELO: {mode === 'human' ? '?' : (mode === 'bot_ml' ? 1800 : 3500)}</div>
                  </div>

                  {/* Échiquier principal */}
                  <div className="border-8 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                    {board.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex">
                        {row.map((piece, colIndex) => {
                          const isLight = (rowIndex + colIndex) % 2 === 0;
                          const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                          const isLegalMove = legalMoves.some(move => move.row === rowIndex && move.col === colIndex);
                          const isLastMove = lastMove && (
                            (lastMove.from[0] === rowIndex && lastMove.from[1] === colIndex) ||
                            (lastMove.to[0] === rowIndex && lastMove.to[1] === colIndex)
                          );
                          const squareId = `${rowIndex}-${colIndex}`;
                          const isMarked = markedSquares.includes(squareId);
                          const isBlunderSquare = lastBlunderSquares && (
                            (lastBlunderSquares.from.row === rowIndex && lastBlunderSquares.from.col === colIndex) ||
                            (lastBlunderSquares.to.row === rowIndex && lastBlunderSquares.to.col === colIndex)
                          );
                          const blunderColor = isBlunderSquare
                            ? lastBlunderSquares?.severity === 'blunder' ? 'ring-red-500 bg-red-500/20'
                              : lastBlunderSquares?.severity === 'mistake' ? 'ring-orange-500 bg-orange-400/20'
                                : 'ring-yellow-500 bg-yellow-400/20'
                            : '';

                          const handleRightClick = (e: React.MouseEvent) => {
                            e.preventDefault();
                            setMarkedSquares(prev =>
                              prev.includes(squareId) ? prev.filter(id => id !== squareId) : [...prev, squareId]
                            );
                          };

                          return (
                            <button
                              key={`${rowIndex}-${colIndex}`}
                              onClick={() => {
                                // If nothing selected and clicking empty square, mark it as requested by "click gauche" constraint
                                if (!selectedSquare && !piece) {
                                  setMarkedSquares(prev => prev.includes(squareId) ? prev.filter(id => id !== squareId) : [...prev, squareId]);
                                } else {
                                  handleSquareClick(rowIndex, colIndex);
                                }
                              }}
                              onContextMenu={handleRightClick}
                              disabled={thinking}
                              className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-5xl sm:text-6xl transition-all duration-200 relative ${isLight
                                ? isLastMove ? 'bg-amber-100/80 saturate-150' : 'bg-gradient-to-br from-amber-50 to-amber-100'
                                : isLastMove ? 'bg-amber-700/80 saturate-150' : 'bg-gradient-to-br from-amber-600 to-amber-800'
                                } ${isSelected
                                  ? 'ring-4 ring-blue-500 ring-inset scale-95 shadow-inner'
                                  : ''
                                } ${isBlunderSquare ? `ring-4 ring-inset ${blunderColor} animate-pulse` : ''
                                } ${!winner && !thinking ? 'hover:brightness-110 active:scale-95' : 'cursor-default'
                                } ${thinking ? 'opacity-60' : ''
                                }`}
                            >
                              {piece && (
                                (() => {
                                  const imageMap: { [key: string]: string } = {
                                    '♔': 'wK', '♕': 'wQ', '♖': 'wR', '♗': 'wB', '♘': 'wN', '♙': 'wP',
                                    '♚': 'bK', '♛': 'bQ', '♜': 'bR', '♝': 'bB', '♞': 'bN', '♟': 'bP',
                                  };
                                  const code = imageMap[piece];
                                  if (!code) return <span className="text-4xl">{piece}</span>;
                                  return (
                                    <img
                                      src={`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${code}.svg`}
                                      alt={piece}
                                      className={`absolute inset-0 m-auto w-[85%] h-[85%] object-contain drop-shadow-xl pointer-events-none select-none transition-transform ${isSelected ? 'scale-110' : ''}`}
                                      draggable={false}
                                    />
                                  );
                                })()
                              )}
                              {isMarked && (
                                <div className="absolute inset-0 ring-4 ring-green-500 ring-inset bg-green-500/20 pointer-events-none rounded-lg" />
                              )}
                              {isLegalMove && (
                                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                                  {board[rowIndex][colIndex] === '' ? (
                                    <div className="w-6 h-6 bg-red-600/70 rounded-full shadow-lg" />
                                  ) : (
                                    <div className="absolute inset-0 bg-transparent rounded-sm ring-4 ring-red-600/70 ring-inset" />
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 bg-white text-slate-900 px-6 py-2 rounded-xl shadow-lg border border-slate-200 w-full max-w-md justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">VS</div>
                    <span className="font-bold">{username} (Vous)</span>
                  </div>
                  <div className="text-blue-600 font-mono font-bold">ELO: {userElo}</div>
                </div>
              </div>

                {/* Ligne de lettres en bas */}
                <div className="flex pl-8">
                  {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((letter) => (
                    <div key={letter} className="w-16 sm:w-20 flex items-center justify-center pt-2 text-slate-600 font-mono text-sm">
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Promotion Dialog */}
            {promotionState && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
                  <h3 className="text-gray-900 mb-6 text-center text-lg font-semibold">
                    Choisissez la promotion
                  </h3>
                  <div className="flex gap-4 justify-center">
                    {promotionState.isWhite ? (
                      <>
                        <button
                          onClick={() => handlePromotion('♕')}
                          className="w-16 h-16 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all text-4xl shadow-md"
                        >
                          ♕
                        </button>
                        <button
                          onClick={() => handlePromotion('♖')}
                          className="w-16 h-16 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all text-4xl shadow-md"
                        >
                          ♖
                        </button>
                        <button
                          onClick={() => handlePromotion('♗')}
                          className="w-16 h-16 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all text-4xl shadow-md"
                        >
                          ♗
                        </button>
                        <button
                          onClick={() => handlePromotion('♘')}
                          className="w-16 h-16 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all text-4xl shadow-md"
                        >
                          ♘
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePromotion('♛')}
                          className="w-16 h-16 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all text-4xl shadow-md"
                        >
                          ♛
                        </button>
                        <button
                          onClick={() => handlePromotion('♜')}
                          className="w-16 h-16 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all text-4xl shadow-md"
                        >
                          ♜
                        </button>
                        <button
                          onClick={() => handlePromotion('♝')}
                          className="w-16 h-16 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all text-4xl shadow-md"
                        >
                          ♝
                        </button>
                        <button
                          onClick={() => handlePromotion('♞')}
                          className="w-16 h-16 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all text-4xl shadow-md"
                        >
                          ♞
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Statut de la partie */}
            <div className="mt-8 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${mlStatus === 'ok' ? 'bg-green-500' : mlStatus === 'checking' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">
                  ML Bot: {mlStatus === 'ok' ? 'Online' : mlStatus === 'checking' ? 'Connecting...' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stockfishStatus === 'ok' ? 'bg-green-500' : stockfishStatus === 'checking' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">
                  Stockfish: {stockfishStatus === 'ok' ? 'Online' : stockfishStatus === 'checking' ? 'Connecting...' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className={`px-6 py-3 rounded-xl transition-all duration-300 ${winner
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 shadow-lg ring-2 ring-yellow-600 scale-105'
                : gameStatus === 'Échec !'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-pulse'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md'
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${winner ? 'bg-yellow-900' : 'bg-white'}`} />
                  <span>{gameStatus}</span>
                </div>
              </div>

              {mode === 'bot' && (engineSettings.depth === null && engineSettings.movetime === null) && !thinking && (
                <div className="flex items-center gap-3 px-5 py-3 bg-amber-100 rounded-xl shadow-md border border-amber-300">
                  <span className="text-amber-800">⚠️ Configurez la profondeur ou le temps</span>
                </div>
              )}

              {thinking && (
                <div className="flex items-center gap-3 px-5 py-3 bg-purple-100 rounded-xl shadow-md border border-purple-200">
                  <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
                  <span className="text-purple-800">
                    {mode === 'bot_ml' ? 'Le Bot ML réfléchit...' : 'Stockfish réfléchit...'}
                  </span>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                Nouvelle partie
              </button>
              <button
                onClick={exportPGN}
                disabled={moveHistory.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                Exporter PGN
              </button>
              <button
                onClick={analyzeWithStockfish}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                <Brain className="w-5 h-5" />
                Analyser
              </button>
            </div>
          </div>
        </div>

        {/* Historique des coups */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
            <h3 className="text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
              Historique des coups
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {moveHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Circle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    Aucun coup joué
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {moveHistory.map((move, index) => (
                    <div
                      key={index}
                      className={`px-4 py-3 rounded-xl text-sm transition-all duration-200 ${index === moveHistory.length - 1
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 px-2 py-0.5 rounded text-xs ${index % 2 === 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                          }`}>
                          {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'}
                        </span>
                        <span className="text-gray-900 flex-1">{move}</span>
                        {blunders.find(b => b.moveIndex === index) && (
                          <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold ${blunders.find(b => b.moveIndex === index)?.severity === 'blunder'
                            ? 'bg-red-100 text-red-700'
                            : blunders.find(b => b.moveIndex === index)?.severity === 'mistake'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {blunders.find(b => b.moveIndex === index)?.severity === 'blunder' ? '🔴 Blunder'
                              : blunders.find(b => b.moveIndex === index)?.severity === 'mistake' ? '🟠 Erreur'
                                : '🟡 Imprécis'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
                <span className="text-sm text-slate-600">Total coups:</span>
                <span className="px-3 py-1 bg-white rounded-md shadow-sm text-slate-900">
                  {moveHistory.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
