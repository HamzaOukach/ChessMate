/**
 * MLGameBadges.tsx
 * Badges ML par partie — affichés dans chaque carte de l'historique et en page détail.
 * Design sobre, cohérent avec la palette générale de la plateforme.
 */

import type { GameMLData, GameLevel, GameRhythm, GameType } from '../types/gameML';

// ── MlInsightBadge ─────────────────────────────────────────────────────────
// Affiche le badge mlTag + Win-Probability Bar + message produits par predict_game.py

import { useEffect, useState } from 'react';

// Palette du badge tag (inchangée)
const ML_TAG_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  Exploit:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '🔥' },
  Logique:   { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0', icon: '✅' },
  Équilibré: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '⚖️' },
};

// ── Palette Premium Win-Probability Bar ──────────────────────────────────────
//  Blanc cassé (warm off-white)  | Gris acier (steel)  | Anthracite (dark)
const BAR_WHITE = { bg: '#f5f0e8', text: '#78716c', label: '⬜ Blanc' };
const BAR_DRAW  = { bg: '#94a3b8', text: '#1e293b', label: '— Nul'   };
const BAR_BLACK = { bg: '#1e293b', text: '#f1f5f9', label: '⬛ Noir'  };

// Largeur minimum d'un segment pour afficher le % (en %)
const MIN_VISIBLE_PCT = 6;

interface MlInsightBadgeProps {
  tag?:       string;
  insight?:   string;
  probWhite?: number;   // [0–1]
  probBlack?: number;   // [0–1]
  probDraw?:  number;   // [0–1]
}

