const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Helper for building API URLs dynamically
const getApiUrl = (envVar: string | undefined, localPort: string) => {
    if (envVar) return envVar.endsWith('/') ? envVar.slice(0, -1) : envVar;
    if (isLocalhost) return `http://localhost:${localPort}`;
    return ''; // Relative URL when deployed (proxied via Nginx or Traefik)
};

export const BACKEND_API_URL = getApiUrl(import.meta.env.VITE_API_URL, '8080');
export const ML_BOT_API_URL = getApiUrl(import.meta.env.VITE_ML_API_URL, '8002');
export const STOCKFISH_API_URL = getApiUrl(import.meta.env.VITE_STOCKFISH_API_URL, '8001');

// Resolve WebSocket URL
const currentWsHost = window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
export const WS_API_URL = ML_BOT_API_URL ? ML_BOT_API_URL.replace('http://', 'ws://').replace('https://', 'wss://') : currentWsHost;

// Helper pour récupérer le token JWT du localStorage
const getAuthToken = (): string | null => {
    return localStorage.getItem('jwt_token');
};

// Helper pour les requêtes authentifiées (Backend)
export const fetchWithAuth = async (
    endpoint: string,
    options: RequestInit = {},
    isFormData: boolean = false
) => {
    const token = getAuthToken();

    const headers: any = {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    // ❗ NE PAS ajouter Content-Type si FormData
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            window.dispatchEvent(new Event('auth:expired'));
        }
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData || errorMessage;
        } catch (e) {
            try {
                const textError = await response.text();
                if (textError) errorMessage = textError;
            } catch (e2) { }
        }
        throw new Error(errorMessage);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
};

// =========================================================
// CHEAT DETECTION
// =========================================================

export const analyzeCheat = async (payload: { pgn: string; eloWhite: number; eloBlack: number }, save = false) => {
    const endpoint = save ? "/api/cheat/analyze-and-save" : "/api/cheat/analyze";
    return fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
    });
};

export const getCheatHistory = async () => {
    return fetchWithAuth("/api/cheat/history");
};

// =========================================================
// STATS PER PLAYER
// =========================================================

export const getAllStats = async (id: number) => {
    return fetchWithAuth(`/api/stats/joueur/${id}/allStats`);
};

export const getStatsCouleur = async (id: number) => {
    return fetchWithAuth(`/api/stats/joueur/${id}/couleurs`);
};

export const getAllMyParties = async (id: number) => {
    return fetchWithAuth(`/api/stats/joueur/${id}/last-parties`);
};

export const getInfoPartie = async (id: number) => {
    return fetchWithAuth(`/api/stats/partie/${id}/info`);
};

// =========================================================
// ETL UPLOAD
// =========================================================

export const uploadFile = async (file: File, joueurId: string): Promise<{ jobId: string }> => {
    const formData = new FormData();
    formData.append("joueurId", String(joueurId));
    formData.append("file", file);

    return fetchWithAuth("/api/etl/upload", {
        method: "POST",
        body: formData,
    }, true);
};

export const getEtlStatus = async (jobId: string) => {
    return fetchWithAuth(`/api/etl/status/${jobId}`);
};

// =========================================================
// JOUEURS & PARTIES
// =========================================================

export const getJoueurByPseudo = async (pseudo: string) => {
    return fetchWithAuth(`/api/joueurs/search?pseudo=${encodeURIComponent(pseudo)}`);
};

// Recherche les parties d'un joueur sur Lichess via l'API proxy backend
export const searchPlayerGames = async (
    pseudo: string,
    options?: { debut?: number; fin?: number; max?: number }
): Promise<string> => {
    const params = new URLSearchParams();
    if (options?.debut) params.append('debut', options.debut.toString());
    if (options?.fin) params.append('fin', options.fin.toString());
    if (options?.max) params.append('max', options.max.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
        `${BACKEND_API_URL}/api/parties/${encodeURIComponent(pseudo)}${query}`,
        {
            method: 'GET',
            signal: AbortSignal.timeout(15000),
        }
    );

    if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }

    return response.text();
};

// Recherche une partie par son ID sur Lichess
export const searchGameById = async (id: string): Promise<string> => {
    const response = await fetch(`${BACKEND_API_URL}/api/partie/${encodeURIComponent(id)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }

    return response.text();
};

// Récupère toutes les parties
export const getAllParties = async () => {
    return fetchWithAuth('/api/parties');
};

export const getPartieById = async (id: number) => {
    return fetchWithAuth(`/api/parties/${id}`);
};

export const getPartieJoueurs = async (id: number) => {
    return fetchWithAuth(`/api/parties/${id}/joueurs`);
};

export const getJoueurById = async (id: number) => {
    return fetchWithAuth(`/api/joueurs/${id}`);
};

// =========================================================
// PARTIES JOUÉES (saved games)
// =========================================================

export const getAllPartiesJouees = async (pseudo?: string) => {
    const query = pseudo ? `?pseudo=${encodeURIComponent(pseudo)}` : '';
    return fetchWithAuth(`/parties-jouees${query}`);
};

export const getPartieJoueeById = async (id: number) => {
    return fetchWithAuth(`/parties-jouees/${id}`);
};

export const createPartieJouee = async (payload: {
    titre: string;
    joueurBlanc: string;
    joueurNoir: string;
    resultat: string;
    variant: string;
    ouverture: string;
    source: string;
    vainqueur: string;
    nombreCoups: number;
    pgn: string;
    resumeAnalyse: string;
}) => {
    return fetchWithAuth('/parties-jouees', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

// Récupère le profil ML de l'utilisateur connecté de façon sécurisée
export const getMyMlProfile = async () => {
  return fetchWithAuth('/api/ml/profile/me');
};

// =========================================================
// STOCKFISH
// =========================================================

export const getStockfishBestMove = async (
    moves: string,
    mode: 'depth' | 'movetime' = 'depth',
    color: 'white' | 'black' = 'black',
    depth: number = 15,
    movetime: number = 1000
): Promise<string> => {
    try {
        const params = new URLSearchParams({
            moves: moves || '',
            mode,
            color,
            depth: depth.toString(),
            movetime: movetime.toString(),
        });

        const response = await fetch(`${STOCKFISH_API_URL}/api/chess/bestmove?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Stockfish API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.bestmove || 'e2e4';
    } catch (error) {
        console.error('❌ Stockfish API Error:', error);
        throw error;
    }
};

