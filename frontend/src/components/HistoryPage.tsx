import { getAllPartiesJouees, BACKEND_API_URL } from '../services/api';
import { loadGameMLMap, getGameMLByPlayers } from '../services/mlData';
import { inferGameML } from '../services/mlInference';
import { useEffect, useMemo, useState } from 'react';
import { MLPlayerDashboard } from './MLPlayerDashboard';
import { MLGameBadges, MlInsightBadge } from './MLGameBadges';
import type { GameMLData } from '../types/gameML';

type JoueurMini = { pseudonyme?: string };
type OuvertureMini = { libelle?: string };

type Partie = {
  id: number;
  title?: string;
  dateHeureUTC?: string;
  typeResultat?: string;
  joueurBlanc?: JoueurMini;
  joueurNoir?: JoueurMini;
  ouverture?: OuvertureMini;
  lichessId?: string;
  eloBlanc?: number;
  eloNoir?: number;
  nombreCoups?: number;
  cadence?: string;
  victoryStatus?: string;
  openingEco?: string;
  // ── Champs ML générés par predict_game.py ──────────────────────────
  mlInsight?: string;  // Message statistique dynamique
  mlTag?: string;      // Tag court : 'Exploit' | 'Logique' | 'Équilibré'
  probWhite?: number;  // Probabilité victoire blanche  [0–1]
  probBlack?: number;  // Probabilité victoire noire    [0–1]
  probDraw?: number;   // Probabilité nulle             [0–1]
};

