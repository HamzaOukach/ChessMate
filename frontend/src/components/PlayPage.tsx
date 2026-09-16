import { useState, useEffect, useRef } from 'react';
import { GameSetup } from './GameSetup';
import { ChessGame } from './ChessGame';
import { MultiplayerGame } from './MultiplayerGame';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  createMultiplayerGame, joinMultiplayerGame, joinMatchmaking,
  cancelMatchmaking, checkMatch
} from '../services/api';

interface GameSettings {
  opponent: 'human' | 'bot' | 'bot_ml' | 'online' | 'friend_create' | 'friend_join';
  timeMinutes: number;
  increment: number;
  joinCode?: string;
  engineSettings?: {
    depth: number | null;
    movetime: number | null;
    useDepth: boolean;
  };
}

interface PlayPageProps {
  username: string;
}

export function PlayPage({ username }: PlayPageProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [multiplayerGameId, setMultiplayerGameId] = useState<string | null>(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingMessage, setMatchmakingMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleStartGame = async (settings: GameSettings) => {
    setGameSettings(settings);

    if (settings.opponent === 'friend_create') {
      // Create a multiplayer game and wait for opponent
      try {
        const result = await createMultiplayerGame(username, settings.timeMinutes, settings.increment);
        setMultiplayerGameId(result.gameId);
        setGameStarted(true);
      } catch (error) {
        alert('Erreur lors de la création de la partie');
      }
    } else if (settings.opponent === 'friend_join') {
      // Join an existing game
      try {
        await joinMultiplayerGame(settings.joinCode!, username);
        setMultiplayerGameId(settings.joinCode!);
        setGameStarted(true);
      } catch (error: any) {
        alert(error.message || 'Partie non trouvée ou déjà pleine');
      }
    } else if (settings.opponent === 'online') {
      // Start matchmaking
      setIsMatchmaking(true);
      setMatchmakingMessage('Recherche d\'un adversaire...');

      try {
        const result = await joinMatchmaking(username, settings.timeMinutes, settings.increment);
        if (result.matched) {
          // Instant match found
          setMultiplayerGameId(result.gameId);
          setIsMatchmaking(false);
          setGameStarted(true);
        } else {
          // Poll for match
          pollRef.current = setInterval(async () => {
            try {
              const check = await checkMatch(username);
              if (check.matched) {
                if (pollRef.current) clearInterval(pollRef.current);
                setMultiplayerGameId(check.gameId);
                setIsMatchmaking(false);
                setGameStarted(true);
              }
            } catch { /* continue polling */ }
          }, 2000);
        }
      } catch (error: any) {
        setIsMatchmaking(false);
        alert(error.message || 'Erreur de matchmaking');
      }
    } else {
      // Bot or local human - existing flow
      setGameStarted(true);
    }
  };

  const handleCancelMatchmaking = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await cancelMatchmaking(username);
    setIsMatchmaking(false);
    setGameSettings(null);
  };

  const handleBackToSetup = () => {
    setGameStarted(false);
    setGameSettings(null);
    setMultiplayerGameId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Matchmaking screen
  if (isMatchmaking) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="glass-panel rounded-2xl shadow-xl p-10 text-center border border-slate-700/50">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-100 mb-2">Matchmaking</h3>
          <p className="text-slate-400 mb-6">{matchmakingMessage}</p>
          <div className="text-sm text-slate-500 mb-6">
            Cadence: {gameSettings?.timeMinutes}+{gameSettings?.increment}
          </div>
          <button
            onClick={handleCancelMatchmaking}
            className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return <GameSetup onStartGame={handleStartGame} />;
  }

  // Multiplayer game
  if (multiplayerGameId) {
    return (
      <MultiplayerGame
        gameId={multiplayerGameId}
        username={username}
        onBack={handleBackToSetup}
      />
    );
  }

  // Bot or local human game
  return (
    <div className="space-y-4">
      <button
        onClick={handleBackToSetup}
        className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      {(gameSettings?.opponent === 'bot' || gameSettings?.opponent === 'bot_ml' || gameSettings?.opponent === 'human') ? (
        <ChessGame
          username={username}
          mode={gameSettings.opponent as 'human' | 'bot' | 'bot_ml'}
          timeControl={{
            minutes: gameSettings.timeMinutes,
            increment: gameSettings.increment,
          }}
          engineSettings={gameSettings.engineSettings}
        />
      ) : null}
    </div>
  );
}