export function MlInsightBadge({
  tag,
  insight,
  probWhite,
  probBlack,
  probDraw,
}: MlInsightBadgeProps) {

  const normalizedTag = tag?.trim() ?? '';
  const tagStyle = ML_TAG_STYLE[normalizedTag] ?? ML_TAG_STYLE['Équilibré'];

  // ── Normalisation des probabilités → garantit que la somme = 100 % ─────────
  const hasProbs = probWhite != null || probBlack != null || probDraw != null;
  const rawW = probWhite ?? 0;
  const rawB = probBlack ?? 0;
  const rawD = probDraw  ?? 0;
  const total = rawW + rawB + rawD || 1;          // évite la division par zéro
  const pctW = (rawW / total) * 100;
  const pctB = (rawB / total) * 100;
  const pctD = (rawD / total) * 100;

  // ── Animation : démarrer à 0, atteindre la vraie valeur après mount ────────
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    // Petit délai pour déclencher la transition CSS après le premier rendu
    const id = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(id);
  }, []);

  const targetW = animated ? pctW : 0;
  const targetB = animated ? pctB : 0;
  const targetD = animated ? pctD : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Ligne supérieure : label + badge tag + pill source ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700,
          color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          🤖 Analyse ML
        </span>

        {normalizedTag && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 99,
            background: tagStyle.bg, color: tagStyle.color,
            border: `1px solid ${tagStyle.border}`,
            fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {tagStyle.icon} {normalizedTag}
          </span>
        )}

        <span style={{
          fontSize: '0.63rem', padding: '1px 7px', borderRadius: 99,
          background: '#eef2ff', color: '#4f46e5',
          border: '1px solid #c7d2fe', fontWeight: 600,
        }}>
          🐍 Modèle Python
        </span>
      </div>

      {/* ── Win-Probability Bar ────────────────────────────────────────────── */}
      {hasProbs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Labels au-dessus */}
          <div style={{
            display: 'flex', fontSize: '0.65rem',
            fontWeight: 700, color: '#6b7280',
            letterSpacing: '0.02em',
          }}>
            {/* Label Blanc */}
            <div style={{
              width: `${pctW}%`, textAlign: 'left',
              paddingLeft: 2,
              overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'width 0.8s ease-out',
              color: '#92816b',
            }}>
              {pctW >= MIN_VISIBLE_PCT ? `${pctW.toFixed(1)}%` : ''}
            </div>
            {/* Label Nul */}
            <div style={{
              width: `${pctD}%`, textAlign: 'center',
              overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'width 0.8s ease-out',
              color: '#64748b',
            }}>
              {pctD >= MIN_VISIBLE_PCT ? `${pctD.toFixed(1)}%` : ''}
            </div>
            {/* Label Noir */}
            <div style={{
              width: `${pctB}%`, textAlign: 'right',
              paddingRight: 2,
              overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'width 0.8s ease-out',
              color: '#475569',
            }}>
              {pctB >= MIN_VISIBLE_PCT ? `${pctB.toFixed(1)}%` : ''}
            </div>
          </div>

          {/* La barre elle-même */}
          <div style={{
            display: 'flex', height: 18,
            borderRadius: 6, overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            {/* Segment Blanc */}
            <div style={{
              width: `${targetW}%`,
              background: BAR_WHITE.bg,
              transition: 'width 0.8s ease-out',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {targetW >= MIN_VISIBLE_PCT + 4 && (
                <span style={{
                  fontSize: '0.62rem', fontWeight: 800,
                  color: BAR_WHITE.text, userSelect: 'none',
                }}>
                  {BAR_WHITE.label}
                </span>
              )}
            </div>

            {/* Séparateur + Segment Nul */}
            {targetD > 0 && (
              <div style={{
                width: `${targetD}%`,
                background: BAR_DRAW.bg,
                transition: 'width 0.8s ease-out',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderLeft: '1px solid rgba(255,255,255,0.25)',
                borderRight: '1px solid rgba(255,255,255,0.25)',
              }}>
                {targetD >= MIN_VISIBLE_PCT + 4 && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800,
                    color: BAR_DRAW.text, userSelect: 'none',
                  }}>
                    {BAR_DRAW.label}
                  </span>
                )}
              </div>
            )}

            {/* Segment Noir */}
            <div style={{
              width: `${targetB}%`,
              background: BAR_BLACK.bg,
              transition: 'width 0.8s ease-out',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {targetB >= MIN_VISIBLE_PCT + 4 && (
                <span style={{
                  fontSize: '0.62rem', fontWeight: 800,
                  color: BAR_BLACK.text, userSelect: 'none',
                }}>
                  {BAR_BLACK.label}
                </span>
              )}
            </div>
          </div>

          {/* Légende compacte sous la barre */}
          <div style={{
            display: 'flex', gap: 14, flexWrap: 'wrap',
            fontSize: '0.67rem', color: '#9ca3af',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: BAR_WHITE.bg, border: '1px solid #d6cfc4',
                display: 'inline-block', flexShrink: 0,
              }} />
              Blanc · {pctW.toFixed(1)}%
            </span>
            {pctD > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: BAR_DRAW.bg,
                  display: 'inline-block', flexShrink: 0,
                }} />
                Nul · {pctD.toFixed(1)}%
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: BAR_BLACK.bg,
                display: 'inline-block', flexShrink: 0,
              }} />
              Noir · {pctB.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Message statistique (sous la barre) ───────────────────────────── */}
      {insight && (
        <div style={{
          background: tagStyle.bg,
          border: `1px solid ${tagStyle.border}`,
          borderLeft: `3px solid ${tagStyle.color}`,
          borderRadius: '0 8px 8px 0',
          padding: '7px 12px',
        }}>
          <p style={{
            margin: 0, fontSize: '0.8rem',
            color: '#374151', lineHeight: 1.55, fontWeight: 500,
          }}>
            {insight}
          </p>
        </div>
      )}
    </div>
  );
}



// ── Palettes ────────────────────────────────────────────────────────────────

export const TYPE_STYLE: Record<GameType, { bg: string; color: string; border: string; icon: string }> = {
  Tactique:    { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '⚔️' },
  Stratégique: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '♜' },
  Équilibrée:  { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0', icon: '⚖️' },
  Explosive:   { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '⚡' },
  Défensive:   { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '🛡️' },
};

const LEVEL_STYLE: Record<GameLevel, { bg: string; color: string; border: string; icon: string }> = {
  'Débutant':       { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: '🌱' },
  'Intermédiaire–': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '📘' },
  'Intermédiaire+': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', icon: '📗' },
  'Avancé':         { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '🔶' },
  'Expert':         { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '🔴' },
  'Maître':         { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '👑' },
};

