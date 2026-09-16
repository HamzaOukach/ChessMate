/**
 * useTTS.ts
 *
 * Hook React encapsulant la Web Speech API (SpeechSynthesis).
 *
 * Garanties :
 * - La fonction `speak` est stable (useCallback) → pas de re-render inutile.
 * - Toute lecture en cours est annulée avant d'en démarrer une nouvelle.
 * - Les ressources sont libérées à la destruction du composant.
 * - Si la Web Speech API est absente (Firefox < 49, certains environnements CI),
 *   les fonctions dégradent silencieusement : aucune erreur levée.
 */

import { useCallback, useEffect, useRef } from 'react';

interface TTSOptions {
  /** Langue BCP 47. Défaut : 'fr-FR' */
  lang?: string;
  /** Vitesse de lecture (0.1 – 10). Défaut : 0.9 */
  rate?: number;
  /** Hauteur de voix (0 – 2). Défaut : 1.0 */
  pitch?: number;
  /** Volume (0 – 1). Défaut : 1.0 */
  volume?: number;
}

const DEFAULT_OPTIONS: Required<TTSOptions> = {
  lang: 'fr-FR',
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
};

export interface UseTTSReturn {
  /** Lance la synthèse vocale du texte fourni. Annule la lecture précédente. */
  speak: (text: string) => void;
  /** Arrête immédiatement toute lecture en cours. */
  cancel: () => void;
  /** `true` si la Web Speech API (SpeechSynthesis) est disponible dans ce navigateur. */
  isSupported: boolean;
}

export function useTTS(options: TTSOptions = {}): UseTTSReturn {
  // Stocker les options dans un ref pour éviter de recréer `speak` à chaque changement
  const optsRef = useRef<Required<TTSOptions>>({ ...DEFAULT_OPTIONS, ...options });

  // Mettre à jour les options sans recréer les callbacks
  optsRef.current = { ...DEFAULT_OPTIONS, ...options };

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  /**
   * Lit le texte donné à voix haute.
   * - Annule silencieusement les textes vides.
   * - Interrompt toute élocution précédente avant de démarrer.
   */
  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;

      // Interrompre toute lecture en cours pour éviter les files qui s'accumulent
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = optsRef.current.lang;
      utterance.rate = optsRef.current.rate;
      utterance.pitch = optsRef.current.pitch;
      utterance.volume = optsRef.current.volume;

      window.speechSynthesis.speak(utterance);
    },
    [isSupported],
  );

  /** Arrête la lecture en cours. */
  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
  }, [isSupported]);

  // Nettoyage : arrêter la lecture quand le composant est démonté
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { speak, cancel, isSupported };
}