type HistoryPageProps = {
  onSelectPartie?: (partieId: number) => void;
  onGoToSearch?: () => void;
  onGoToPlay?: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getResultStyle(result?: string): {
  bg: string; color: string; border: string; label: string; dot: string;
} {
  const v = (result || '').toLowerCase();
  if (v.includes('blanc') || v.includes('white'))
    return { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0', label: result || 'Victoire blanc', dot: '#059669' };
  if (v.includes('noir') || v.includes('black'))
    return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: result || 'Victoire noir', dot: '#2563eb' };
  if (v.includes('nul') || v.includes('draw'))
    return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', label: result || 'Nulle', dot: '#9ca3af' };
  return { bg: '#fef9c3', color: '#92400e', border: '#fde68a', label: result || 'Résultat inconnu', dot: '#d97706' };
}

function getVictoryIcon(victoryStatus?: string): string {
  if (!victoryStatus) return '';
  switch (victoryStatus.toLowerCase()) {
    case 'mate': return '♟ Mat';
    case 'resign': return '🏳 Abandon';
    case 'outoftime': return '⏱ Timeout';
    case 'draw': return '🤝 Nulle';
    default: return '';
  }
}

function formatDate(value?: string): string {
  if (!value) return 'Date inconnue';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCadence(cadence?: string): string {
  if (!cadence) return '';
  const lower = cadence.toLowerCase();
  if (lower === 'bullet') return '⚡ Bullet';
  if (lower === 'blitz') return '🔥 Blitz';
  if (lower === 'rapid') return '🕐 Rapid';
  if (lower === 'classical') return '♟ Classical';
  if (/^\d+\+\d+$/.test(cadence)) return `⏱ ${cadence}`;
  return cadence;
}

// ── Composant principal ────────────────────────────────────────────────────

export function HistoryPage({ onSelectPartie, onGoToSearch, onGoToPlay }: HistoryPageProps) {
  const [parties, setParties] = useState<Partie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [usingDemo, setUsingDemo] = useState(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [resultFilter, setResultFilter] = useState<'all' | 'blanc' | 'noir' | 'nulle'>('all');
  const [mlMap, setMlMap] = useState<Map<string, GameMLData>>(new Map());
  // Map secondaire : clé = partieId, valeur = données ML pré-résolues
  const [mlByPartieId, setMlByPartieId] = useState<Map<number, GameMLData & { _source: 'csv' | 'inferred' }>>(new Map());

  const API_URL = BACKEND_API_URL;

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError('');
        setUsingDemo(false);

        const token = localStorage.getItem('jwt_token');
        let isBackendIndisponible = false;

        // Fetch ML Data en parallèle (ne bloque pas l'affichage)
        Promise.resolve(loadGameMLMap()).then((mlMapRes) => setMlMap(mlMapRes)).catch(console.error);

        let apiParties: Partie[] = [];
        let partiesJouees: Partie[] = [];
        let onlineParties: Partie[] = [];

        // 1. Fetch Lichess games (via Backend Proxy)
        try {
          const partiesResponse = await fetch(`${API_URL}/api/parties`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (partiesResponse.ok) {
            const data = await partiesResponse.json();
            apiParties = Array.isArray(data) ? data : [];
          }
        } catch (e) {
          console.error("Erreur parties API:", e);
        }

        // 2. Fetch Local app games
        try {
          const currentUsername = localStorage.getItem('username');
          const played = await getAllPartiesJouees(currentUsername || undefined);

          if (Array.isArray(played)) {
            partiesJouees = played.map((p: any) => ({
              id: -p.id,
              title: p.titre,
              dateHeureUTC: p.dateHeure,
              typeResultat: p.resultat,
              victoryStatus: p.vainqueur === 'blanc' ? 'resign' : p.vainqueur === 'noir' ? 'resign' : p.vainqueur === 'nul' ? 'draw' : undefined,
              joueurBlanc: { pseudonyme: p.joueurBlanc },
              joueurNoir: { pseudonyme: p.joueurNoir },
              ouverture: { libelle: p.ouverture || 'Partie locale' },
              nombreCoups: p.nombreCoups ?? undefined,
              cadence: p.variant ?? undefined,
              lichessId: p.lichessId ?? undefined,
              eloBlanc: p.eloBlanc ?? undefined,
              eloNoir: p.eloNoir ?? undefined,
              mlInsight: p.mlInsight ?? p.mlinsight ?? p.ml_insight,
              mlTag: p.mlTag ?? p.mltag ?? p.ml_tag,
              probWhite: p.probWhite ?? p.prob_white ?? p.probwhite,
              probBlack: p.probBlack ?? p.prob_black ?? p.probblack,
              probDraw: p.probDraw ?? p.prob_draw ?? p.probdraw,
            }));
          }
        } catch (e) {
          console.error("Erreur parties jouées:", e);
        }

        // 3. Fetch Online Multiplayer games
        try {
          const currentUsername = localStorage.getItem('username');
          if (currentUsername) {
            const onlineResp = await fetch(`${API_URL}/api/online-parties/player/${encodeURIComponent(currentUsername)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (onlineResp.ok) {
              const data = await onlineResp.json();
              onlineParties = Array.isArray(data) ? data.map((p: any) => ({
                id: 2000000 + (p.id || Math.floor(Math.random() * 1000000)), // Range 2M+ for OnlinePartie
                title: `Multiplayer ${p.gameId}`,
                dateHeureUTC: p.playedAt,
                typeResultat: p.resultat === 1 ? 'Victoire blanc' : p.resultat === -1 ? 'Victoire noir' : 'Nulle',
                victoryStatus: p.resultType,
                joueurBlanc: { pseudonyme: p.white },
                joueurNoir: { pseudonyme: p.black },
                eloBlanc: p.whiteElo,
                eloNoir: p.blackElo,
                ouverture: { libelle: 'Multiplayer' },
                nombreCoups: p.totalMoves,
                cadence: p.timeControl,
              })) : [];
            }
          }
        } catch (e) {
          console.error("Erreur parties en ligne:", e);
        }

        const allParties = [...partiesJouees, ...onlineParties, ...apiParties];
        
        if (allParties.length === 0 && (apiParties.length === 0)) {
           // Si tout est vide, on peut supposer un souci backend si l'utilisateur s'attendait à des données
        }

        setParties(allParties);

        // ── Enrichissement ML asynchrone avec double matching ──────────────
        // Pour chaque partie sans lichessId, on tente un matching par joueurs
        if (allParties.length > 0) {
          const enrichML = async () => {
            const newMap = new Map<number, GameMLData & { _source: 'csv' | 'inferred' }>();
            await Promise.allSettled(
              allParties.map(async (partie) => {
                // Priorité 1 : match direct par lichessId
                if (partie.lichessId) {
                  const csvMatch = (await loadGameMLMap()).get(partie.lichessId);
                  if (csvMatch) {
                    newMap.set(partie.id, { ...csvMatch, _source: 'csv' });
                    return;
                  }
                }

                // Priorité 2 : match par joueurs (white vs black)
                const white = partie.joueurBlanc?.pseudonyme;
                const black = partie.joueurNoir?.pseudonyme;
                if (white && black) {
                  const playerMatch = await getGameMLByPlayers(white, black);
                  if (playerMatch) {
                    newMap.set(partie.id, { ...playerMatch, _source: 'csv' });
                    return;
                  }
                }

                // Priorité 3 : inférence locale
                const inferred = inferGameML(
                  {
                    id: partie.id,
                    typeResultat: partie.typeResultat,
                    victoryStatus: partie.victoryStatus,
                    openingName: partie.ouverture?.libelle,
                    openingEco: partie.openingEco,
                    eloBlanc: partie.eloBlanc,
                    eloNoir: partie.eloNoir,
                    nombreCoups: partie.nombreCoups,
                    cadence: partie.cadence,
                  },
                  'inferred',
                );
                newMap.set(partie.id, inferred);
              }),
            );
            setMlByPartieId(newMap);
          };
          enrichML().catch(console.error);
        }
      } catch (err) {
        console.error(err);
        setUsingDemo(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [API_URL]);

  const filteredParties = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = [...parties];

    if (term) {
      result = result.filter((p) =>
        (p.title?.toLowerCase() || '').includes(term) ||
        (p.joueurBlanc?.pseudonyme?.toLowerCase() || '').includes(term) ||
        (p.joueurNoir?.pseudonyme?.toLowerCase() || '').includes(term) ||
        (p.ouverture?.libelle?.toLowerCase() || '').includes(term) ||
        (p.typeResultat?.toLowerCase() || '').includes(term)
      );
    }

    if (resultFilter !== 'all') {
      result = result.filter((p) => {
        const v = (p.typeResultat || '').toLowerCase();
        if (resultFilter === 'blanc') return v.includes('blanc') || v.includes('white');
        if (resultFilter === 'noir')  return v.includes('noir')  || v.includes('black');
        if (resultFilter === 'nulle') return v.includes('nul') || v.includes('draw');
        return true;
      });
    }

    result.sort((a, b) => {
      const da = a.dateHeureUTC ? new Date(a.dateHeureUTC).getTime() : 0;
      const db = b.dateHeureUTC ? new Date(b.dateHeureUTC).getTime() : 0;
      return sortOrder === 'recent' ? db - da : da - db;
    });

    return result;
  }, [parties, search, resultFilter, sortOrder]);

  // ── Styles réutilisables ──
  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: '0.875rem',
    color: '#374151',
    background: '#ffffff',
    outline: 'none',
    cursor: 'pointer',
  };

  // Nombre de parties matchées via CSV
  const csvMatchCount = Array.from(mlByPartieId.values()).filter(v => v._source === 'csv').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Titre ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
            Historique des parties
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Consultez vos parties avec leur analyse Machine Learning intégrée.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {mlMap.size > 0 && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 600,
              background: '#eef2ff', color: '#4f46e5',
              border: '1px solid #c7d2fe',
              borderRadius: 99, padding: '4px 12px',
            }}>
              🤖 ML actif · {mlMap.size.toLocaleString('fr-FR')} parties
            </span>
          )}
          {csvMatchCount > 0 && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 600,
              background: '#f0fdf4', color: '#059669',
              border: '1px solid #bbf7d0',
              borderRadius: 99, padding: '4px 12px',
            }}>
              📂 {csvMatchCount} matchée(s) CSV
            </span>
          )}
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            background: usingDemo ? '#fffbeb' : '#f0fdf4',
            color: usingDemo ? '#92400e' : '#059669',
            border: `1px solid ${usingDemo ? '#fde68a' : '#bbf7d0'}`,
            borderRadius: 99, padding: '4px 12px',
          }}>
            {usingDemo ? '⚠ Backend hors ligne' : '✓ Source API'}
          </span>
        </div>
      </div>

      {/* Bandeau démo */}
      {usingDemo && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, padding: '12px 16px',
          fontSize: '0.875rem', color: '#92400e',
        }}>
          <strong>Backend non joignable</strong> — Les parties affichées proviennent du cache local ou de l'API.
          Vérifiez la connexion au serveur.
        </div>
      )}

      {/* ── Dashboard ML global ── */}
      <MLPlayerDashboard />

      {/* ── Filtres & recherche ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 14, padding: '18px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Rechercher une partie
          </label>
          <input
            id="history-search"
            type="text"
            placeholder="Titre, joueur, ouverture, résultat…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px',
              border: '1px solid #e5e7eb', borderRadius: 8,
              fontSize: '0.875rem', color: '#374151',
              background: '#f9fafb', outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#6366f1';
              (e.target as HTMLInputElement).style.background = '#fff';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#e5e7eb';
              (e.target as HTMLInputElement).style.background = '#f9fafb';
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Filtrer par résultat
            </label>
            <select
              id="history-result-filter"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as typeof resultFilter)}
              style={selectStyle}
            >
              <option value="all">Tous les résultats</option>
              <option value="blanc">Victoire blanc</option>
              <option value="noir">Victoire noir</option>
              <option value="nulle">Nulle</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Trier par date
            </label>
            <select
              id="history-sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              style={selectStyle}
            >
              <option value="recent">Plus récentes d'abord</option>
              <option value="oldest">Plus anciennes d'abord</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Liste des parties ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* Compteur */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fafafa',
        }}>
          <span style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 500 }}>
            {loading ? 'Chargement…' : `${filteredParties.length} partie(s) trouvée(s)`}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            <div style={{ marginBottom: 8, fontSize: '1.5rem' }}>⏳</div>
            Chargement des parties…
          </div>
        )}

        {/* Erreur */}
        {!loading && error && (
          <div style={{ padding: '20px 24px', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>
        )}

        {/* Liste vide */}
        {!loading && !error && filteredParties.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>♟</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
              Aucune partie enregistrée
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0 0 20px' }}>
              Lancez une nouvelle partie ou importez des parties Lichess pour commencer.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                id="history-go-play"
                onClick={onGoToPlay}
                style={{
                  padding: '9px 20px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff', fontWeight: 600, border: 'none',
                  cursor: 'pointer', fontSize: '0.875rem',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}
              >
                Nouvelle partie
              </button>
              <button
                id="history-go-search"
                onClick={onGoToSearch}
                style={{
                  padding: '9px 20px', borderRadius: 8,
                  background: '#f3f4f6', color: '#374151',
                  fontWeight: 600, border: '1px solid #e5e7eb',
                  cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Rechercher sur Lichess
              </button>
            </div>
          </div>
        )}

        {/* ── Cartes de parties ── */}
        {!loading && !error && filteredParties.length > 0 && (
          <div>
            {filteredParties.map((partie, idx) => {
              // Récupère les données ML pré-résolues (csv > players > inferred)
              const mlData: GameMLData & { _source: 'csv' | 'inferred' } =
                mlByPartieId.get(partie.id) ??
                inferGameML(
                  {
                    id: partie.id,
                    typeResultat: partie.typeResultat,
                    victoryStatus: partie.victoryStatus,
                    openingName: partie.ouverture?.libelle,
                    openingEco: partie.openingEco,
                    eloBlanc: partie.eloBlanc,
                    eloNoir: partie.eloNoir,
                    nombreCoups: partie.nombreCoups,
                    cadence: partie.cadence,
                  },
                  'inferred',
                );

              const resultStyle = getResultStyle(partie.typeResultat);
              const victoryIcon = getVictoryIcon(partie.victoryStatus);
              const cadenceLabel = formatCadence(partie.cadence);
              const isCSV = mlData._source === 'csv';

              return (
                <div
                  key={partie.id}
                  id={`history-game-card-${partie.id}`}
                  style={{
                    borderBottom: idx < filteredParties.length - 1 ? '1px solid #f3f4f6' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafbff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  {/* ── Bande colorée résultat (top border) */}
                  <div style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${resultStyle.dot}, ${resultStyle.dot}40)`,
                    borderRadius: '2px 2px 0 0',
                  }} />

                  <div style={{ padding: '18px 22px 20px' }}>

                    {/* ── Ligne 1 : Titre + résultat + bouton ── */}
                    <div style={{
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: 12,
                      marginBottom: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Titre */}
                        <h3 style={{
                          margin: '0 0 6px', fontSize: '1rem', fontWeight: 700,
                          color: '#111827',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {partie.title || `Partie #${Math.abs(partie.id)}`}
                        </h3>
                        {/* Badges résultat + fin */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 99,
                            background: resultStyle.bg, color: resultStyle.color,
                            border: `1px solid ${resultStyle.border}`,
                            fontSize: '0.72rem', fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {resultStyle.label}
                          </span>
                          {victoryIcon && (
                            <span style={{
                              fontSize: '0.68rem', color: '#9ca3af',
                              fontWeight: 500,
                            }}>
                              {victoryIcon}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bouton Voir détails */}
                      <button
                        id={`history-detail-btn-${partie.id}`}
                        onClick={() => onSelectPartie?.(partie.id)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 18px', borderRadius: 8,
                          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                          color: '#ffffff', fontWeight: 600,
                          border: 'none', cursor: 'pointer', fontSize: '0.82rem',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.2)',
                          transition: 'opacity 0.15s ease',
                          whiteSpace: 'nowrap',
                          alignSelf: 'flex-start',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      >
                        Voir détails →
                      </button>
                    </div>

                    {/* ── Ligne 2 : Joueurs avec ELO ── */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 10, flexWrap: 'wrap',
                    }}>
                      {/* Joueur blanc */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: 8, padding: '4px 10px',
                      }}>
                        <span style={{ fontSize: '0.78rem' }}>⚪</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                          {partie.joueurBlanc?.pseudonyme || 'Blanc'}
                        </span>
                        {partie.eloBlanc && partie.eloBlanc > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>
                            {partie.eloBlanc}
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: '#d1d5db', fontWeight: 500 }}>vs</span>

                      {/* Joueur noir */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#1f2937', border: '1px solid #374151',
                        borderRadius: 8, padding: '4px 10px',
                      }}>
                        <span style={{ fontSize: '0.78rem' }}>⚫</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f9fafb' }}>
                          {partie.joueurNoir?.pseudonyme || 'Noir'}
                        </span>
                        {partie.eloNoir && partie.eloNoir > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>
                            {partie.eloNoir}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Ligne 3 : Méta-données ── */}
                    <div style={{
                      display: 'flex', gap: 14, flexWrap: 'wrap',
                      marginBottom: 14, alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
                        🗓 {formatDate(partie.dateHeureUTC)}
                      </span>
                      {partie.ouverture?.libelle && (
                        <span style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
                          📖 {partie.ouverture.libelle}
                          {partie.openingEco && (
                            <span style={{
                              marginLeft: 4, padding: '1px 5px',
                              background: '#f3f4f6', borderRadius: 4,
                              fontSize: '0.66rem', fontWeight: 700, color: '#6b7280',
                            }}>
                              {partie.openingEco}
                            </span>
                          )}
                        </span>
                      )}
                      {partie.nombreCoups != null && partie.nombreCoups > 0 && (
                        <span style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
                          ♟ {partie.nombreCoups} coups
                        </span>
                      )}
                      {cadenceLabel && (
                        <span style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
                          {cadenceLabel}
                        </span>
                      )}
                    </div>

                    {/* ── Ligne 4 : Analyse ML ── */}
                    <div style={{
                      borderTop: '1px solid #f3f4f6',
                      paddingTop: 12,
                    }}>
                      {partie.mlTag || partie.mlInsight || partie.probWhite != null || partie.probBlack != null || partie.probDraw != null ? (
                        /* ── Insight ML généré par predict_game.py (déclenché si au moins un champ ML existe) */
                        <MlInsightBadge
                          tag={partie.mlTag}
                          insight={partie.mlInsight}
                          probWhite={partie.probWhite}
                          probBlack={partie.probBlack}
                          probDraw={partie.probDraw}
                        />
                      ) : (
                        /* ── Fallback : ancienne analyse inférée localement ─────── */
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700,
                              color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                              🤖 Analyse ML
                            </span>
                            <span style={{
                              fontSize: '0.63rem', padding: '1px 7px', borderRadius: 99,
                              background: isCSV ? '#eef2ff' : '#f9fafb',
                              color: isCSV ? '#4f46e5' : '#9ca3af',
                              border: `1px solid ${isCSV ? '#c7d2fe' : '#e5e7eb'}`,
                              fontWeight: 600,
                            }}>
                              {isCSV ? '📂 CSV exact' : '⚙ Inférence locale'}
                            </span>
                          </div>
                          <MLGameBadges ml={mlData} variant="inline" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}