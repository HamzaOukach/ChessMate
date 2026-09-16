/**
 * MLPlayerDashboard.tsx
 * Tableau de bord ML global — partie haute de la page Historique.
 * Design sobre et professionnel sur fond blanc, palette cohérente avec la plateforme.
 */

import { useEffect, useState } from 'react';
import { getMyMlProfile } from '../services/api';
import type { GameType, PlayerMLProfile } from '../types/gameML';

// ── Couleurs par type de jeu (douces, non agressives) ──────────────────────

const TYPE_CONFIG: Record<GameType, { color: string; bg: string; border: string; icon: string }> = {
  Tactique:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '⚔️' },
  Stratégique: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '♜' },
  Équilibrée:  { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: '⚖️' },
  Explosive:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚡' },
  Défensive:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '🛡️' },
};

// ── Barre de progression ───────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        flex: 1, height: 6,
        background: '#f3f4f6',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width 0.7s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Carte stat ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  bg?: string;
  border?: string;
  icon?: string;
}

function StatCard({ label, value, sub, color = '#4f46e5', bg = '#eef2ff', border = '#c7d2fe', icon }: StatCardProps) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </span>
      <span style={{ fontSize: '1.35rem', fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '0.74rem', color: '#9ca3af' }}>{sub}</span>
      )}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export function MLPlayerDashboard() {
  const [profile, setProfile] = useState<PlayerMLProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    getMyMlProfile()
      .then((p) => {
        setProfile(p);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur ML:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb',
        borderRadius: 14, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#6366f1', animation: 'pulse 1.5s infinite',
        }} />
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Chargement du profil ML…
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        background: '#fefce8', border: '1px solid #fde68a',
        borderRadius: 14, padding: '16px 20px',
      }}>
        <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
          ⚠️ Profil ML non disponible — jouez au moins une partie ou vérifiez que le modèle Python s'exécute correctement.
        </p>
      </div>
    );
  }

  const typeConf = TYPE_CONFIG[profile.global_profile?.dominant_style ?? 'Équilibrée'] ?? TYPE_CONFIG['Équilibrée'];
  const avgConf = profile.confidence?.score ?? 0;
  const confColor = avgConf >= 0.7 ? '#059669' : avgConf >= 0.45 ? '#d97706' : '#dc2626';

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>

      {/* ── En-tête cliquable ── */}
      <div
        id="ml-dashboard-header"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: open ? '1px solid #f3f4f6' : 'none',
          userSelect: 'none',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#ffffff'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
          }}>🧠</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
              Analyse ML — Profil de {profile.user_id || 'Joueur'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
              {(profile.sample_size?.games_analyzed ?? 0).toLocaleString('fr-FR')} parties analysées
              · Confiance {Math.round(avgConf * 100)}%
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            background: typeConf.bg, color: typeConf.color,
            border: `1px solid ${typeConf.border}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {typeConf.icon} {profile.global_profile?.dominant_style ?? 'Inconnu'}
          </span>
          <span style={{
            color: '#9ca3af', fontSize: '0.8rem',
            transition: 'transform 0.2s',
            display: 'block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>▼</span>
        </div>
      </div>

      {/* ── Corps ── */}
      {open && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Grille stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <StatCard
              label="Total parties"
              value={(profile.sample_size?.games_analyzed ?? 0).toLocaleString('fr-FR')}
              icon="♟"
              color="#4f46e5" bg="#eef2ff" border="#c7d2fe"
            />
            <StatCard
              label="Winrate"
              value={`${profile.metrics?.win_rate ?? 0}%`}
              sub={`Défaites ${profile.metrics?.loss_rate ?? 0}% · Nuls ${profile.metrics?.draw_rate ?? 0}%`}
              icon="🎯"
              color="#059669" bg="#f0fdf4" border="#bbf7d0"
            />
            <StatCard
              label="Type dominant"
              value={`${typeConf.icon} ${profile.global_profile?.dominant_style ?? '?'}`}
              sub="Style de jeu principal"
              color={typeConf.color} bg={typeConf.bg} border={typeConf.border}
            />
            <StatCard
              label="Niveau estimé"
              value={profile.global_profile?.estimated_level ?? '?'}
              sub={`ELO base ${profile.metrics?.avg_rating ?? '?'}`}
              icon="📊"
              color="#d97706" bg="#fffbeb" border="#fde68a"
            />
            <StatCard
              label="Ouverture fav."
              value={profile.global_profile?.favorite_opening_family ?? '?'}
              sub="Régulièrement jouée"
              icon="📖"
              color="#2563eb" bg="#eff6ff" border="#bfdbfe"
            />
            <StatCard
              label="Rythme dominant"
              value={profile.global_profile?.dominant_rhythm ?? '?'}
              sub={`Deltas Vit. ${profile.comparisons_vs_global_baseline?.speed_percentile ?? 50}%`}
              icon="⏱"
              color="#7c3aed" bg="#f5f3ff" border="#ddd6fe"
            />
            <StatCard
              label="Taux abandon"
              value={`${profile.metrics?.resign_rate ?? 0}%`}
              sub={`Timeout ${profile.metrics?.timeout_rate ?? 0}%`}
              icon="🏳"
              color="#dc2626" bg="#fef2f2" border="#fecaca"
            />
            <StatCard
              label="Confiance ML"
              value={`${Math.round(avgConf * 100)}%`}
              sub={profile.sample_size?.is_small_sample ? "Échantillon faible" : "Score de certitude"}
              icon="🤖"
              color={confColor}
              bg={avgConf >= 0.7 ? '#f0fdf4' : avgConf >= 0.45 ? '#fffbeb' : '#fef2f2'}
              border={avgConf >= 0.7 ? '#bbf7d0' : avgConf >= 0.45 ? '#fde68a' : '#fecaca'}
            />
          </div>

          {/* Barre de confiance globale */}
          <div style={{
            background: '#f9fafb', border: '1px solid #f3f4f6',
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🤖 Confiance globale du modèle ML
              </span>
            </div>
            <ProgressBar value={avgConf} color={confColor} />
            {profile.confidence?.reason && (
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                {profile.confidence.reason}
              </p>
            )}
          </div>

          {/* Tendance joueur & Forces / Faiblesses */}
          <div style={{
            background: typeConf.bg,
            border: `1px solid ${typeConf.border}`,
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{typeConf.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                Tendance du joueur
              </p>
              <p style={{ margin: '4px 0 10px', fontSize: '0.84rem', color: '#4b5563', lineHeight: 1.5 }}>
                {profile.insights?.player_tendency ?? 'Aucune tendance précise identifiée.'}
              </p>
              
              {/* Affichage optionnel des forces/faiblesses s'il y en a */}
              {(profile.insights?.strengths?.length || 0) > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>FORCES : </span>
                  <span style={{ fontSize: '0.75rem', color: '#374151' }}>{profile.insights?.strengths?.join(" · ")}</span>
                </div>
              )}
              {(profile.insights?.weaknesses?.length || 0) > 0 && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>FAIBLESSES : </span>
                  <span style={{ fontSize: '0.75rem', color: '#374151' }}>{profile.insights?.weaknesses?.join(" · ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recommandations */}
          {(profile.insights?.recommendations?.length || 0) > 0 && (
            <div>
              <h4 style={{
                margin: '0 0 10px',
                fontSize: '0.75rem', fontWeight: 600,
                color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                💡 Recommandations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {profile.insights!.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderLeft: '3px solid #6366f1',
                      borderRadius: 8, padding: '10px 14px',
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
