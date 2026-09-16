import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Flag, Handshake, Wifi, WifiOff, MessageCircle } from 'lucide-react';
import { connectGameWebSocket, evaluatePosition } from '../services/api';

interface MultiplayerGameProps {
  gameId: string;
  username: string;
  onBack: () => void;
  fromChallenge?: boolean; // if true, hides the share-code UI
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
}

// Premium SVG chess pieces
function PieceIcon({ piece }: { piece: string }) {
  if (!piece) return null;
  const imageMap: { [key: string]: string } = {
    '♔': 'wK', '♕': 'wQ', '♖': 'wR', '♗': 'wB', '♘': 'wN', '♙': 'wP',
    '♚': 'bK', '♛': 'bQ', '♜': 'bR', '♝': 'bB', '♞': 'bN', '♟': 'bP',
  };
  const code = imageMap[piece];
  if (!code) return (
    <span className="text-4xl text-gray-800">{piece}</span>
  );
  
  return (
    <img 
      src={`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${code}.svg`} 
      alt={piece} 
      className="absolute inset-0 m-auto w-[85%] h-[85%] object-contain drop-shadow-lg pointer-events-none select-none transition-transform hover:scale-110"
      draggable={false}
    />
  );
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

export function MultiplayerGame({ gameId, username, onBack, fromChallenge = false }: MultiplayerGameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [drawOffered, setDrawOffered] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayWhiteTime, setDisplayWhiteTime] = useState(0);
  const [displayBlackTime, setDisplayBlackTime] = useState(0);
  const [lastMove, setLastMove] = useState<{from: [number, number], to: [number, number]} | null>(null);
  const [markedSquares, setMarkedSquares] = useState<string[]>([]);
  const [blunders, setBlunders] = useState<BlunderInfo[]>([]);
  const lastEvalRef = useRef<number | null>(null);
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
        // Only add opponent messages; sender's own appear via optimistic update
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

    // Track last move if present
    if (data.moves && data.moves.length > 0) {
      const lastUci = data.moves[data.moves.length - 1];
      if (lastUci && lastUci.length >= 4) {
        const fromCol = lastUci.charCodeAt(0) - 97;
        const fromRow = 8 - parseInt(lastUci[1]);
        const toCol = lastUci.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(lastUci[3]);
        setLastMove({ from: [fromRow, fromCol], to: [toRow, toCol] });
      }

      // Blunder detection: evaluate every new move
      const moveCount = data.moves.length;
      if (moveCount > evaluatedMoveCountRef.current && moveCount >= 2) {
        const moveIdx = moveCount - 1;
        const movesBeforeThis = data.moves.slice(0, -1).join(' ');
        const movesAfterThis = data.moves.join(' ');
        evaluatedMoveCountRef.current = moveCount;

        // Run asynchronously so it doesn't block the game
        (async () => {
          try {
            const [evalBefore, evalAfter] = await Promise.all([
              lastEvalRef.current !== null
                ? Promise.resolve({ score: lastEvalRef.current, isMate: false, bestMove: '' })
                : evaluatePosition(movesBeforeThis, 10),
              evaluatePosition(movesAfterThis, 10),
            ]);

            const scoreBefore = evalBefore.score;
            const scoreAfter = -evalAfter.score; // negate because perspective flips
            lastEvalRef.current = evalAfter.score;

            const evalDrop = scoreBefore - scoreAfter;
            console.log(`[Multiplayer] Move ${moveIdx}: eval avant=${scoreBefore}cp, après=${scoreAfter}cp, chute=${evalDrop}cp`);

            let severity: 'inaccuracy' | 'mistake' | 'blunder' | null = null;
            if (evalDrop >= 200) severity = 'blunder';
            else if (evalDrop >= 100) severity = 'mistake';
            else if (evalDrop >= 50) severity = 'inaccuracy';

            if (severity) {
              setBlunders(prev => [...prev, { moveIndex: moveIdx, severity, evalDrop }]);
            }
          } catch (err) {
            console.error('Erreur détection blunder (multiplayer):', err);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSquareClick = (row: number, col: number) => {
    if (!gameState || !gameState.started || gameState.finished || !myColor || gameState.turn !== myColor) return;

    const board = fenToBoard(gameState.fen);
    const isFlipped = myColor === 'black';
    const actualRow = isFlipped ? 7 - row : row;
    const actualCol = isFlipped ? 7 - col : col;

    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const fromFile = String.fromCharCode(97 + fromCol);
      const fromRank = (8 - fromRow).toString();
      const toFile = String.fromCharCode(97 + actualCol);
      const toRank = (8 - actualRow).toString();
      const uci = `${fromFile}${fromRank}${toFile}${toRank}`;

      // Check for pawn promotion
      const piece = board[fromRow][fromCol];
      const isPawnPromo = (piece === '♙' && actualRow === 0) || (piece === '♟' && actualRow === 7);
      const finalUci = isPawnPromo ? uci + 'q' : uci;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'move', uci: finalUci }));
      }
      setSelectedSquare(null);
    } else {
      // Select a piece
      const piece = board[actualRow][actualCol];
      if (!piece) return;
      const isWhitePiece = '♔♕♖♗♘♙'.includes(piece);
      if ((myColor === 'white' && isWhitePiece) || (myColor === 'black' && !isWhitePiece)) {
        setSelectedSquare([actualRow, actualCol]);
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
    // Optimistic: show immediately as the sender's own message
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

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600">Connexion à la partie...</p>
      </div>
    );
  }

  const board = fenToBoard(gameState.fen);
  const isFlipped = myColor === 'black';
  const opponent = myColor === 'white' ? gameState.black : gameState.white;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1 text-green-600 text-sm"><Wifi className="w-4 h-4" /> Connecté</span>
          ) : (
            <span className="flex items-center gap-1 text-red-500 text-sm"><WifiOff className="w-4 h-4" /> Déconnecté</span>
          )}
          <span className="text-sm text-gray-500">ID: {gameId}</span>
        </div>
      </div>

      {waitingForOpponent && !gameState.finished && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-lg border border-gray-100 max-w-2xl mx-auto my-12 animate-fadeIn relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
          
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border-4 border-white shadow-sm ring-2 ring-blue-100">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent border-b-blue-600/30 rounded-full animate-spin"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">En attente d'un adversaire...</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto text-sm">
            {fromChallenge 
              ? "L'invitation a été envoyée. La partie commencera automatiquement dès que votre ami acceptera." 
              : "Partagez le code ci-dessous pour qu'un ami vous rejoigne."}
          </p>

          {!fromChallenge && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 max-w-sm mx-auto">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Code de la partie</p>
              <div className="text-4xl font-mono font-black text-blue-600 tracking-wider">
                {gameId}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {!fromChallenge && (
              <button
                onClick={() => { navigator.clipboard.writeText(gameId); alert('Code copié !'); }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Copier le code
              </button>
            )}
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!waitingForOpponent && (
        <>
          {drawOffered && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-blue-800">🤝 Votre adversaire propose le match nul</span>
              <div className="flex gap-2">
                <button onClick={handleAcceptDraw} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Accepter</button>
                <button onClick={() => setDrawOffered(false)} className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Refuser</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Board */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-xl p-8 border border-slate-200">
                <div className="flex justify-center items-center mb-6">
                  {/* Top Player (Opponent) Timer */}
                  <div className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 ${!isFlipped ? 'bg-slate-800 shadow-lg ring-2 ring-purple-500 scale-105 text-white' : 'bg-white shadow-lg ring-2 ring-blue-500 scale-105 text-slate-900'}`}>
                    <div>
                      <div className="text-sm opacity-80">
                        {opponent || 'En attente...'}
                        {opponent && (
                          <span className="ml-2 font-bold text-xs opacity-60">
                            ({(gameState.white === opponent ? gameState.whiteElo : gameState.blackElo) || 800})
                          </span>
                        )}
                      </div>
                      <div className={`text-lg font-mono ${(isFlipped ? displayWhiteTime : displayBlackTime) < 30 ? 'text-red-500 animate-pulse' : (isFlipped ? 'text-slate-900' : 'text-white')}`}>
                        {formatTime(isFlipped ? displayWhiteTime : displayBlackTime)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center my-4 overflow-x-auto">
                  <div className="inline-block relative">
                    <div className="flex">
                      {/* Colonne de chiffres à gauche */}
                      <div className="flex flex-col justify-around pr-2 text-slate-600 font-mono text-sm shadow-none">
                        {[8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                          <div key={num} className="h-16 sm:h-20 flex items-center justify-center">
                            {isFlipped ? 9 - num : num}
                          </div>
                        ))}
                      </div>

                      {/* Échiquier principal */}
                      <div className="border-[8px] border-slate-800 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl relative">
                        {board.map((row, rowIndex) => (
                          <div key={rowIndex} className="flex">
                            {row.map((_, colIndex) => {
                              const displayRow = rowIndex;
                              const displayCol = colIndex;
                              const actualRow = isFlipped ? 7 - displayRow : displayRow;
                              const actualCol = isFlipped ? 7 - displayCol : displayCol;
                              const piece = board[actualRow][actualCol];
                              const isLight = (actualRow + actualCol) % 2 === 0;
                              const isSelected = selectedSquare && selectedSquare[0] === actualRow && selectedSquare[1] === actualCol;
                              const isLastMove = lastMove && (
                                (lastMove.from[0] === actualRow && lastMove.from[1] === actualCol) ||
                                (lastMove.to[0] === actualRow && lastMove.to[1] === actualCol)
                              );

                              // Detect legal move from the UCI strings
                              let isLegalMove = false;
                              if (selectedSquare && gameState?.legalMoves) {
                                const [sRow, sCol] = selectedSquare;
                                const fromFile = String.fromCharCode(97 + sCol);
                                const fromRank = (8 - sRow).toString();
                                const toFile = String.fromCharCode(97 + actualCol);
                                const toRank = (8 - actualRow).toString();
                                const uciStart = `${fromFile}${fromRank}${toFile}${toRank}`;
                                // e.g. "e2e4" or "e7e8q"
                                isLegalMove = gameState.legalMoves.some(m => m.startsWith(uciStart));
                              }
                              
                              const squareId = `${actualRow}-${actualCol}`;
                              const isMarked = markedSquares.includes(squareId);

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
                                    if (!selectedSquare && !piece) {
                                      setMarkedSquares(prev => prev.includes(squareId) ? prev.filter(id => id !== squareId) : [...prev, squareId]);
                                    } else {
                                      handleSquareClick(displayRow, displayCol);
                                    }
                                  }}
                                  onContextMenu={handleRightClick}
                                  className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all duration-200 relative
                                    ${isSelected 
                                      ? 'ring-4 ring-blue-500 ring-inset scale-95 shadow-inner z-10' 
                                      : ''
                                    } 
                                    ${isLight
                                      ? isLastMove ? 'bg-amber-100/80 saturate-150' : 'bg-gradient-to-br from-amber-50 to-amber-100'
                                      : isLastMove ? 'bg-amber-700/80 saturate-150' : 'bg-gradient-to-br from-amber-600 to-amber-800'
                                    } hover:brightness-110 active:scale-95`}
                                  style={{
                                    // Ensure forced dimensions just in case
                                    minWidth: '4rem', minHeight: '4rem'
                                  }}
                                >
                                  {piece && (
                                    <PieceIcon piece={piece} />
                                  )}
                                  {isMarked && (
                                    <div className="absolute inset-0 ring-4 ring-green-500 ring-inset bg-green-500/20 pointer-events-none rounded-lg" />
                                  )}
                                  {isLegalMove && (
                                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                                      {!piece ? (
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
                    {/* Ligne de lettres en bas */}
                    <div className="flex pl-6 pr-0 md:pl-6 md:pr-1">
                      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((letter, i) => (
                        <div key={letter} className="w-16 sm:w-20 flex items-center justify-center pt-2 text-slate-600 font-mono text-sm ml-[-1px]">
                          {isFlipped ? String.fromCharCode(104 - i) : letter}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center items-center mt-6">
                  {/* Bottom Player (You) Timer */}
                  <div className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 ${!isFlipped ? 'bg-white shadow-lg ring-2 ring-blue-500 scale-105 text-slate-900' : 'bg-slate-800 shadow-lg ring-2 ring-purple-500 scale-105 text-white'}`}>
                    <div>
                      <div className="text-sm opacity-80">
                        {username} (Vous)
                        <span className="ml-2 font-bold text-xs opacity-60">
                          ({(gameState.white === username ? gameState.whiteElo : gameState.blackElo) || 800})
                        </span>
                      </div>
                      <div className={`text-lg font-mono ${(isFlipped ? displayBlackTime : displayWhiteTime) < 30 ? 'text-red-600 animate-pulse' : (!isFlipped ? 'text-slate-900' : 'text-white')}`}>
                        {formatTime(isFlipped ? displayBlackTime : displayWhiteTime)}
                      </div>
                    </div>
                  </div>
                </div>

                {gameState.finished && (
                  <div className="mt-8 p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white text-center shadow-lg">
                    <div className="text-xl font-bold mb-1">{getResultText()}</div>
                    <div className="text-sm opacity-80">{gameState.moves.length} coups joués</div>
                  </div>
                )}
              </div>

              {!gameState.finished && gameState.started && (
                <div className="flex gap-3 mt-3">
                  <button onClick={handleResign} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm">
                    <Flag className="w-4 h-4" /> Abandonner
                  </button>
                  <button onClick={handleOfferDraw} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    <Handshake className="w-4 h-4" /> Proposer nul
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 lg:h-[750px]">
              {/* Chat sidebar */}
              <div className="glass-panel bg-slate-900/50 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col flex-1 min-h-[300px] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 bg-slate-800/50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <MessageCircle className="w-4 h-4 text-cyan-400" /> Chat de la partie
                  </h3>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="m-auto text-center">
                      <p className="text-slate-400 text-sm font-medium">Aucun message pour l'instant</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => {
                    const isMe = msg.sender === username;
                    return (
                      <div key={i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl relative ${
                          isMe 
                            ? 'bg-cyan-600/80 text-white rounded-br-sm' 
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/50'
                        }`}>
                          <div className={`text-[10px] font-bold opacity-75 mb-0.5 ${isMe ? 'text-cyan-100 text-right' : 'text-slate-400'}`}>
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
                <div className="p-3 bg-slate-800/50 border-t border-white/5 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Écrire un message..."
                    className="flex-1 bg-slate-900 border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      chatInput.trim() 
                        ? 'bg-cyan-600 text-white shadow-sm hover:bg-cyan-500' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Historique des coups */}
              <div className="glass-panel bg-slate-900/50 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col flex-1 min-h-[250px] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 bg-slate-800/50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <div className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-indigo-500 rounded-full" />
                    Historique des coups
                  </h3>
                </div>
                
                {/* Moves List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {(!gameState.moves || gameState.moves.length === 0) ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm">Aucun coup joué</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {gameState.moves.map((move, index) => {
                        const blunder = blunders.find(b => b.moveIndex === index);
                        return (
                        <div
                          key={index}
                          className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-3 ${
                            blunder
                              ? blunder.severity === 'blunder'
                                ? 'bg-red-500/15 border border-red-500/40 text-red-200'
                                : blunder.severity === 'mistake'
                                  ? 'bg-orange-500/15 border border-orange-500/40 text-orange-200'
                                  : 'bg-yellow-500/15 border border-yellow-500/40 text-yellow-200'
                              : index === gameState.moves.length - 1
                                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-200'
                                : 'bg-slate-800/50 text-slate-300'
                            }`}
                        >
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${index % 2 === 0
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-700 text-slate-400'
                            }`}>
                            {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'}
                          </span>
                          <span className="font-mono flex-1">{move}</span>
                          {blunder && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse ${
                              blunder.severity === 'blunder'
                                ? 'bg-red-500/30 text-red-300'
                                : blunder.severity === 'mistake'
                                  ? 'bg-orange-500/30 text-orange-300'
                                  : 'bg-yellow-500/30 text-yellow-300'
                            }`}>
                              {blunder.severity === 'blunder' ? '🔴 Blunder'
                                : blunder.severity === 'mistake' ? '🟠 Erreur'
                                  : '🟡 Imprécis'}
                            </span>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
