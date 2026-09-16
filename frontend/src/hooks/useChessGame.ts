import { useState, useEffect, useRef } from 'react';
import { getStockfishBestMove, evaluatePosition } from '../services/api';

export interface BlunderInfo {
  moveIndex: number;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  evalDrop: number;
  fromSquare: { row: number; col: number };
  toSquare: { row: number; col: number };
}

export interface EngineSettings {
  depth: number | null;
  movetime: number | null;
}

export const INITIAL_BOARD = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

export function isWhitePiece(piece: string) {
  return ['♙', '♖', '♘', '♗', '♕', '♔'].includes(piece);
}

export function isBlackPiece(piece: string) {
  return ['♟', '♜', '♞', '♝', '♛', '♚'].includes(piece);
}

export function pieceToNotation(piece: string): string {
  const notationMap: { [key: string]: string } = {
    '♔': 'K', '♚': 'K',
    '♕': 'Q', '♛': 'Q',
    '♖': 'R', '♜': 'R',
    '♗': 'B', '♝': 'B',
    '♘': 'N', '♞': 'N',
    '♙': '', '♟': '', // Les pions n'ont pas de lettre
  };
  return notationMap[piece] || '';
}

export function findKing(boardState: string[][], isWhite: boolean): { row: number; col: number } | null {
  const kingPiece = isWhite ? '♔' : '♚';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (boardState[row][col] === kingPiece) {
        return { row, col };
      }
    }
  }
  return null;
}

