import { useState, useEffect, useRef } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { PlayPage } from './components/PlayPage';
import { PlayPage3D } from './components/PlayPage3D';
import { Stats } from './components/Stats';
import { FriendsPage } from './components/FriendsPage';
import { MultiplayerGame } from './components/MultiplayerGame';
import { MultiplayerGame3D } from './components/MultiplayerGame3D';
import { PlayerSearch } from './components/PlayerSearch';
import CheatAnalysis from './components/CheatAnalysis';
import { CheatHistory } from './components/CheatHistory';
import { HistoryPage } from './components/HistoryPage';
import { PartieDetailPage } from './components/PartieDetailPage';
import { Parties } from './components/Parties';
import { ReviewPartie } from './components/ReviewPartie';
import { Users, ShieldAlert, Swords, Clock, History } from 'lucide-react';
import { connectChatWebSocket, joinMultiplayerGame } from './services/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState<{ username: string } | null>(null);
  // For challenge from friends page
  const [challengeGameId, setChallengeGameId] = useState<string | null>(null);
  const [challengeMode, setChallengeMode] = useState<'2d' | '3d'>('2d');
  // Global chat WebSocket (stays connected across all pages)
  const chatWsRef = useRef<WebSocket | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<{ from: string; gameId: string; timeControl: string; mode: '2d' | '3d' } | null>(null);
  const [selectedPartieId, setSelectedPartieId] = useState<number | null>(null);
  const [reviewPartieId, setReviewPartieId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const username = localStorage.getItem('username');
    if (token && username) {
      setIsAuthenticated(true);
      setUser({ username });
    }

    const handleAuthExpired = () => {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('username');
      setIsAuthenticated(false);
      setUser(null);
      setCurrentPage('dashboard');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  // Global Chat WebSocket – connect once when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.username) {
      chatWsRef.current?.close();
      chatWsRef.current = null;
      return;
    }

    let ws: WebSocket;
    try {
      ws = connectChatWebSocket();
      chatWsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ username: user.username }));

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === 'challenge') {
          setIncomingChallenge({ from: data.from, gameId: data.gameId, timeControl: data.timeControl, mode: data.mode || '2d' });
        } else if (data.type === 'challenge_response') {
          if (data.accepted) {
            handleChallengeFriend(data.gameId, data.mode || '2d');
          }
        }
        // DM and other events are dispatched as custom events so FriendsPage can listen
        window.dispatchEvent(new CustomEvent('chat:message', { detail: data }));
      };

      ws.onerror = () => console.warn('Chat WS error');
    } catch (e) {
      console.warn('Cannot connect chat WS:', e);
    }

    return () => { ws?.close(); chatWsRef.current = null; };
  }, [isAuthenticated, user?.username]);

  const handleLogin = (token: string, username: string, joueurId?: number) => {
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('username', username);
    if (joueurId) {
      localStorage.setItem('joueurId', String(joueurId));
    }
    setIsAuthenticated(true);
    setUser({ username });
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('username');
    localStorage.removeItem('joueurId');
    chatWsRef.current?.close();
    chatWsRef.current = null;
    setIsAuthenticated(false);
    setUser(null);
    setCurrentPage('dashboard');
  };

  const handleChallengeFriend = (gameId: string, mode: '2d' | '3d' = '2d') => {
    setChallengeGameId(gameId);
    setChallengeMode(mode);
    setCurrentPage('challenge');
  };

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge || !user) return;
    const { from, gameId, mode } = incomingChallenge;
    setIncomingChallenge(null);
    try {
      await joinMultiplayerGame(gameId, user.username);
      if (chatWsRef.current?.readyState === WebSocket.OPEN) {
        chatWsRef.current.send(JSON.stringify({ type: 'challenge_response', to: from, gameId, accepted: true, mode }));
      }
      handleChallengeFriend(gameId, mode);
    } catch (e: any) {
      alert(`Erreur: ${e.message}`);
    }
  };

  const handleDeclineChallenge = () => {
    if (!incomingChallenge) return;
    const { from, gameId } = incomingChallenge;
    if (chatWsRef.current?.readyState === WebSocket.OPEN) {
      chatWsRef.current.send(JSON.stringify({ type: 'challenge_response', to: from, gameId, accepted: false }));
    }
    setIncomingChallenge(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const navButtonClass = (page: string) => {
    const baseClass = 'px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2';
    if (currentPage === page) {
      return baseClass + ' bg-cyan-500/20 text-cyan-400 shadow-sm shadow-cyan-500/20 border border-cyan-500/30';
    }
    return baseClass + ' text-slate-400 hover:bg-slate-800 hover:text-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <nav className="bg-slate-900 shadow-lg border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 font-bold tracking-tight">♟ ChessMate</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCurrentPage('dashboard');
                    setSelectedPartieId(null);
                  }}
                  className={navButtonClass('dashboard')}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('play');
                    setSelectedPartieId(null);
                  }}
                  className={navButtonClass('play')}
                >
                  Jouer (2D)
                </button>
                <button
                  onClick={() => setCurrentPage('play3d')}
                  className={navButtonClass('play3d')}
                >
                  Échecs 3D
                </button>
                <button
                  onClick={() => setCurrentPage('friends')}
                  className={navButtonClass('friends')}
                >
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Amis
                  </span>
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('stats');
                    setSelectedPartieId(null);
                  }}
                  className={navButtonClass('stats')}
                >
                  Statistiques
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('history');
                    setSelectedPartieId(null);
                  }}
                  className={navButtonClass('history')}
                >
                  <span className="flex items-center gap-1">
                    <History className="w-4 h-4" />
                    Historique
                  </span>
                </button>
                <button
                  onClick={() => setCurrentPage('search')}
                  className={navButtonClass('search')}
                >
                  Recherche
                </button>
                <button
                  onClick={() => setCurrentPage('cheat')}
                  className={navButtonClass('cheat')}
                >
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" />
                    Détection triche
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-300 font-medium text-sm">👤 {user?.username}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard onNavigate={(page) => setCurrentPage(page)} />}
        {currentPage === 'play' && <PlayPage username={user?.username || 'anonymous'} />}
        {currentPage === 'play3d' && <PlayPage3D username={user?.username || 'anonymous'} />}
        {currentPage === 'friends' && (
          <FriendsPage
            username={user?.username || 'anonymous'}
            onChallengeFriend={(gameId, mode) => handleChallengeFriend(gameId, mode)}
            chatWsRef={chatWsRef}
          />
        )}
        {currentPage === 'stats' && <Stats />}
        {currentPage === 'search' && <PlayerSearch />}
        {currentPage === 'cheat' && <CheatAnalysis onNavigate={(page) => setCurrentPage(page)} />}
        {currentPage === 'cheatHistory' && <CheatHistory />}
        {currentPage === 'parties' && reviewPartieId === null && (
          <Parties onReview={(id) => setReviewPartieId(id)} />
        )}
        {currentPage === 'parties' && reviewPartieId !== null && (
          <ReviewPartie partieId={reviewPartieId} onBack={() => setReviewPartieId(null)} />
        )}
        {currentPage === 'history' && selectedPartieId === null && (
          <HistoryPage
            onSelectPartie={(partieId) => setSelectedPartieId(partieId)}
            onGoToPlay={() => setCurrentPage('play')}
            onGoToSearch={() => setCurrentPage('search')}
          />
        )}
        {currentPage === 'history' && selectedPartieId !== null && (
          <PartieDetailPage
            partieId={selectedPartieId}
            onBack={() => setSelectedPartieId(null)}
          />
        )}
        {currentPage === 'challenge' && challengeGameId && (
          challengeMode === '3d' ? (
            <MultiplayerGame3D
              gameId={challengeGameId}
              username={user?.username || 'anonymous'}
              onBack={() => { setChallengeGameId(null); setCurrentPage('friends'); }}
              fromChallenge={true}
            />
          ) : (
            <MultiplayerGame
              gameId={challengeGameId}
              username={user?.username || 'anonymous'}
              onBack={() => { setChallengeGameId(null); setCurrentPage('friends'); }}
              fromChallenge={true}
            />
          )
        )}
      </main>

      {/* ── GLOBAL CHALLENGE MODAL ────────────────────────── */}
      {incomingChallenge && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] p-8 w-full max-w-sm text-center border border-gray-100" style={{ animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div className="w-20 h-20 mx-auto bg-blue-600/10 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-blue-50">
              <Swords className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Défi Reçu !</h3>
            <p className="text-gray-600 mb-4 text-lg">
              <span className="font-bold text-blue-600">{incomingChallenge.from}</span> vous défie.
            </p>
            <div className="mb-4 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold text-center">
              Mode : {incomingChallenge.mode === '3d' ? '🎮 3D' : '♟️ 2D'}
            </div>
            <div className="flex items-center justify-center gap-3 mb-8 text-sm font-bold text-gray-500 bg-gray-50 py-3 rounded-xl border border-gray-100">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Cadence : <span className="text-gray-900">{incomingChallenge.timeControl}</span></span>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleAcceptChallenge} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-lg cursor-pointer">
                ACCEPTER
              </button>
              <button onClick={handleDeclineChallenge} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-all active:scale-95 cursor-pointer">
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