const RHYTHM_STYLE: Record<GameRhythm, { bg: string; color: string; border: string; icon: string }> = {
  'Ultra-Rapide': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '🔥' },
  'Courte':       { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '⚡' },
  'Moyenne':      { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0', icon: '⏱' },
  'Longue':       { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '🕐' },
  'Profonde':     { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '♟' },
};

const HINT_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  'Attaquant':  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '⚔️' },
  'Défenseur':  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '🛡' },
  'Technicien': { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0', icon: '⚙️' },
  'Irrégulier': { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '🎲' },
  'Équilibré':  { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '⚖️' },
  'Théoricien': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', icon: '📚' },
};

// ── Badge générique ─────────────────────────────────────────────────────────

interface BadgeProps {
  bg: string;
  color: string;
  border: string;
  children: React.ReactNode;
  title?: string;
}

function Badge({ bg, color, border, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 99,
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontSize: '0.73rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ── Barre de confiance ───────────────────────────────────────────────────────

function ConfidenceBar({ value, dim = false }: { value: number; dim?: boolean }) {
  const pct = Math.round(value * 100);
  const color = dim
    ? '#d1d5db'
    : pct >= 70 ? '#059669' : pct >= 45 ? '#d97706' : '#dc2626';
  const label = pct >= 70 ? 'Élevée' : pct >= 45 ? 'Moyenne' : 'Faible';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
        Confiance
      </span>
      <div style={{
        flex: 1, height: 5, minWidth: 60,
        background: '#f3f4f6',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
      {!dim && (
        <span style={{ fontSize: '0.66rem', color: '#9ca3af' }}>
          ({label})
        </span>
      )}
    </div>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────

interface MLGameBadgesProps {
  ml: GameMLData & { _source?: 'csv' | 'inferred' };
  variant?: 'inline' | 'expanded';
}

export function MLGameBadges({ ml, variant = 'inline' }: MLGameBadgesProps) {
  const typeStyle   = TYPE_STYLE[ml.predicted_game_type]  ?? TYPE_STYLE['Équilibrée'];
  const levelStyle  = LEVEL_STYLE[ml.predicted_level]     ?? LEVEL_STYLE['Intermédiaire+'];
  const rhythmStyle = RHYTHM_STYLE[ml.predicted_rhythm]   ?? RHYTHM_STYLE['Moyenne'];
  const hintStyle   = HINT_STYLE[ml.player_profile_hint]  ?? HINT_STYLE['Équilibré'];
  const isInferred  = ml._source === 'inferred';

  // ── INLINE (carte de liste) ─────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Badges type + niveau + rythme + cadence */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Badge
            bg={typeStyle.bg} color={typeStyle.color} border={typeStyle.border}
            title="Type de partie prédit par le modèle ML"
          >
            {typeStyle.icon} {ml.predicted_game_type}
          </Badge>
          <Badge
            bg={levelStyle.bg} color={levelStyle.color} border={levelStyle.border}
            title="Niveau estimé selon l'ELO moyen"
          >
            {levelStyle.icon} {ml.predicted_level}
          </Badge>
          <Badge
            bg={rhythmStyle.bg} color={rhythmStyle.color} border={rhythmStyle.border}
            title="Rythme de la partie prédit"
          >
            {rhythmStyle.icon} {ml.predicted_rhythm}
          </Badge>
          {ml.time_category !== 'Unknown' && (
            <Badge bg="#f9fafb" color="#6b7280" border="#e5e7eb" title="Catégorie de temps (Lichess)">
              🕹 {ml.time_category}
            </Badge>
          )}
          {ml.player_profile_hint && (
            <Badge
              bg={hintStyle.bg} color={hintStyle.color} border={hintStyle.border}
              title="Profil joueur détecté"
            >
              {hintStyle.icon} {ml.player_profile_hint}
            </Badge>
          )}
        </div>

        {/* Barre de confiance */}
        <ConfidenceBar value={ml.confidence_score} dim={isInferred} />

        {/* Résumé analytique */}
        {ml.analytic_summary && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: typeStyle.bg,
            border: `1px solid ${typeStyle.border}`,
            borderLeft: `3px solid ${typeStyle.color}`,
            borderRadius: '0 6px 6px 0',
            padding: '6px 10px',
          }}>
            <span style={{ fontSize: '0.78rem', color: typeStyle.color, opacity: 0.7, flexShrink: 0 }}>
              📋
            </span>
            <p style={{
              margin: 0,
              fontSize: '0.78rem',
              color: '#4b5563',
              lineHeight: 1.55,
              fontStyle: 'italic',
            }}>
              {ml.analytic_summary}
            </p>
          </div>
        )}

        {/* Méta-données complémentaires */}
        {(ml.turns > 0 || ml.avg_rating > 0 || (ml.opening_family && ml.opening_family !== 'Ouverture inconnue')) && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ml.turns > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>♟ {ml.turns} coups</span>
            )}
            {ml.avg_rating > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                ELO moy. {Math.round(ml.avg_rating)}
                {ml.abs_rating_diff > 0 && ` · Δ ${ml.abs_rating_diff} pts`}
                {ml.is_balanced ? ' · équilibré' : ' · déséquilibré'}
              </span>
            )}
            {ml.opening_family && ml.opening_family !== 'Ouverture inconnue' && (
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>📖 {ml.opening_family}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── EXPANDED (page détail) ──────────────────────────────────────────────
  return (
    <div style={{
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{
          margin: 0, fontSize: '0.75rem', fontWeight: 700,
          color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          🤖 Analyse ML
        </h4>
        <span style={{
          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99,
          background: isInferred ? '#f9fafb' : '#eef2ff',
          color: isInferred ? '#9ca3af' : '#4f46e5',
          border: `1px solid ${isInferred ? '#e5e7eb' : '#c7d2fe'}`,
          fontWeight: 600,
        }}>
          {isInferred ? '⚙ Inférence locale' : '📂 Données CSV'}
        </span>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <Badge bg={typeStyle.bg} color={typeStyle.color} border={typeStyle.border}>
          {typeStyle.icon} {ml.predicted_game_type}
        </Badge>
        <Badge bg={levelStyle.bg} color={levelStyle.color} border={levelStyle.border}>
          {levelStyle.icon} {ml.predicted_level}
        </Badge>
        <Badge bg={rhythmStyle.bg} color={rhythmStyle.color} border={rhythmStyle.border}>
          {rhythmStyle.icon} {ml.predicted_rhythm}
        </Badge>
        {ml.time_category !== 'Unknown' && (
          <Badge bg="#f9fafb" color="#6b7280" border="#e5e7eb">
            🕹 {ml.time_category}
          </Badge>
        )}
        {ml.player_profile_hint && (
          <Badge bg={hintStyle.bg} color={hintStyle.color} border={hintStyle.border}>
            {hintStyle.icon} {ml.player_profile_hint}
          </Badge>
        )}
      </div>

      {/* Barre de confiance */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>
            Confiance du modèle
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
            {Math.round(ml.confidence_score * 100)}%
          </span>
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.round(ml.confidence_score * 100)}%`, height: '100%',
            background: ml.confidence_score >= 0.7 ? '#059669'
                      : ml.confidence_score >= 0.45 ? '#d97706'
                      : '#dc2626',
            borderRadius: 99, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Résumé analytique */}
      {ml.analytic_summary && (
        <div style={{
          background: typeStyle.bg,
          border: `1px solid ${typeStyle.border}`,
          borderLeft: `3px solid ${typeStyle.color}`,
          borderRadius: '0 8px 8px 0',
          padding: '8px 12px',
        }}>
          <p style={{
            margin: 0, fontSize: '0.85rem',
            color: '#4b5563', lineHeight: 1.6, fontStyle: 'italic',
          }}>
            {ml.analytic_summary}
          </p>
        </div>
      )}

      {/* Méta-données */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: '0.77rem', color: '#9ca3af' }}>
        {ml.turns > 0 && <span>♟ {ml.turns} coups</span>}
        {ml.opening_family && ml.opening_family !== 'Ouverture inconnue' && (
          <span>📖 {ml.opening_family}</span>
        )}
        {ml.avg_rating > 0 && <span>ELO moy. {Math.round(ml.avg_rating)}</span>}
        {ml.abs_rating_diff > 0 && (
          <span>Δ {ml.abs_rating_diff} pts · {ml.is_balanced ? 'Équilibré' : 'Déséquilibré'}</span>
        )}
      </div>
    </div>
  );
}
