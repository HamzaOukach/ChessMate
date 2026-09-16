/**
 * MicButton.tsx
 *
 * Bouton push-to-talk pour la saisie vocale des coups.
 *
 * Design :
 * - Cohérent avec les autres boutons de ChessGame.tsx.
 * - Animation de pulsation rouge quand l'écoute est active.
 * - Message clair si l'API n'est pas disponible dans le navigateur.
 * - Affiche le dernier coup reconnu ou le dernier message d'erreur vocal.
 * - Attributs ARIA pour l'accessibilité native.
 */

import { Mic, MicOff } from 'lucide-react';

interface MicButtonProps {
  /** L'écoute est-elle actuellement en cours ? */
  isListening: boolean;
  /** Appuyez pour démarrer/arrêter l'écoute. */
  onToggle: () => void;
  /** `false` si la Web Speech API est absente du navigateur. */
  isSupported: boolean;
  /**
   * Texte de feedback (dernier coup compris, message d'erreur, etc.).
   * Affiché sous le bouton. Peut être vide.
   */
  feedback?: string;
  /** Désactive le bouton (ex : pendant que Stockfish réfléchit). */
  disabled?: boolean;
}

export function MicButton({
  isListening,
  onToggle,
  isSupported,
  feedback,
  disabled = false,
}: MicButtonProps) {

  // ─── API non disponible ───────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div
        className="flex flex-col items-start gap-1"
        role="status"
        aria-label="Saisie vocale non disponible dans ce navigateur. Utilisez Chrome ou Edge."
      >
        <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-400 text-sm cursor-default">
          <MicOff className="w-5 h-5" aria-hidden="true" />
          <span>Micro indisponible</span>
        </div>
        <p className="text-xs text-slate-400 pl-1">
          Requiert Chrome ou Edge
        </p>
      </div>
    );
  }

  // ─── Bouton actif / inactif ───────────────────────────────────────────────
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        id="mic-toggle-btn"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={
          isListening
            ? "Écoute en cours. Cliquez pour arrêter."
            : "Activer la saisie vocale d'un coup."
        }
        title={isListening ? "Arrêter l'écoute" : "Parler pour jouer"}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-200 shadow-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
          isListening
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
            : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800'
        }`}
      >
        {/* Icône */}
        {isListening ? (
          <Mic className="w-5 h-5" aria-hidden="true" />
        ) : (
          <MicOff className="w-5 h-5" aria-hidden="true" />
        )}

        {/* Libellé */}
        <span>{isListening ? 'Écoute…' : 'Micro OFF'}</span>

        {/* Indicateur de pulsation quand actif */}
        {isListening && (
          <span
            className="w-2 h-2 rounded-full bg-white animate-pulse"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Feedback textuel sous le bouton */}
      {feedback && (
        <p
          className={`text-xs pl-1 max-w-[200px] truncate ${
            feedback.startsWith('❌') || feedback.startsWith('⚠')
              ? 'text-red-500'
              : 'text-teal-600'
          }`}
          role="status"
          aria-live="polite"
          title={feedback}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
