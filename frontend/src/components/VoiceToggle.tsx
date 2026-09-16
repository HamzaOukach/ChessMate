/**
 * VoiceToggle.tsx
 *
 * Bouton d'activation / désactivation de l'assistance vocale.
 *
 * Design :
 * - Cohérent avec les boutons existants de ChessGame.tsx (gradients, rounded).
 * - Indicateur d'état visible : couleur verte + pulsation animée quand actif.
 * - Message clair quand la Web Speech API est absente du navigateur.
 * - Attributs ARIA complets pour l'accessibilité native.
 * - CSS inline uniquement (pas de dépendance Tailwind).
 */

import { Volume2, VolumeX } from 'lucide-react';

interface VoiceToggleProps {
  /** État courant du module vocal. */
  enabled: boolean;
  /** Callback appelé au clic avec le nouvel état souhaité. */
  onToggle: (enabled: boolean) => void;
  /** `false` si la Web Speech API est absente du navigateur. */
  isSupported: boolean;
}

export function VoiceToggle({ enabled, onToggle, isSupported }: VoiceToggleProps) {
  // ─── API non disponible ───────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          borderRadius: 12,
          background: '#f1f5f9',
          color: '#94a3b8',
          fontSize: '0.875rem',
          cursor: 'default',
          border: '1px solid #e2e8f0',
          userSelect: 'none',
        }}
        title="La synthèse vocale n'est pas disponible dans ce navigateur"
        role="status"
        aria-label="Assistance vocale non disponible dans ce navigateur"
      >
        <VolumeX style={{ width: 18, height: 18 }} aria-hidden="true" />
        <span>Voix indisponible</span>
      </div>
    );
  }

  // ─── Bouton actif / inactif ───────────────────────────────────────────────
  return (
    <button
      id="voice-toggle-btn"
      onClick={() => onToggle(!enabled)}
      aria-pressed={enabled}
      aria-label={
        enabled
          ? 'Assistance vocale activée. Cliquer pour désactiver.'
          : 'Assistance vocale désactivée. Cliquer pour activer.'
      }
      title={enabled ? "Désactiver l'assistance vocale" : "Activer l'assistance vocale"}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        background: enabled
          ? 'linear-gradient(135deg, #0d9488, #0f766e)'
          : 'linear-gradient(135deg, #64748b, #475569)',
        color: '#ffffff',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
    >
      {/* Icône */}
      {enabled ? (
        <Volume2 style={{ width: 18, height: 18 }} aria-hidden="true" />
      ) : (
        <VolumeX style={{ width: 18, height: 18 }} aria-hidden="true" />
      )}

      {/* Libellé */}
      <span>{enabled ? 'Voix ON' : 'Voix OFF'}</span>

      {/* Indicateur de lecture active (pulsation) */}
      {enabled && (
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            animation: 'pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}
