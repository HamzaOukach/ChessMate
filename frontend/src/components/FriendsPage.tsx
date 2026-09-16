import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, UserPlus, Check, X, MessageCircle, Send,
  Users, Bell, Swords, RefreshCw, CheckCircle, AlertCircle, Info,
} from 'lucide-react';
import {
  searchPlayers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getFriends, getPendingRequests, getChatHistory, sendChatMessage, markMessagesAsRead,
  createMultiplayerGame,
} from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FriendsPageProps {
  username: string;
  onChallengeFriend?: (gameId: string, mode: '2d' | '3d') => void;
  chatWsRef: React.RefObject<WebSocket | null>;
}
interface Friend { pseudo: string; elo: number; friendshipId: number }
interface PendingReq { id: number; from: string; createdAt: string }
interface ChatMsg { id?: number; sender: string; content: string; sentAt?: string; timestamp?: number }
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

// ─── Toast icons ──────────────────────────────────────────────────────────────
const ToastIcon = ({ type }: { type: Toast['type'] }) => {
  if (type === 'success') return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
  if (type === 'error') return <AlertCircle className="w-5 h-5 text-red-500   flex-shrink-0" />;
  return <Info className="w-5 h-5 text-blue-500  flex-shrink-0" />;
};

export function FriendsPage({ username, onChallengeFriend, chatWsRef }: FriendsPageProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ pseudo: string; elo: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [challengingFriend, setChallengingFriend] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modePickFriend, setModePickFriend] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = chatWsRef; // Use the global WebSocket ref
  const toastId = useRef(0);

  // ── Floating toasts ────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Listen for DM events from global WebSocket (managed by App.tsx) ────────
  useEffect(() => {
    loadFriends();
    loadPending();

    const handleChatMessage = (ev: Event) => {
      const data = (ev as CustomEvent).detail;

      if (data.type === 'dm') {
        setChatMessages(prev => [...prev, {
          sender: data.from, content: data.content, timestamp: data.timestamp,
        }]);
        const isCurrentChat = document.querySelector('[data-active-chat]')?.getAttribute('data-active-chat') === data.from;
        if (!isCurrentChat) {
          showToast(`Nouveau message de ${data.from}`, 'info');
        }
      } else if (data.type === 'challenge_offline') {
        showToast(`${data.to} n'est pas en ligne.`, 'error');
        setChallengingFriend(null);
      }
    };

    window.addEventListener('chat:message', handleChatMessage);
    return () => window.removeEventListener('chat:message', handleChatMessage);
  }, [username]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Data loaders ───────────────────────────────────────────────────────────
  const loadFriends = async () => {
    setLoadingFriends(true);
    try { setFriends(await getFriends() ?? []); }
    catch { setFriends([]); }
    setLoadingFriends(false);
  };

  const loadPending = async () => {
    try { setPending(await getPendingRequests() ?? []); }
    catch { setPending([]); }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const r = await searchPlayers(searchQuery);
      setSearchResults((r as any[]).filter((x: any) => x.pseudo !== username));
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handleSendRequest = async (pseudo: string) => {
    try {
      await sendFriendRequest(pseudo);
      showToast(`Demande envoyée à ${pseudo} !`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de l\'envoi', 'error');
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await acceptFriendRequest(id);
      showToast('Ami ajouté !', 'success');
      loadPending(); loadFriends();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
  };

  const handleDecline = async (id: number) => {
    try {
      await declineFriendRequest(id);
      showToast('Demande refusée', 'info');
      loadPending();
    } catch (e: any) { showToast(e.message || 'Erreur', 'error'); }
  };

  const openChat = async (pseudo: string) => {
    setActiveChatFriend(pseudo);
    try {
      const history = await getChatHistory(pseudo);
      setChatMessages(Array.isArray(history) ? history : []);
      try { await markMessagesAsRead(pseudo); } catch { }
    } catch { setChatMessages([]); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeChatFriend) return;
    const content = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: username, content, timestamp: Date.now() }]);
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'dm', to: activeChatFriend, content }));
    try { await sendChatMessage(activeChatFriend, content); } catch { }
  };

  const handleChallenge = async (friendPseudo: string, mode: '2d' | '3d') => {
    if (challengingFriend) return;
    setModePickFriend(null);
    setChallengingFriend(friendPseudo);
    try {
      const result = await createMultiplayerGame(username, 5, 0);
      const gameId: string = result.gameId;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'challenge', to: friendPseudo, gameId, timeControl: '5+0', mode }));
        showToast(`Défi ${mode.toUpperCase()} envoyé à ${friendPseudo} !`, 'info');
        if (onChallengeFriend) onChallengeFriend(gameId, mode);
      } else {
        showToast('WebSocket non connecté.', 'error');
        setChallengingFriend(null);
      }
    } catch {
      showToast('Erreur lors de la création de la partie', 'error');
      setChallengingFriend(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* ── FLOATING TOASTS ─────────────────────────────────── */}
      <div className="fixed top-20 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg pointer-events-auto transition-all animate-slideInRight max-w-sm">
            <ToastIcon type={t.type} />
            <span className="text-sm font-medium text-gray-800">{t.message}</span>
          </div>
        ))}
      </div>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-3xl font-extrabold text-white tracking-tight">
          <Users className="w-8 h-8 text-cyan-400" />
          Communauté
        </h2>
        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
              <Bell className="w-4 h-4" />
              {pending.length} demande{pending.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => { loadFriends(); loadPending(); }}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm" title="Actualiser">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── LEFT COLUMN: SEARCH & PENDING ─────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-1">
          {/* SEARCH */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-600" /> Trouver des joueurs
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Pseudo..."
                  className="w-full px-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-0 transition-colors placeholder:text-gray-400"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.length < 2}
                  className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {searching ? '...' : 'Go'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 mt-4">
                  {searchResults.map(p => (
                    <div key={p.pseudo} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 group transition-colors border border-transparent hover:border-gray-100">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-sm">{p.pseudo}</span>
                        <span className="text-xs text-gray-500 font-medium tracking-wide">ELO {p.elo || '—'}</span>
                      </div>
                      <button
                        onClick={() => handleSendRequest(p.pseudo)}
                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all focus:opacity-100"
                        title="Ajouter en ami"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PENDING REQUESTS */}
          {pending.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
              <div className="p-4 bg-orange-50 border-b border-orange-100">
                <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Invitations
                </h3>
              </div>
              <div className="p-2">
                {pending.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-orange-50/50 rounded-xl transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">{req.from}</span>
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(req.id)} className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 rounded-lg hover:bg-green-500 hover:text-white transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDecline(req.id)} className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: FRIENDS LIST ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 lg:col-span-2 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-gray-400" />
              Mes amis
            </h3>
            <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {friends.length}
            </span>
          </div>

          <div className="p-2 flex-1 relative">
            {loadingFriends ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium text-sm gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Chargement...
              </div>
            ) : friends.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-900 font-bold mb-1">Votre liste d'amis est vide</p>
                <p className="text-gray-500 text-sm">Utilisez la recherche pour trouver des partenaires de jeu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {friends.map(f => (
                  <div key={f.pseudo} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm bg-white transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-inner">
                        {f.pseudo.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 leading-tight">{f.pseudo}</span>
                        <span className="text-xs font-medium text-gray-500">ELO {f.elo || '—'}</span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openChat(f.pseudo)}
                        title="Discuter"
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${activeChatFriend === f.pseudo ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setModePickFriend(modePickFriend === f.pseudo ? null : f.pseudo)}
                          disabled={challengingFriend === f.pseudo}
                          title="Défier"
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-100 text-green-700 hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Swords className="w-4 h-4" />
                        </button>
                        {modePickFriend === f.pseudo && (
                          <div className="absolute right-0 top-11 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex flex-col gap-1 w-36 animate-scaleUp">
                            <button
                              onClick={() => handleChallenge(f.pseudo, '2d')}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-800 text-sm font-medium transition-colors"
                            >
                              ♟️ Partie 2D
                            </button>
                            <button
                              onClick={() => handleChallenge(f.pseudo, '3d')}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 text-gray-800 text-sm font-medium transition-colors"
                            >
                              🎮 Partie 3D
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FLOATING CHAT PANEL ───────────────────────────────────────────── */}
      {activeChatFriend && (
        <div className="fixed bottom-0 right-4 sm:right-8 w-full max-w-[340px] bg-white rounded-t-2xl shadow-[0_0_40px_rgba(0,0,0,0.15)] border border-gray-200 z-50 flex flex-col h-[480px] max-h-[80vh] overflow-hidden transform animate-slideUp"
          data-active-chat={activeChatFriend}>

          {/* Header */}
          <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 cursor-pointer" onClick={() => setActiveChatFriend(null)}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs ring-2 ring-white">
                  {activeChatFriend.charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm leading-none mb-0.5">{activeChatFriend}</span>
                <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">En ligne</span>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
            {chatMessages.filter(m => m.sender === activeChatFriend || m.sender === username).length === 0 && (
              <div className="m-auto text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm max-w-[80%]">
                <MessageCircle className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Dites bonjour à {activeChatFriend} !</p>
              </div>
            )}

            {chatMessages
              .filter(m => m.sender === activeChatFriend || m.sender === username)
              .map((msg, i) => {
                const isMe = msg.sender === username;
                return (
                  <div key={i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl relative group ${isMe
                      ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                      }`}>
                      <p className="text-[13px] leading-relaxed break-words">{msg.content}</p>
                      <span className={`text-[9px] font-medium uppercase mt-1 block opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-blue-200 text-right' : 'text-gray-400 text-left'}`}>
                        {msg.sentAt
                          ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : msg.timestamp
                            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Maintenant'}
                      </span>
                    </div>
                  </div>
                );
              })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Votre message..."
              className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-400"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${chatInput.trim()
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-105'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── CSS Animations ────────────────────────────────── */}
      <style>{`
        @keyframes slideInRight {
          0% { opacity: 0; transform: translateX(2rem) scale(0.95); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideUp {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes scaleUp {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-slideInRight { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scaleUp { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
