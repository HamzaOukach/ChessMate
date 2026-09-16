import { useState } from 'react';
import { Search, Loader2, User, ExternalLink, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { searchPlayerGames } from '../services/api';

interface ParsedGame {
    event: string;
    white: string;
    black: string;
    result: string;
    date: string;
    whiteElo: string;
    blackElo: string;
    opening: string;
    timeControl: string;
    site: string;
    moves: string;
    variant: string;
}

/** Parse un bloc PGN multi-parties en tableau d'objets */
function parsePgnGames(pgn: string): ParsedGame[] {
    if (!pgn || pgn.trim() === '') return [];

    const games: ParsedGame[] = [];
    // Split par double saut de ligne pour separer headers et coups
    const sections = pgn.split(/\n\n/).filter(s => s.trim() !== '');

    let currentHeaders: Record<string, string> = {};

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('[')) {
            // Nouveau bloc de headers : si on avait des headers precedents sans coups, les pusher
            if (Object.keys(currentHeaders).length > 0) {
                games.push(buildGame(currentHeaders, ''));
            }
            currentHeaders = {};
            const headerLines = trimmed.split('\n');
            for (const line of headerLines) {
                const match = line.match(/^\[(\w+)\s+"(.*)"\]$/);
                if (match) {
                    currentHeaders[match[1]] = match[2];
                }
            }
        } else {
            // Bloc de coups : on le combine avec les headers courants
            const moves = trimmed.replace(/\n/g, ' ').trim();
            if (Object.keys(currentHeaders).length > 0) {
                games.push(buildGame(currentHeaders, moves));
                currentHeaders = {};
            }
        }
    }

    // Derniere partie si elle n'a pas de coups
    if (Object.keys(currentHeaders).length > 0) {
        games.push(buildGame(currentHeaders, ''));
    }

    return games;
}

function buildGame(headers: Record<string, string>, moves: string): ParsedGame {
    return {
        event: headers['Event'] || '?',
        white: headers['White'] || '?',
        black: headers['Black'] || '?',
        result: headers['Result'] || '?',
        date: headers['UTCDate'] || headers['Date'] || '?',
        whiteElo: headers['WhiteElo'] || '?',
        blackElo: headers['BlackElo'] || '?',
        opening: headers['Opening'] || headers['ECO'] || '?',
        timeControl: headers['TimeControl'] || '?',
        site: headers['Site'] || '',
        moves: moves,
        variant: headers['Variant'] || 'Standard',
    };
}

function getResultLabel(result: string, playerPseudo: string, white: string): { label: string; color: string } {
    const isWhite = white.toLowerCase() === playerPseudo.toLowerCase();
    if (result === '1-0') {
        return isWhite
            ? { label: 'Victoire', color: 'bg-green-100 text-green-800' }
            : { label: 'Defaite', color: 'bg-red-100 text-red-800' };
    }
    if (result === '0-1') {
        return isWhite
            ? { label: 'Defaite', color: 'bg-red-100 text-red-800' }
            : { label: 'Victoire', color: 'bg-green-100 text-green-800' };
    }
    return { label: 'Nulle', color: 'bg-gray-100 text-gray-800' };
}

function formatTimeControl(tc: string): string {
    if (!tc || tc === '?') return '?';
    const parts = tc.split('+');
    const base = parseInt(parts[0]);
    const inc = parts[1] ? parseInt(parts[1]) : 0;
    if (base < 60) return `${base}s+${inc}s`;
    const minutes = Math.floor(base / 60);
    if (inc > 0) return `${minutes}+${inc}`;
    return `${minutes} min`;
}