export function useChessGame({
  mode,
  timeControl,
  engineSettings: passedEngineSettings,
  isAnalysisMode = false
}: {
  mode: 'human' | 'bot';
  timeControl?: { minutes: number; increment: number; };
  engineSettings?: { depth: number | null; movetime: number | null; useDepth: boolean; } | null;
  isAnalysisMode?: boolean;
}) {
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [pgnMoves, setPgnMoves] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<string>('En cours');
  const [thinking, setThinking] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [whiteTime, setWhiteTime] = useState((timeControl?.minutes || 5) * 60);
  const [blackTime, setBlackTime] = useState((timeControl?.minutes || 5) * 60);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [movedPieces, setMovedPieces] = useState<Set<string>>(new Set());
  const [lastEnPassantFile, setLastEnPassantFile] = useState<number | null>(null);
  const uciMovesRef = useRef<string[]>([]);
  const [blunders, setBlunders] = useState<BlunderInfo[]>([]);
  const [lastBlunderSquares, setLastBlunderSquares] = useState<{ from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null>(null);
  const lastEvalRef = useRef<number | null>(null);

  const [promotionState, setPromotionState] = useState<{
    row: number;
    col: number;
    isWhite: boolean;
    fromRow: number;
    fromCol: number;
  } | null>(null);

  const [engineSettings] = useState<EngineSettings>(() => {
    if (passedEngineSettings) {
      if (passedEngineSettings.useDepth) {
        return { depth: passedEngineSettings.depth, movetime: null };
      } else {
        return { depth: null, movetime: passedEngineSettings.movetime };
      }
    }
    return { depth: 10, movetime: null };
  });

  const [currentEval, setCurrentEval] = useState<number | null>(null);
  const [currentBestMove, setCurrentBestMove] = useState<string | null>(null);

  //mode d'analyse en direct
  useEffect(() => {
    if (!isAnalysisMode || gameStatus !== 'En cours') {
      setCurrentEval(null);
      setCurrentBestMove(null);
      return;
    }

    let isMounted = true;
    const fetchAnalysis = async () => {
      try {
        const movesStr = uciMovesRef.current.join(' ');
        const result = await evaluatePosition(movesStr, 12); // Depth 12 for live analysis
        if (isMounted) {
          // Stockfish returns score relative to side to move.
          // Convert to absolute score (+ is white advantage, - is black advantage)
          const isWhiteTurn = currentTurn === 'white';
          setCurrentEval(isWhiteTurn ? result.score : -result.score);
          setCurrentBestMove(result.bestMove);
        }
      } catch (err) {
        console.error('Analysis fetch error', err);
      }
    };

    // Debounce pour éviter de spammer le moteur si l'utilisateur bouge rapidement
    const timeout = setTimeout(fetchAnalysis, 400);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [currentTurn, isAnalysisMode, gameStatus]);

  const botMoveInProgress = useRef(false);

  // Logique du chronomètre
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

  const isSquareAttacked = (boardState: string[][], row: number, col: number, byWhite: boolean): boolean => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece === '') continue;
        const isPieceWhite = isWhitePiece(piece);
        if (isPieceWhite !== byWhite) continue;
        if (isValidMoveInternal(boardState, r, c, row, col, true)) {
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
      if (boardState[currentRow][currentCol] !== '') return false;
      currentRow += rowDir;
      currentCol += colDir;
    }
    return true;
  };

  const isValidMoveInternal = (boardState: string[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isAttackCheck: boolean = false): boolean => {
    const piece = boardState[fromRow][fromCol];
    const targetPiece = boardState[toRow][toCol];

    // Ne peut pas capturer ses propres pièces!
    if (targetPiece !== '' && (isWhitePiece(piece) === isWhitePiece(targetPiece))) {
      return false;
    }

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    if (piece === '♙') {
      if (colDiff === 0 && rowDiff === -1 && targetPiece === '') return true;
      if (colDiff === 0 && rowDiff === -2 && fromRow === 6 && targetPiece === '' && boardState[fromRow - 1][fromCol] === '') return true;
      if (absColDiff === 1 && rowDiff === -1 && targetPiece !== '' && !isWhitePiece(targetPiece)) return true;
      if (absColDiff === 1 && rowDiff === -1 && targetPiece === '' && fromRow === 3 && lastEnPassantFile === toCol) return true;
      return false;
    }

    if (piece === '♟') {
      if (colDiff === 0 && rowDiff === 1 && targetPiece === '') return true;
      if (colDiff === 0 && rowDiff === 2 && fromRow === 1 && targetPiece === '' && boardState[fromRow + 1][fromCol] === '') return true;
      if (absColDiff === 1 && rowDiff === 1 && targetPiece !== '' && isWhitePiece(targetPiece)) return true;
      if (absColDiff === 1 && rowDiff === 1 && targetPiece === '' && fromRow === 4 && lastEnPassantFile === toCol) return true;
      return false;
    }

    if (piece === '♖' || piece === '♜') {
      if ((rowDiff === 0 || colDiff === 0) && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) return true;
      return false;
    }

    if (piece === '♘' || piece === '♞') {
      if ((absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2)) return true;
      return false;
    }

    if (piece === '♗' || piece === '♝') {
      if (absRowDiff === absColDiff && absRowDiff > 0 && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) return true;
      return false;
    }

    if (piece === '♕' || piece === '♛') {
      if ((rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) && isPathClear(boardState, fromRow, fromCol, toRow, toCol)) return true;
      return false;
    }

    if (piece === '♔' || piece === '♚') {
      if (absRowDiff <= 1 && absColDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) return true;
      if (rowDiff === 0 && absColDiff === 2 && !isAttackCheck) {
        const isWhiteKing = piece === '♔';
        const kingRow = isWhiteKing ? 7 : 0;
        const rookCol = colDiff > 0 ? 7 : 0;
        if (fromRow === kingRow && fromCol === 4) {
          const rook = boardState[kingRow][rookCol];
          const isWhiteRook = rook === '♖';
          const isBlackRook = rook === '♜';
          if ((isWhiteKing && isWhiteRook) || (!isWhiteKing && isBlackRook)) {
            if (isPathClear(boardState, fromRow, fromCol, kingRow, rookCol)) {
              const kingPieceId = isWhiteKing ? 'K' : 'k';
              const rookPieceId = isWhiteKing ? `R${rookCol}` : `r${rookCol}`;
              return !movedPieces.has(kingPieceId) && !movedPieces.has(rookPieceId);
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
    return isSquareAttacked(boardState, kingPos.row, kingPos.col, !isWhiteKing);
  };

  const hasLegalMoves = (boardState: string[][], isWhite: boolean): boolean => {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = boardState[fromRow][fromCol];
        if (piece === '') continue;
        if (isWhitePiece(piece) !== isWhite) continue;

        for (let toRow = 0; toRow < 8; toRow++) {
          for (let toCol = 0; toCol < 8; toCol++) {
            if (toRow === fromRow && toCol === fromCol) continue;
            const targetPiece = boardState[toRow][toCol];
            if (targetPiece !== '' && isWhitePiece(targetPiece) === isWhite) continue;

            if (isValidMoveInternal(boardState, fromRow, fromCol, toRow, toCol)) {
              const testBoard = boardState.map(r => [...r]);
              testBoard[toRow][toCol] = testBoard[fromRow][fromCol];
              testBoard[fromRow][fromCol] = '';
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
    const canMove = hasLegalMoves(boardState, nextPlayerIsWhite);
    if (!canMove) {
      const inCheck = isKingInCheck(boardState, nextPlayerIsWhite);
      if (inCheck) {
        if (nextPlayerIsWhite) {
          setGameStatus('Échec et mat ! Les noirs ont gagné !');
          setWinner('Noirs');
        } else {
          setGameStatus('Échec et mat ! Les blancs ont gagné !');
          setWinner('Blancs');
        }
        setIsTimerActive(false);
        return true;
      } else {
        setGameStatus('Pat ! Match nul');
        setWinner('Nul');
        setIsTimerActive(false);
        return true;
      }
    }
    return false;
  };

  const executeMove = (boardState: string[][], fromRow: number, fromCol: number, toRow: number, toCol: number, promotionPieceStr?: string) => {
    const newBoard = boardState.map(r => [...r]);
    const movingPiece = newBoard[fromRow][fromCol];
    const capturedPiece = newBoard[toRow][toCol];

    let moveDetailInfo = '';
    let pgnAddition = '';

    newBoard[toRow][toCol] = movingPiece;
    newBoard[fromRow][fromCol] = '';

    // En passant
    if ((movingPiece === '♙' || movingPiece === '♟') && !capturedPiece && fromCol !== toCol) {
      const capturedPawnRow = fromRow;
      newBoard[capturedPawnRow][toCol] = '';
      moveDetailInfo = ` (en passant ${movingPiece === '♙' ? '♟' : '♙'})`;
    }

    // Castling
    let isCastling = false;
    if ((movingPiece === '♔' || movingPiece === '♚') && Math.abs(toCol - fromCol) === 2) {
      const kingRow = fromRow;
      if (toCol > fromCol) {
        // Petit roque
        const rookCol = 7;
        const rook = newBoard[kingRow][rookCol];
        newBoard[kingRow][5] = rook;
        newBoard[kingRow][rookCol] = '';
        pgnAddition = 'O-O';
        moveDetailInfo = ' (petit roque)';
        isCastling = true;
      } else {
        // Grand roque
        const rookCol = 0;
        const rook = newBoard[kingRow][rookCol];
        newBoard[kingRow][3] = rook;
        newBoard[kingRow][rookCol] = '';
        pgnAddition = 'O-O-O';
        moveDetailInfo = ' (grand roque)';
        isCastling = true;
      }
    }

    // Promotion
    if (promotionPieceStr) {
      newBoard[toRow][toCol] = promotionPieceStr;
    }

    return { newBoard, movingPiece, capturedPiece, moveDetailInfo, pgnAddition, isCastling };
  };

  const handleSquareClick = (row: number, col: number) => {
    if (winner || thinking) return;

    const piece = board[row][col];

    if (!selectedSquare) {
      if ((currentTurn === 'white' && isWhitePiece(piece)) || (currentTurn === 'black' && isBlackPiece(piece))) {
        setSelectedSquare({ row, col });
      }
    } else {
      if (selectedSquare.row === row && selectedSquare.col === col) {
        setSelectedSquare(null);
        return;
      }

      const clickedPiece = board[row][col];
      if ((currentTurn === 'white' && isWhitePiece(clickedPiece)) || (currentTurn === 'black' && isBlackPiece(clickedPiece))) {
        setSelectedSquare({ row, col });
        return;
      }

      const movingPiece = board[selectedSquare.row][selectedSquare.col];

      if (!isValidMoveInternal(board, selectedSquare.row, selectedSquare.col, row, col)) {
        setSelectedSquare(null);
        return;
      }

      // Promotion
      if ((movingPiece === '♙' && row === 0) || (movingPiece === '♟' && row === 7)) {
        const newBoard = board.map(r => [...r]);
        setBoard(newBoard);
        setPromotionState({ row, col, isWhite: movingPiece === '♙', fromRow: selectedSquare.row, fromCol: selectedSquare.col });
        setSelectedSquare(null);
        return;
      }

      finishMove(selectedSquare.row, selectedSquare.col, row, col);
    }
  };

  const finishMove = (fromRow: number, fromCol: number, toRow: number, toCol: number, promotionPieceStr?: string) => {
    const isWhiteTurn = currentTurn === 'white';
    const { newBoard, movingPiece, capturedPiece, moveDetailInfo, pgnAddition, isCastling } = executeMove(board, fromRow, fromCol, toRow, toCol, promotionPieceStr);

    if (isKingInCheck(newBoard, isWhiteTurn)) {
      // Illegal
      return;
    }

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let moveStr = `${movingPiece} ${files[fromCol]}${8 - fromRow} → ${files[toCol]}${8 - toRow}`;
    if (capturedPiece) moveStr += ` (capture ${capturedPiece})`;
    moveStr += moveDetailInfo;

    const opponentInCheck = isKingInCheck(newBoard, !isWhiteTurn);
    const willBeGameOver = checkGameOver(newBoard, !isWhiteTurn);

    const pieceNotation = pieceToNotation(movingPiece);
    const toSquareNotation = `${files[toCol]}${8 - toRow}`;
    let pgnMove = pgnAddition;
    if (!isCastling) {
      if (capturedPiece) {
        pgnMove = pieceNotation === '' ? `${files[fromCol]}x${toSquareNotation}` : `${pieceNotation}x${toSquareNotation}`;
      } else {
        pgnMove = `${pieceNotation}${toSquareNotation}`;
      }
    }

    if (promotionPieceStr) {
      const promotedPieceNotation: { [key: string]: string } = {
        '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N',
      };
      pgnMove += `=${promotedPieceNotation[promotionPieceStr] || 'Q'}`;
      moveStr += ` (Promotion ${promotionPieceStr})`;
    }

    if (willBeGameOver) {
      pgnMove += '#';
      moveStr += ' (échec et mat)';
    } else if (opponentInCheck) {
      pgnMove += '+';
      moveStr += ' (échec)';
      setGameStatus('Échec !');
    } else if (!willBeGameOver) {
      setGameStatus('En cours');
    }

    // Mise à jour du mouvement UCI
    const fromFile = String.fromCharCode('a'.charCodeAt(0) + fromCol);
    const fromRank = 8 - fromRow;
    const toFile = String.fromCharCode('a'.charCodeAt(0) + toCol);
    const toRank = 8 - toRow;
    let uciMove = `${fromFile}${fromRank}${toFile}${toRank}`;

    if (promotionPieceStr) {
      const promotedPieceNotation: { [key: string]: string } = {
        '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N',
      };
      uciMove += (promotedPieceNotation[promotionPieceStr] || 'Q').toLowerCase();
    }

    uciMovesRef.current = [...uciMovesRef.current, uciMove];

    // Détection de blunder
    if (!promotionPieceStr || (promotionPieceStr && mode === 'human')) {
      // Décalage de l'évaluation de blunder pour éviter de spammer l'API Stockfish simultanément avec makeBotMove
      const capturedUciMoves = [...uciMovesRef.current];
      setTimeout(() => {
        detectBlunder(capturedUciMoves, { row: fromRow, col: fromCol }, { row: toRow, col: toCol });
      }, 500);
    }

    setBoard(newBoard);
    setMoveHistory(prev => [...prev, moveStr]);
    setPgnMoves(prev => [...prev, pgnMove]);
    setSelectedSquare(null);

    const newMovedPieces = new Set(movedPieces);
    if (movingPiece === '♔' || movingPiece === '♚') {
      newMovedPieces.add(movingPiece === '♔' ? 'K' : 'k');
    } else if (movingPiece === '♖' || movingPiece === '♜') {
      newMovedPieces.add(movingPiece === '♖' ? `R${fromCol}` : `r${fromCol}`);
    }
    setMovedPieces(newMovedPieces);

    const isPawnDoubleMove = (movingPiece === '♙' && fromRow === 6 && toRow === 4) || (movingPiece === '♟' && fromRow === 1 && toRow === 3);
    setLastEnPassantFile(isPawnDoubleMove ? toCol : null);

    if (isWhiteTurn) {
      setWhiteTime(prev => prev + (timeControl?.increment || 0));
    } else {
      setBlackTime(prev => prev + (timeControl?.increment || 0));
    }

    if (!willBeGameOver) {
      setCurrentTurn(currentTurn === 'white' ? 'black' : 'white');
    } else {
      setIsTimerActive(false);
      setSelectedSquare(null);
    }
  };

  const detectBlunder = async (uciMovesList: string[], moveFrom: { row: number, col: number }, moveTo: { row: number, col: number }) => {
    const movesBeforeThis = uciMovesList.slice(0, -1).join(' ');
    const movesAfterThis = uciMovesList.join(' ');
    const moveIdx = uciMovesList.length - 1;

    try {
      const [evalBefore, evalAfter] = await Promise.all([
        lastEvalRef.current !== null
          ? Promise.resolve({ score: lastEvalRef.current, isMate: false, bestMove: '' })
          : evaluatePosition(movesBeforeThis, 10),
        evaluatePosition(movesAfterThis, 10),
      ]);

      const scoreBefore = evalBefore.score;
      const scoreAfter = -evalAfter.score;

      lastEvalRef.current = evalAfter.score;
      const evalDrop = scoreBefore - scoreAfter;

      let severity: 'inaccuracy' | 'mistake' | 'blunder' | null = null;
      if (evalDrop >= 200) severity = 'blunder';
      else if (evalDrop >= 100) severity = 'mistake';
      else if (evalDrop >= 50) severity = 'inaccuracy';

      if (severity) {
        setBlunders(prev => [...prev, { moveIndex: moveIdx, severity: severity!, evalDrop, fromSquare: moveFrom, toSquare: moveTo }]);
        setLastBlunderSquares({ from: moveFrom, to: moveTo, severity });
        setTimeout(() => setLastBlunderSquares(null), 3000);
      }
    } catch (err) {
      console.error('Erreur détection blunder:', err);
    }
  };

  const handlePromotion = (piece: string) => {
    if (!promotionState) return;
    finishMove(promotionState.fromRow, promotionState.fromCol, promotionState.row, promotionState.col, piece);
    setPromotionState(null);
  };

  // Bot logic
  useEffect(() => {
    if (mode !== 'bot' || currentTurn !== 'black' || thinking || winner || botMoveInProgress.current) return;

    botMoveInProgress.current = true;
    setThinking(true);

    const makeBotMove = async () => {
      try {
        const uciMoves = [...uciMovesRef.current];
        const engineMode = engineSettings.movetime && engineSettings.movetime > 0 ? 'movetime' : 'depth';
        const depthValue = engineSettings.depth || 10;
        const movetimeValue = engineSettings.movetime || 1000;

        const bestMove = await getStockfishBestMove(uciMoves.join(' '), engineMode, 'black', depthValue, movetimeValue);

        if (bestMove && bestMove.length >= 4) {
          const fromCol = bestMove.charCodeAt(0) - 'a'.charCodeAt(0);
          const fromRow = 8 - parseInt(bestMove[1]);
          const toCol = bestMove.charCodeAt(2) - 'a'.charCodeAt(0);
          const toRow = 8 - parseInt(bestMove[3]);

          let promotionPiece: string | null = null;
          if (bestMove.length === 5) {
            const promoPiece = bestMove[4].toLowerCase();
            const promoMap: { [key: string]: string } = { 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞' };
            promotionPiece = promoMap[promoPiece] || '♛';
          }

          const movingPiece = board[fromRow][fromCol];
          if (!isBlackPiece(movingPiece)) {
            console.warn('Bot tried to move an invalid piece (wrong color or empty):', movingPiece, 'from', bestMove);
            throw new Error('Bot invalid move parsed');
          }

          if (isValidMoveInternal(board, fromRow, fromCol, toRow, toCol)) {
            finishMove(fromRow, fromCol, toRow, toCol, promotionPiece || undefined);
          }
        }
      } catch (error) {
        console.error('Bot loop error', error);
      } finally {
        setThinking(false);
        botMoveInProgress.current = false;
      }
    };

    makeBotMove();
  }, [currentTurn, mode, thinking, winner, engineSettings, board]);

  const getLegalMoves = (): { row: number; col: number }[] => {
    if (!selectedSquare) return [];
    const legalMoves: { row: number; col: number }[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (isValidMoveInternal(board, selectedSquare.row, selectedSquare.col, row, col)) {
          const testBoard = board.map(r => [...r]);
          testBoard[row][col] = testBoard[selectedSquare.row][selectedSquare.col];
          testBoard[selectedSquare.row][selectedSquare.col] = '';
          if (!isKingInCheck(testBoard, currentTurn === 'white')) {
            legalMoves.push({ row, col });
          }
        }
      }
    }
    return legalMoves;
  };

  const resetGame = () => {
    setBoard(INITIAL_BOARD);
    setSelectedSquare(null);
    setMoveHistory([]);
    setPgnMoves([]);
    setCurrentTurn('white');
    setGameStatus('En cours');
    setWinner(null);
    setWhiteTime((timeControl?.minutes || 5) * 60);
    setBlackTime((timeControl?.minutes || 5) * 60);
    setIsTimerActive(true);
    setMovedPieces(new Set());
    setLastEnPassantFile(null);
    uciMovesRef.current = [];
    setBlunders([]);
    setLastBlunderSquares(null);
    lastEvalRef.current = null;
    setPromotionState(null);
  };

  return {
    board,
    selectedSquare,
    moveHistory,
    pgnMoves,
    currentTurn,
    gameStatus,
    thinking,
    winner,
    whiteTime,
    blackTime,
    blunders,
    lastBlunderSquares,
    promotionState,
    legalMoves: getLegalMoves(),
    handleSquareClick,
    handlePromotion,
    resetGame,
    uciMoves: uciMovesRef.current,
    currentEval,
    currentBestMove
  };
}