// Stockfish - Évaluer une position (retourne le score en centipawns)
export const evaluatePosition = async (
    moves: string,
    depth: number = 15
): Promise<{ score: number; isMate: boolean; bestMove: string }> => {
    try {
        const params = new URLSearchParams({
            moves: moves || '',
            depth: depth.toString(),
        });

        const response = await fetch(`${BACKEND_API_URL}/api/chess/evaluate?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Evaluate API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            score: data.score || 0,
            isMate: data.isMate || false,
            bestMove: data.bestMove || 'e2e4',
        };
    } catch (error) {
        console.error('Evaluate API Error:', error);
        throw error;
    }
};

// Stockfish - Analyser une position (wrapper legacy)
export const analyzePosition = async (
    moves: string,
    depth: number = 20
): Promise<{ bestmove: string; evaluation: number }> => {
    const bestMove = await getStockfishBestMove(moves, 'depth', 'black', depth, 3000);
    return { bestmove: bestMove, evaluation: 0 };
};

// =========================================================
// ML BOT
// =========================================================

export const getCustomBotMove = async (
    moves: string,
    color: 'white' | 'black' = 'black'
): Promise<string> => {
    try {
        const params = new URLSearchParams({ moves: moves || '', color });

        const response = await fetch(`${ML_BOT_API_URL}/api/chess/custom-bot?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            throw new Error(`ML Bot API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.bestmove || 'e2e4';
    } catch (error) {
        console.error('❌ ML Bot API Error:', error);
        throw error;
    }
};

// =========================================================
// FRIENDS
// =========================================================

export const searchPlayers = async (query: string) => {
    return fetchWithAuth(`/api/friends/search?query=${encodeURIComponent(query)}`);
};

export const sendFriendRequest = async (pseudo: string) => {
    return fetchWithAuth('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ pseudo }),
    });
};

export const acceptFriendRequest = async (id: number) => {
    return fetchWithAuth(`/api/friends/accept/${id}`, { method: 'POST' });
};

export const declineFriendRequest = async (id: number) => {
    return fetchWithAuth(`/api/friends/decline/${id}`, { method: 'POST' });
};

export const getFriends = async () => {
    return fetchWithAuth('/api/friends');
};

export const getPendingRequests = async () => {
    return fetchWithAuth('/api/friends/pending');
};

// =========================================================
// CHAT (REST)
// =========================================================

export const getChatHistory = async (pseudo: string) => {
    return fetchWithAuth(`/api/chat/history/${encodeURIComponent(pseudo)}`);
};

export const sendChatMessage = async (to: string, content: string) => {
    return fetchWithAuth('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ to, content }),
    });
};

export const getUnreadCount = async () => {
    return fetchWithAuth('/api/chat/unread');
};

export const markMessagesAsRead = async (pseudo: string) => {
    return fetchWithAuth(`/api/chat/read/${encodeURIComponent(pseudo)}`, { method: 'POST' });
};

// =========================================================
// MULTIPLAYER
// =========================================================

export const createMultiplayerGame = async (username: string, timeMinutes: number, increment: number) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, timeMinutes, increment }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur API');
    }
    return response.json();
};

export const joinMultiplayerGame = async (gameId: string, username: string) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/join/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur API');
    }
    return response.json();
};

export const joinMatchmaking = async (username: string, timeMinutes: number, increment: number) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/matchmaking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, timeMinutes, increment }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur de matchmaking');
    }
    return response.json();
};

export const cancelMatchmaking = async (username: string) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/cancel-matchmaking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    return response.json();
};

export const checkMatch = async (username: string) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/check-match?username=${encodeURIComponent(username)}`);
    return response.json();
};

export const getGameStatus = async (gameId: string) => {
    const response = await fetch(`${ML_BOT_API_URL}/api/chess/multiplayer/status/${gameId}`);
    return response.json();
};

export const getPlayerOnlineGames = async (pseudo: string) => {
    const response = await fetch(`${BACKEND_API_URL}/api/online-parties/player/${encodeURIComponent(pseudo)}`);
    return response.json();
};

// =========================================================
// WEBSOCKET HELPERS
// =========================================================

export const connectGameWebSocket = (gameId: string): WebSocket => {
    return new WebSocket(`${WS_API_URL}/api/chess/ws/game/${gameId}`);
};

export const connectChatWebSocket = (): WebSocket => {
    return new WebSocket(`${WS_API_URL}/api/chess/ws/chat`);
};
