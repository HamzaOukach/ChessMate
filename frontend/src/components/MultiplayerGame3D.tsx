import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Flag, Handshake, Wifi, WifiOff, MessageCircle, Brain, X } from 'lucide-react';
import { connectGameWebSocket, evaluatePosition } from '../services/api';
import { ChessScene } from './3d/ChessScene';

interface MultiplayerGame3DProps {
  gameId: string;
  username: string;
  onBack: () => void;
  fromChallenge?: boolean;
}

interface GameState {
  fen: string;
  moves: string[];
  turn: 'white' | 'black';
  whiteTime: number;
  blackTime: number;
  started: boolean;
  finished: boolean;
  result: number | null;
  resultType: string | null;
  white: string | null;
  black: string | null;
  whiteElo?: number;
  blackElo?: number;
  timeControl: string;
  legalMoves: string[];
}

interface ChatMsg {
  sender: string;
  content: string;
  timestamp: number;
}

interface BlunderInfo {
  moveIndex: number;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  evalDrop: number;
  from: { row: number; col: number };
  to: { row: number; col: number };
}

function fenToBoard(fen: string): string[][] {
  const board: string[][] = [];
  const rows = fen.split(' ')[0].split('/');
  for (const row of rows) {
    const boardRow: string[] = [];
    for (const c of row) {
      if (c >= '1' && c <= '8') {
        for (let i = 0; i < parseInt(c); i++) boardRow.push('');
      } else {
        const pieceMap: { [key: string]: string } = {
          'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
          'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
        };
        boardRow.push(pieceMap[c] || c);
      }
    }
    board.push(boardRow);
  }
  return board;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isWhitePiece(piece: string): boolean {
  return '♔♕♖♗♘♙'.includes(piece);
}

export function MultiplayerGame3D({ gameId, username, onBack, fromChallenge = false }: MultiplayerGame3DProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(true);
  const [blunders, setBlunders] = useState<BlunderInfo[]>([]);
  const [lastBlunderSquares, setLastBlunderSquares] = useState<{ from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null>(null);
  const [currentView, setCurrentView] = useState<'play' | 'analysis'>('play');
  const [currentEval, setCurrentEval] = useState<number | null>(null);
  const [currentBestMove, setCurrentBestMove] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayWhiteTime, setDisplayWhiteTime] = useState(0);
  const [displayBlackTime, setDisplayBlackTime] = useState(0);
  const evaluatedMoveCountRef = useRef<number>(0);

  // Connect WebSocket
  useEffect(() => {
    const ws = connectGameWebSocket(gameId);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ username }));
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'game_state') {
        setMyColor(data.color);
        updateGameState(data);
      } else if (data.type === 'game_start') {
        setWaitingForOpponent(false);
        updateGameState(data);
      } else if (data.type === 'move') {
        updateGameState(data);
      } else if (data.type === 'game_over') {
        updateGameState(data);
      } else if (data.type === 'player_connected') {
        if (data.username !== username) {
          setWaitingForOpponent(false);
        }
      } else if (data.type === 'draw_offer') {
        setDrawOffered(true);
      } else if (data.type === 'chat') {
        if (data.from !== username) {
          setChatMessages(prev => [...prev, { sender: data.from, content: data.content, timestamp: data.timestamp }]);
        }
      } else if (data.type === 'error') {
        console.error('Game error:', data.message);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameId, username]);

  const updateGameState = useCallback((data: any) => {
    setGameState({
      fen: data.fen,
      moves: data.moves,
      turn: data.turn,
      whiteTime: data.whiteTime,
      blackTime: data.blackTime,
      started: data.started,
      finished: data.finished,
      result: data.result,
      resultType: data.resultType,
      white: data.white,
      black: data.black,
      timeControl: data.timeControl,
      legalMoves: data.legalMoves || [],
    });
    setDisplayWhiteTime(data.whiteTime);
    setDisplayBlackTime(data.blackTime);

    // Blunder detection
    if (data.moves && data.moves.length > 0) {
      const moveCount = data.moves.length;
      if (moveCount > evaluatedMoveCountRef.current && moveCount >= 2) {
        const moveIdx = moveCount - 1;
        const movesBeforeThis = data.moves.slice(0, -1).join(' ');
        const movesAfterThis = data.moves.join(' ');
        evaluatedMoveCountRef.current = moveCount;

        (async () => {
          try {
            const [evalBefore, evalAfter] = await Promise.all([
              evaluatePosition(movesBeforeThis, 10),
              evaluatePosition(movesAfterThis, 10),
            ]);
            const scoreBefore = evalBefore.score;
            const scoreAfter = -evalAfter.score;
            const evalDrop = scoreBefore - scoreAfter;

            let severity: 'inaccuracy' | 'mistake' | 'blunder' | null = null;
            if (evalDrop >= 200) severity = 'blunder';
            else if (evalDrop >= 100) severity = 'mistake';
            else if (evalDrop >= 50) severity = 'inaccuracy';

            if (severity) {
              const lastMoveUci = data.moves[moveIdx];
              const fromCol = lastMoveUci.charCodeAt(0) - 97;
              const fromRow = 8 - parseInt(lastMoveUci[1]);
              const toCol = lastMoveUci.charCodeAt(2) - 97;
              const toRow = 8 - parseInt(lastMoveUci[3]);
              const from = { row: fromRow, col: fromCol };
              const to = { row: toRow, col: toCol };

              setBlunders(prev => [...prev, { moveIndex: moveIdx, severity, evalDrop, from, to }]);
              setLastBlunderSquares({ from, to, severity });
              setTimeout(() => setLastBlunderSquares(null), 3000);
            }
          } catch (err) {
            console.error('Blunder detection error:', err);
          }
        })();
      }
    }

    if (data.started && !data.finished) {
      setWaitingForOpponent(false);
    }
  }, []);

  // Client-side timer tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!gameState?.started || gameState?.finished) return;

    timerRef.current = setInterval(() => {
      if (gameState.turn === 'white') {
        setDisplayWhiteTime(prev => Math.max(0, prev - 0.1));
      } else {
        setDisplayBlackTime(prev => Math.max(0, prev - 0.1));
      }
    }, 100);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.turn, gameState?.started, gameState?.finished]);

  // Live analysis in analysis mode
  useEffect(() => {
    if (currentView !== 'analysis' || gameState?.finished) {
      setCurrentEval(null);
      setCurrentBestMove(null);
      return;
    }

    let isMounted = true;
    const fetchAnalysis = async () => {
      if (!gameState?.moves || gameState.moves.length === 0) return;
      setIsThinking(true);
      try {
        const movesStr = gameState.moves.join(' ');
        const result = await evaluatePosition(movesStr, 12);
        if (isMounted) {
          // Invert score if it's black's turn to get absolute score
          const score = gameState.turn === 'white' ? result.score : -result.score;
          setCurrentEval(score);
          setCurrentBestMove(result.bestMove);
        }
      } catch (err) {
        console.error('Analysis fetch error', err);
      } finally {
        if (isMounted) setIsThinking(false);
      }
    };

    const timeout = setTimeout(fetchAnalysis, 500);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [gameState?.moves, currentView, gameState?.turn, gameState?.finished]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSquareClick = (row: number, col: number) => {
    if (!gameState || !gameState.started || gameState.finished || !myColor || gameState.turn !== myColor) return;

    const board = fenToBoard(gameState.fen);
    // In 3D, the board is NOT visually flipped — the camera handles perspective.
    // So row/col from ChessBoard3D are always direct board coordinates.

    if (selectedSquare) {
      const fromFile = String.fromCharCode(97 + selectedSquare.col);
      const fromRank = (8 - selectedSquare.row).toString();
      const toFile = String.fromCharCode(97 + col);
      const toRank = (8 - row).toString();
      const uci = `${fromFile}${fromRank}${toFile}${toRank}`;

      // Check for pawn promotion
      const piece = board[selectedSquare.row][selectedSquare.col];
      const isPawnPromo = (piece === '♙' && row === 0) || (piece === '♟' && row === 7);
      const finalUci = isPawnPromo ? uci + 'q' : uci;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'move', uci: finalUci }));
      }
      setSelectedSquare(null);
    } else {
      // Select a piece
      const piece = board[row][col];
      if (!piece) return;
      const isPieceWhite = isWhitePiece(piece);
      if ((myColor === 'white' && isPieceWhite) || (myColor === 'black' && !isPieceWhite)) {
        setSelectedSquare({ row, col });
      }
    }
  };

  const handleResign = () => {
    if (!gameState?.started || gameState.finished) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resign' }));
    }
  };

  const handleOfferDraw = () => {
    if (!gameState?.started || gameState.finished) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'offer_draw' }));
    }
  };

  const handleAcceptDraw = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'accept_draw' }));
    }
    setDrawOffered(false);
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !wsRef.current) return;
    const content = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: username, content, timestamp: Date.now() }]);
    wsRef.current.send(JSON.stringify({ type: 'chat', content }));
    setChatInput('');
  };

  const getResultText = () => {
    if (!gameState?.finished) return '';
    const { result, resultType } = gameState;
    let text = '';
    if (result === 1) text = '⬜ Les blancs gagnent';
    else if (result === -1) text = '⬛ Les noirs gagnent';
    else text = '🤝 Match nul';

    const typeMap: { [key: string]: string } = {
      checkmate: 'par échec et mat', timeout: 'par le temps',
      resign: 'par abandon', draw: 'par accord mutuel',
      disconnect: 'par déconnexion',
    };
    return `${text} ${typeMap[resultType || ''] || ''}`;
  };

  // Compute legal moves for the 3D board indicator dots
  const computeLegalMoves3D = (): { row: number; col: number }[] => {
    if (!selectedSquare || !gameState?.legalMoves) return [];
    const moves: { row: number; col: number }[] = [];
    const fromFile = String.fromCharCode(97 + selectedSquare.col);
    const fromRank = (8 - selectedSquare.row).toString();
    const prefix = `${fromFile}${fromRank}`;

    for (const uci of gameState.legalMoves) {
      if (uci.startsWith(prefix)) {
        const toCol = uci.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(uci[3]);
        moves.push({ row: toRow, col: toCol });
      }
    }
    return moves;
  };

  // Loading
  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-400">Connexion à la partie...</p>
      </div>
    );
  }

  const board = fenToBoard(gameState.fen);
  const opponent = myColor === 'white' ? gameState.black : gameState.white;
  const legalMoves3D = computeLegalMoves3D();

  // Waiting for opponent
  if (waitingForOpponent && !gameState.finished) {
    return (
      <div className="bg-gray-900 rounded-2xl p-10 text-center shadow-lg border border-gray-700 max-w-2xl mx-auto my-12 animate-fadeIn relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-cyan-400 to-indigo-500"></div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center border-4 border-gray-700 shadow-sm ring-2 ring-cyan-500/30">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent border-b-cyan-500/30 rounded-full animate-spin"></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">En attente d'un adversaire...</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm">
          {fromChallenge
            ? "L'invitation a été envoyée. La partie commencera automatiquement dès que votre ami acceptera."
            : "Partagez le code ci-dessous pour qu'un ami vous rejoigne."}
        </p>

        {!fromChallenge && (
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 mb-8 max-w-sm mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Code de la partie</p>
            <div className="text-4xl font-mono font-black text-cyan-400 tracking-wider">
              {gameId}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-3">
          {!fromChallenge && (
            <button
              onClick={() => { navigator.clipboard.writeText(gameId); alert('Code copié !'); }}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Copier le code
            </button>
          )}
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-800 border border-gray-600 text-gray-300 font-medium hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex"
      style={{ height: '80vh', minHeight: '600px', backgroundColor: '#050510' }}
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <ChessScene
          board={board}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves3D}
          lastBlunderSquares={lastBlunderSquares}
          onSquareClick={handleSquareClick}
          currentView={currentView}
        />
      </div>

      {/* Top bar overlay */}
      <div
        className="absolute top-0 left-0 right-64 p-4 flex gap-3 flex-wrap"
        style={{ pointerEvents: 'none', zIndex: 9999 }}
      >
        <button
          onClick={onBack}
          className="bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <button
          onClick={() => setCurrentView(prev => prev === 'play' ? 'analysis' : 'play')}
          className={`px-4 py-2 rounded-lg backdrop-blur-md border flex items-center gap-2 transition-all ${currentView === 'analysis'
            ? 'bg-purple-900/50 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
            : 'bg-black/50 border-white/10 text-white hover:bg-white/10'
          }`}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <Brain className="w-4 h-4" />
          {currentView === 'play' ? 'Mode Analyse' : 'Retour au Jeu'}
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-sm"
          style={{ pointerEvents: 'auto' }}>
          {connected ? (
            <><Wifi className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Connecté</span></>
          ) : (
            <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Déconnecté</span></>
          )}
        </div>

        {/* Game actions */}
        {!gameState.finished && gameState.started && (
          <>
            <button onClick={handleResign}
              className="px-3 py-2 rounded-lg bg-red-500/30 border border-red-500/50 text-red-300 hover:bg-red-500/50 backdrop-blur-md flex items-center gap-1.5 text-sm transition-colors"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
              <Flag className="w-3.5 h-3.5" /> Abandonner
            </button>
            <button onClick={handleOfferDraw}
              className="px-3 py-2 rounded-lg bg-gray-500/30 border border-gray-500/50 text-gray-300 hover:bg-gray-500/50 backdrop-blur-md flex items-center gap-1.5 text-sm transition-colors"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
              <Handshake className="w-3.5 h-3.5" /> Nul
            </button>
          </>
        )}
      </div>

      {/* Draw offer banner */}
      {drawOffered && (
        <div className="absolute top-16 left-4 z-50 bg-blue-900/80 border border-blue-500/50 rounded-lg p-3 flex items-center gap-3 backdrop-blur-md"
          style={{ pointerEvents: 'auto' }}>
          <span className="text-blue-200 text-sm">🤝 Votre adversaire propose le nul</span>
          <button onClick={handleAcceptDraw} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Accepter</button>
          <button onClick={() => setDrawOffered(false)} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">Refuser</button>
        </div>
      )}

      {/* Game over overlay */}
      {gameState.finished && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl text-center max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2 text-white">{getResultText()}</h2>
            <p className="text-gray-400 mb-8">Partie terminée en {gameState.moves.length} coups</p>
            <button
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
            >
              <ArrowLeft className="w-5 h-5" /> Retour au menu
            </button>
          </div>
        </div>
      )}

      {/* Side panel (timers + moves + chat toggle) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-64 bg-black/70 backdrop-blur-md border-l border-white/10 p-4 flex flex-col"
        style={{ pointerEvents: 'auto', zIndex: 9998 }}
      >
        {/* Opponent timer (top) */}
        <div className={`p-4 rounded-xl border transition-all ${gameState.turn !== myColor ? 'bg-white/10 border-white/30 shadow-lg' : 'bg-transparent border-transparent opacity-60'}`}>
          <div className="flex items-center justify-between mb-2 text-white">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center shadow-inner">
                <div className={`w-5 h-5 rounded-full ${myColor === 'white' ? 'bg-gray-900 border border-gray-600' : 'bg-white'}`} />
              </div>
              <span className="text-sm">
                {opponent || 'En attente...'}
                {opponent && <span className="ml-2 font-bold text-[10px] opacity-60">({(myColor === 'white' ? gameState.blackElo : gameState.whiteElo) || 800})</span>}
              </span>
            </div>
          </div>
          <div className={`text-3xl font-mono text-center tracking-wider text-white ${(myColor === 'white' ? displayBlackTime : displayWhiteTime) <= 30 ? 'text-red-400 animate-pulse' : ''}`}>
            {formatTime(myColor === 'white' ? displayBlackTime : displayWhiteTime)}
          </div>
        </div>

        {/* Analysis info */}
        {currentView === 'analysis' && currentEval !== null && (
          <div className="mb-4 p-4 rounded-xl bg-blue-900/40 border border-blue-500/30">
            <div className="text-xs text-blue-300 uppercase tracking-wider mb-1 font-bold">Évaluation</div>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-mono font-bold ${currentEval >= 0 ? 'text-white' : 'text-gray-400'}`}>
                {currentEval > 0 ? '+' : ''}{(currentEval / 100).toFixed(1)}
              </div>
              <div className="w-1/2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${currentEval >= 0 ? 'bg-white' : 'bg-gray-500'}`}
                  style={{ width: `${Math.min(Math.max(50 + (currentEval / 20), 5), 95)}%` }}
                />
              </div>
            </div>
            {currentBestMove && (
              <div className="mt-2 text-xs text-blue-200">
                Meilleur: <span className="font-mono font-bold text-white">{currentBestMove}</span>
              </div>
            )}
          </div>
        )}

        {isThinking && (
          <div className="mb-4 flex items-center gap-2 text-xs text-purple-300 animate-pulse px-2">
            <Brain className="w-3.5 h-3.5" />
            <span>Analyse Stockfish...</span>
          </div>
        )}

        {/* Move history + blunders */}
        <div className="flex-1 overflow-y-auto py-4 px-2 my-2 min-h-0 border-y border-white/10 custom-scrollbar">
          <div className="space-y-1">
            {gameState.moves.map((m, i) => {
              const blunder = blunders.find(b => b.moveIndex === i);
              return (
                <div key={i} className={`text-sm py-1.5 px-2 rounded flex items-center gap-2 ${
                  blunder
                    ? blunder.severity === 'blunder' ? 'bg-red-500/20 text-red-300'
                      : blunder.severity === 'mistake' ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    : 'text-gray-400 border-b border-gray-800'
                }`}>
                  <span className="text-gray-600 inline-block w-6 text-xs">{Math.floor(i / 2) + 1}.</span>
                  <span className="font-mono flex-1">{m}</span>
                  {blunder && (
                    <span className="text-[10px] font-bold">
                      {blunder.severity === 'blunder' ? '🔴' : blunder.severity === 'mistake' ? '🟠' : '🟡'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Your timer (bottom) */}
        <div className={`p-4 rounded-xl border transition-all ${gameState.turn === myColor ? 'bg-white/10 border-white/30 shadow-lg' : 'bg-transparent border-transparent opacity-60'}`}>
          <div className="flex items-center justify-between mb-2 text-white">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <div className={`w-5 h-5 rounded-full ${myColor === 'white' ? 'bg-white border border-gray-200' : 'bg-gray-900'}`} />
              </div>
              <span className="text-sm">
                {username} (Vous)
                <span className="ml-2 font-bold text-[10px] opacity-60">({(myColor === 'white' ? gameState.whiteElo : gameState.blackElo) || 800})</span>
              </span>
            </div>
          </div>
          <div className={`text-3xl font-mono text-center tracking-wider text-white ${(myColor === 'white' ? displayWhiteTime : displayBlackTime) <= 30 ? 'text-red-400 animate-pulse' : ''}`}>
            {formatTime(myColor === 'white' ? displayWhiteTime : displayBlackTime)}
          </div>
        </div>

        {/* Chat toggle button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`mt-3 w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
            chatOpen ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
        </button>
      </div>

      {/* Chat overlay (togglable) */}
      {chatOpen && (
        <div className="absolute right-64 bottom-0 w-80 h-96 z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-tl-2xl flex flex-col overflow-hidden shadow-2xl"
          style={{ pointerEvents: 'auto' }}>
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
            <h3 className="font-bold text-gray-200 flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4 text-cyan-400" /> Chat
            </h3>
            <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {chatMessages.length === 0 && (
              <div className="m-auto text-center">
                <p className="text-gray-500 text-sm">Aucun message</p>
              </div>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.sender === username;
              return (
                <div key={i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl relative ${
                    isMe
                      ? 'bg-cyan-600/80 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700/50'
                  }`}>
                    <div className={`text-[10px] font-bold opacity-75 mb-0.5 ${isMe ? 'text-cyan-100 text-right' : 'text-gray-400'}`}>
                      {msg.sender}
                    </div>
                    <p className="text-[13px] leading-relaxed break-words">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-gray-800/50 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Message..."
              className="flex-1 bg-gray-900 border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-gray-500"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                chatInput.trim()
                  ? 'bg-cyan-600 text-white shadow-sm hover:bg-cyan-500'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
