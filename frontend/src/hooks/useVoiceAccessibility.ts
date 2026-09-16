/**
 * useVoiceAccessibility.ts
 *
 * Hook principal du module d'accessibilité vocale — Mode 1 (Suivi vocal).
 *
 * Responsabilités :
 * - Surveiller les changements de `moveHistory` pour annoncer chaque nouveau coup.
 * - Surveiller `gameStatus` pour ajouter "Échec !" après une annonce de coup.
 * - Surveiller `winner` pour annoncer la fin de partie avec un délai naturel.
 * - Exposer `liveText` pour alimenter une zone `aria-live` visible par les
 *   lecteurs d'écran système (ex. NVDA, VoiceOver).
 *
 * Garanties de sécurité :
 * - Aucune annonce lors du montage initial (évite de lire l'historique existant).
 * - Aucun doublon si React re-rend le composant sans changement d'état.
 * - Reset automatique lors d'une nouvelle partie (winner revient à null).
 * - Timer de fin de partie nettoyé si le composant est démonté.
 * - Compatible avec le mode humain ET le mode Stockfish.
 */

import { useEffect, useRef, useState } from 'react';
import { useTTS } from './useTTS';
import { gameStatusToSpeech, moveTextToSpeech } from '../services/moveToSpeech';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseVoiceAccessibilityOptions {
  /** Active ou désactive le module. Quand `false`, cancel() est appelé. */
  isEnabled: boolean;
  /** Tableau des annonces de coups (format interne ChessGame.tsx). */
  moveHistory: string[];
  /** Statut courant du jeu ('En cours', 'Échec !', 'Échec et mat !…', etc.). */
  gameStatus: string;
  /** Vainqueur : null = partie en cours, 'Blancs' | 'Noirs' | 'Nul'. */
  winner: string | null;
}

interface UseVoiceAccessibilityReturn {
  /** `true` si la Web Speech API est disponible dans ce navigateur. */
  isSupported: boolean;
  /**
   * Dernière annonce générée — à insérer dans une zone `aria-live` pour
   * les lecteurs d'écran système (NVDA, VoiceOver, etc.).
   */
  liveText: string;
  /**
   * Fonction de synthèse vocale partagée.
   * Permet à ChessGame.tsx d'annoncer les confirmations / erreurs vocales
   * via la même instance TTS, évitant les conflits audio.
   */
  speak: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceAccessibility({
  isEnabled,
  moveHistory,
  gameStatus,
  winner,
}: UseVoiceAccessibilityOptions): UseVoiceAccessibilityReturn {
  const { speak, cancel, isSupported } = useTTS();

  // Texte exposé à la zone aria-live du DOM
  const [liveText, setLiveText] = useState('');

  // -------------------------------------------------------------------------
  // Refs pour le suivi de l'état précédent
  // Les refs ne déclenchent PAS de re-render, ce qui est exactement ce qu'on veut :
  // on a besoin de mémoriser la valeur précédente sans provoquer de boucle.
  // -------------------------------------------------------------------------

  /** Flag : vrai uniquement lors du tout premier render du hook. */
  const isFirstRenderRef = useRef(true);

  /**
   * Nombre de coups déjà traités.
   * Initialisé à -1 pour distinguer "pas encore initialisé" de "0 coups".
   */
  const prevMoveCountRef = useRef(-1);

  /**
   * Dernier winner annoncé.
   * Permet d'éviter de réannoncer la fin de partie si le composant re-rend.
   * Réinitialisé à null quand winner revient à null (nouvelle partie).
   */
  const announcedWinnerRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // Effect 1 — Détection d'un nouveau coup
  // -------------------------------------------------------------------------
  useEffect(() => {
    // ── Premier render : initialiser le compteur sans annoncer ────────────
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevMoveCountRef.current = moveHistory.length;
      return;
    }

    // ── Si le module est désactivé, mettre à jour le compteur et sortir ──
    if (!isEnabled || !isSupported) {
      prevMoveCountRef.current = moveHistory.length;
      return;
    }

    const currentCount = moveHistory.length;
    const prevCount = prevMoveCountRef.current;

    // ── Aucun nouveau coup (re-render sans changement de moveHistory) ─────
    if (currentCount <= prevCount) {
      // Cas particulier : le jeu a été réinitialisé (resetGame) → le compteur
      // peut être passé de N à 0. On met juste à jour la référence.
      prevMoveCountRef.current = currentCount;
      return;
    }

    // ── Nouveau coup détecté ──────────────────────────────────────────────
    const latestMoveText = moveHistory[currentCount - 1];
    let announcement = moveTextToSpeech(latestMoveText);

    // Si le coup met le roi en échec, fait mat, ou pat,
    // on l'ajoute directement à l'annonce du coup pour une lecture fluide immédiate.
    if (gameStatus === 'Échec !' && !winner) {
      announcement += ' Échec !';
    } else if (gameStatus.includes('Échec et mat')) {
      announcement += ' Échec et mat !';
    } else if (gameStatus.includes('Pat')) {
      announcement += ' Pat !';
    }

    speak(announcement);
    setLiveText(announcement);

    // Mettre à jour le compteur APRÈS le traitement
    prevMoveCountRef.current = currentCount;
  }, [moveHistory, gameStatus, winner, isEnabled, isSupported, speak]);

  // -------------------------------------------------------------------------
  // Effect 2 — Fin de partie (mat, pat, temps écoulé)
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Réinitialisation lors d'une nouvelle partie
    if (winner === null) {
      announcedWinnerRef.current = null;
      return;
    }

    if (!isEnabled || !isSupported) return;

    // Éviter de réannoncer si le winner n'a pas changé (re-render)
    if (announcedWinnerRef.current === winner) return;

    announcedWinnerRef.current = winner;

    const endText = gameStatusToSpeech(gameStatus, winner);
    if (!endText) return;

    // Délai pour laisser l'annonce du dernier coup se terminer naturellement
    // avant d'enchaîner avec l'annonce de fin de partie.
    const timerId = setTimeout(() => {
      speak(endText);
      setLiveText(endText);
    }, 2200);

    // Nettoyage si le composant est démonté avant la fin du délai
    return () => clearTimeout(timerId);
  }, [winner, gameStatus, isEnabled, isSupported, speak]);

  // -------------------------------------------------------------------------
  // Effect 3 — Désactivation du module
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isEnabled) {
      cancel();
      setLiveText('');
    }
  }, [isEnabled, cancel]);

  return { isSupported, liveText, speak };
}
