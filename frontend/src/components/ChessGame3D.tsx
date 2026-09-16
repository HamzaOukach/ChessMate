import { useState } from 'react';
import { ArrowLeft, RotateCcw, Brain, Circle } from 'lucide-react';
import { useChessGame } from '../hooks/useChessGame';
import { ChessScene } from './3d/ChessScene';

interface ChessGame3DProps {
  mode: 'human' | 'bot';
  timeControl?: {
    minutes: number;
    increment: number;
  };
  engineSettings?: {
    depth: number | null;
    movetime: number | null;
    useDepth: boolean;
  } | null;
  onExit?: () => void;
}

export function ChessGame3D(props: ChessGame3DProps) {
  const [currentView, setCurrentView] = useState<'play' | 'analysis'>('play');

  const gameState = useChessGame({
    mode: props.mode,
    timeControl: props.timeControl,
    engineSettings: props.engineSettings,
    isAnalysisMode: currentView === 'analysis'
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex"
      style={{ height: '80vh', minHeight: '600px', backgroundColor: '#050510' }}
    >
      {/* arriere plan du canevas 3d */}
      <div className="absolute inset-0 z-0">
        <ChessScene
          board={gameState.board}
          selectedSquare={gameState.selectedSquare}
          legalMoves={gameState.legalMoves}
          lastBlunderSquares={gameState.lastBlunderSquares}
          onSquareClick={gameState.handleSquareClick}
          currentView={currentView}
        />
      </div>

      {/* overlay de l'interface utilisateur html - barre supérieure */}
      <div
        className="absolute top-0 left-0 right-64 p-4 flex gap-4"
        style={{ pointerEvents: 'none', zIndex: 9999 }}
      >
        {props.onExit && (
          <button
            onClick={props.onExit}
            className="bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          >
            <ArrowLeft className="w-4 h-4" /> Quitter
          </button>
        )}

        {/* bouton de changement de vue */}
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
      </div>

      {/* overlay de fin de partie */}
      {gameState.winner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl text-center max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2 text-white">{gameState.gameStatus}</h2>
            <p className="text-gray-400 mb-8">Partie terminée en {gameState.pgnMoves.length} coups</p>
            <button
              onClick={gameState.resetGame}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Rejouer
            </button>
          </div>
        </div>
      )}

      {/* dialogue de promotion */}
      {gameState.promotionState && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">Choisissez une promotion</h3>
            <div className="flex gap-4 justify-center bg-gray-800 p-4 rounded-xl border border-gray-700">
              {(gameState.promotionState.isWhite ? ['♕', '♖', '♗', '♘'] : ['♛', '♜', '♝', '♞']).map((piece) => (
                <button
                  key={piece}
                  onClick={() => gameState.handlePromotion(piece)}
                  className="text-5xl hover:bg-gray-700 p-3 rounded-xl transition-colors text-white"
                >
                  {piece}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* panneau latéral (chronomètres et infos) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-64 bg-black/70 backdrop-blur-md border-l border-white/10 p-4 flex flex-col"
        style={{ pointerEvents: 'auto', zIndex: 9998 }}
      >
        {/* infos du joueur adverse (noir) */}
        <div className={`p-4 rounded-xl border transition-all ${gameState.currentTurn === 'black' ? 'bg-white/10 border-white/30 shadow-lg' : 'bg-transparent border-transparent opacity-60'
          }`}>
          <div className="flex items-center justify-between mb-2 text-white">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center shadow-inner">
                {props.mode === 'bot' ? <Brain className="w-5 h-5 text-purple-400" /> : <Circle className="w-5 h-5 fill-black border border-gray-600 rounded-full" />}
              </div>
              <span>{props.mode === 'bot' ? 'Stockfish' : 'Joueur Noir'}</span>
            </div>
          </div>
          <div className={`text-3xl font-mono text-center tracking-wider text-white ${gameState.blackTime <= 30 ? 'text-red-400' : ''
            }`}>
            {formatTime(gameState.blackTime)}
          </div>
        </div>

        {/* indicateur de statut et état de réflexion */}
        <div className="flex-1 overflow-y-auto py-4 px-2 my-2 min-h-0 border-y border-white/10 custom-scrollbar">
          {gameState.thinking && (
            <div className="flex items-center gap-3 p-3 bg-purple-900/40 border border-purple-500/30 text-purple-200 rounded-xl mb-4 text-sm animate-pulse">
              <Brain className="w-4 h-4" />
              <span>Stockfish réfléchit...</span>
            </div>
          )}

          {currentView === 'analysis' && gameState.currentEval !== null && (
            <div className="mb-4 p-4 rounded-xl bg-blue-900/40 border border-blue-500/30">
              <div className="text-xs text-blue-300 uppercase tracking-wider mb-1 font-bold">Évaluation</div>
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-mono font-bold ${gameState.currentEval >= 0 ? 'text-white' : 'text-gray-400'}`}>
                  {gameState.currentEval > 0 ? '+' : ''}{(gameState.currentEval / 100).toFixed(1)}
                </div>
                <div className="w-1/2 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${gameState.currentEval >= 0 ? 'bg-white' : 'bg-gray-500'}`}
                    style={{ width: `${Math.min(Math.max(50 + (gameState.currentEval / 20), 5), 95)}%` }}
                  />
                </div>
              </div>
              {gameState.currentBestMove && (
                <div className="mt-2 text-xs text-blue-200">
                  Meilleur coup suggéré: <span className="font-mono font-bold text-white">{gameState.currentBestMove}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            {gameState.moveHistory.map((m, i) => {
              const blunder = gameState.blunders.find(b => b.moveIndex === i);
              return (
                <div key={i} className={`text-sm py-1.5 px-2 rounded flex items-center gap-2 ${blunder
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

        {/* infos du joueur (blanc) */}
        <div className={`p-4 rounded-xl border transition-all ${gameState.currentTurn === 'white' ? 'bg-white/10 border-white/30 shadow-lg' : 'bg-transparent border-transparent opacity-60'
          }`}>
          <div className="flex items-center justify-between mb-2 text-white">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <Circle className="w-5 h-5 text-gray-200" />
              </div>
              <span>Vous (Blancs)</span>
            </div>
          </div>
          <div className={`text-3xl font-mono text-center tracking-wider text-white ${gameState.whiteTime <= 30 ? 'text-red-400' : ''
            }`}>
            {formatTime(gameState.whiteTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