export function PlayerSearch() {
    const [pseudo, setPseudo] = useState('');
    const [maxGames, setMaxGames] = useState(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [games, setGames] = useState<ParsedGame[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedGame, setExpandedGame] = useState<number | null>(null);
    const [searchedPseudo, setSearchedPseudo] = useState('');

    const handleSearch = async () => {
        const trimmed = pseudo.trim();
        if (!trimmed) {
            setError('Veuillez entrer un pseudo.');
            return;
        }

        setLoading(true);
        setError(null);
        setGames([]);
        setHasSearched(true);
        setSearchedPseudo(trimmed);

        try {
            const pgn = await searchPlayerGames(trimmed, { max: maxGames });
            if (!pgn || pgn.trim() === '') {
                setGames([]);
            } else {
                const parsed = parsePgnGames(pgn);
                setGames(parsed);
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('404')) {
                    setError(`Aucun joueur trouve avec le pseudo "${trimmed}" sur Lichess.`);
                } else {
                    setError(err.message);
                }
            } else {
                setError('Une erreur est survenue lors de la recherche.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-white-900 mb-2">Recherche de parties Lichess</h2>
                <p className="text-white-600">
                    Recherchez les parties d'un joueur directement depuis l'API Lichess
                </p>
            </div>

            {/* Barre de recherche */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Entrez un pseudo Lichess (ex: DrNykterstein)"
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 whitespace-nowrap">Max:</label>
                        <select
                            value={maxGames}
                            onChange={(e) => setMaxGames(Number(e.target.value))}
                            className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                        Rechercher
                    </button>
                </div>
            </div>

            {/* Erreur */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Resume statistiques */}
            {games.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <div className="text-2xl font-semibold text-gray-900">{games.length}</div>
                        <div className="text-sm text-gray-600">Parties trouvees</div>
                    </div>
                    <div className="bg-green-50 rounded-lg shadow p-4 text-center">
                        <div className="text-2xl font-semibold text-green-700">
                            {games.filter(g => getResultLabel(g.result, searchedPseudo, g.white).label === 'Victoire').length}
                        </div>
                        <div className="text-sm text-green-600">Victoires</div>
                    </div>
                    <div className="bg-red-50 rounded-lg shadow p-4 text-center">
                        <div className="text-2xl font-semibold text-red-700">
                            {games.filter(g => getResultLabel(g.result, searchedPseudo, g.white).label === 'Defaite').length}
                        </div>
                        <div className="text-sm text-red-600">Defaites</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg shadow p-4 text-center">
                        <div className="text-2xl font-semibold text-gray-700">
                            {games.filter(g => getResultLabel(g.result, searchedPseudo, g.white).label === 'Nulle').length}
                        </div>
                        <div className="text-sm text-gray-600">Nulles</div>
                    </div>
                </div>
            )}

            {/* Liste des parties */}
            {games.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h3 className="text-gray-900">
                            Parties de <span className="text-blue-600 font-semibold">{searchedPseudo}</span>
                        </h3>
                    </div>
                    <div className="divide-y">
                        {games.map((game, index) => {
                            const result = getResultLabel(game.result, searchedPseudo, game.white);
                            const opponent =
                                game.white.toLowerCase() === searchedPseudo.toLowerCase()
                                    ? game.black
                                    : game.white;
                            const playerColor =
                                game.white.toLowerCase() === searchedPseudo.toLowerCase()
                                    ? 'Blancs'
                                    : 'Noirs';
                            const isExpanded = expandedGame === index;

                            return (
                                <div key={index} className="hover:bg-gray-50 transition-colors">
                                    <div
                                        className="p-4 flex items-center gap-4 cursor-pointer"
                                        onClick={() => setExpandedGame(isExpanded ? null : index)}
                                    >
                                        {/* Indicateur couleur */}
                                        <div
                                            className={`w-4 h-4 rounded-full border-2 ${playerColor === 'Blancs'
                                                ? 'bg-white border-gray-400'
                                                : 'bg-gray-800 border-gray-800'
                                                }`}
                                            title={playerColor}
                                        />

                                        {/* Info principale */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-900 font-medium truncate">
                                                    vs {opponent}
                                                </span>
                                                {game.opening !== '?' && (
                                                    <span className="text-xs text-gray-500 truncate hidden sm:inline">
                                                        {game.opening}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                                <span>{game.date.replace(/\./g, '/')}</span>
                                                <span>{formatTimeControl(game.timeControl)}</span>
                                                <span>{game.event}</span>
                                            </div>
                                        </div>

                                        {/* Elo */}
                                        <div className="text-sm text-gray-500 hidden md:block">
                                            {game.white.toLowerCase() === searchedPseudo.toLowerCase()
                                                ? game.whiteElo
                                                : game.blackElo}{' '}
                                            Elo
                                        </div>

                                        {/* Badge resultat */}
                                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${result.color}`}>
                                            {result.label}
                                        </div>

                                        {/* Lien Lichess */}
                                        {game.site && game.site.startsWith('http') && (
                                            <a
                                                href={game.site}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-blue-500 hover:text-blue-700"
                                                title="Voir sur Lichess"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}

                                        {/* Fleche deplier */}
                                        {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                        )}
                                    </div>

                                    {/* Details deplies */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 border-t bg-gray-50">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Evenement</span>
                                                        <span className="text-gray-900">{game.event}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Blancs</span>
                                                        <span className="text-gray-900">{game.white} ({game.whiteElo})</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Noirs</span>
                                                        <span className="text-gray-900">{game.black} ({game.blackElo})</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Ouverture</span>
                                                        <span className="text-gray-900">{game.opening}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Variante</span>
                                                        <span className="text-gray-900">{game.variant}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Resultat</span>
                                                        <span className="text-gray-900 font-medium">{game.result}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Coups</div>
                                                    <div className="bg-white p-3 rounded border text-sm font-mono text-gray-700 max-h-40 overflow-y-auto">
                                                        {game.moves || 'Aucun coup disponible'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Etat vide */}
            {hasSearched && !loading && games.length === 0 && !error && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Aucune partie trouvee pour ce joueur.</p>
                </div>
            )}
        </div>
    );
}
