/**
 * useASR.ts
 *
 * Hook React encapsulant la Web Speech API (SpeechRecognition).
 * Fonctionnement en mode "push-to-talk" : l'utilisateur active l'écoute
 * manuellement, le système s'arrête automatiquement après une première réponse.
 *
 * Compatibilité navigateur :
 * - Chrome / Edge : ✅ Support natif, voix de haute qualité
 * - Firefox       : ❌ Non supporté (API non implémentée)
 * - Safari macOS  : ⚠️  Support partiel selon la version
 *
 * Garanties :
 * - Le callback `onResult` est toujours à jour (ref pattern = pas de closure périmée).
 * - La reconnaissance est proprement avortée quand le composant est démonté.
 * - Aucune erreur levée si l'API est absente : `isSupported` retourne false.
 *
 * Note TypeScript :
 * La Web Speech API est dans lib.dom.d.ts depuis TypeScript 4.4.
 * On utilise des types opaques (SpeechRecognitionAny) pour éviter les erreurs
 * de compilateurs plus anciens ou de configs strictes sans cette lib.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types opaques — isolation maximale de la Web Speech API
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any;

// ---------------------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------------------

interface UseASROptions {
  /**
   * Appelé avec la transcription principale, les alternatives (score de confiance desc)
   * et le score de confiance de la transcription principale.
   */
  onResult: (primary: string, alternatives: string[], confidence: number) => void;
  /** Appelé en cas d'erreur matérielle ou de permission refusée. */
  onError?: (errorMessage: string) => void;
  /**
   * Appelé à chaque résultat intermédiaire (transcription en temps réel).
   * Permet d'afficher un feedback visuel pendant que l'utilisateur parle.
   * Ne pas déclencher d'actions jeu depuis ce callback — utiliser onResult.
   */
  onInterim?: (text: string) => void;
  /** Code de langue BCP 47. Défaut : 'fr-FR' */
  lang?: string;
}

export interface UseASRReturn {
  /** `true` quand la reconnaissance est active et écoute. */
  isListening: boolean;
  /** `true` si la Web Speech API (SpeechRecognition) est disponible. */
  isSupported: boolean;
  /** Déclenche l'écoute. Sans effet si déjà actif ou non supporté. */
  startListening: () => void;
  /** Arrête l'écoute en cours. */
  stopListening: () => void;
  /** Dernier texte intermédiaire en cours de reconnaissance (vide si inactif). */
  interimText: string;
}

// ---------------------------------------------------------------------------
// Messages d'erreur localisés
// ---------------------------------------------------------------------------

function localizeASRError(code: string): string {
  const messages: Record<string, string> = {
    'no-speech':            'Aucune parole détectée. Réessayez.',
    'audio-capture':        "Microphone inaccessible. Vérifiez vos permissions.",
    'not-allowed':          "Permission microphone refusée. Autorisez l'accès dans les paramètres du navigateur.",
    'network':              'Erreur réseau lors de la reconnaissance vocale.',
    'aborted':              '', // Arrêt volontaire — pas d'erreur à afficher
    'service-not-allowed':  "Service de reconnaissance vocale non autorisé.",
  };
  return messages[code] ?? `Erreur de reconnaissance vocale : ${code}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useASR({
  onResult,
  onError,
  onInterim,
  lang = 'fr-FR',
}: UseASROptions): UseASRReturn {

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');

  // Ref vers l'instance SpeechRecognition en cours
  const recognitionRef = useRef<SpeechRecognitionAny>(null);

  // Ref pattern : garantit que l'on appelle toujours la dernière version du callback,
  // même si le composant parent a re-rendu entre-temps (évite les closures périmées).
  const onResultRef  = useRef(onResult);
  const onErrorRef   = useRef(onError);
  const onInterimRef = useRef(onInterim);
  onResultRef.current  = onResult;
  onErrorRef.current   = onError;
  onInterimRef.current = onInterim;

  // Ref interne pour le flag d'écoute (évite les dépendances dans useCallback)
  const isListeningRef = useRef(false);

  // Détection du support navigateur
  const isSupported =
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in (window as any)));

  // -------------------------------------------------------------------------
  // startListening — démarre une session push-to-talk
  // -------------------------------------------------------------------------
  const startListening = useCallback(() => {
    if (!isSupported || isListeningRef.current) return;

    // Récupérer le constructeur (Chrome préfixe avec webkit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const recognition: SpeechRecognitionAny = new SR();
    recognition.lang            = lang;
    recognition.continuous      = false;  // s'arrête après le premier résultat final
    recognition.interimResults  = true;   // résultats intermédiaires pour feedback visuel
    recognition.maxAlternatives = 5;      // plus d'alternatives = parsing plus robuste

    // ── Résultat reçu ──────────────────────────────────────────────────────
    recognition.onresult = (event: SpeechRecognitionAny) => {
      // Parcourir tous les résultats accumulés dans l'événement
      for (let resultIdx = event.resultIndex; resultIdx < event.results.length; resultIdx++) {
        const resultList = event.results[resultIdx];
        const isFinal = resultList.isFinal as boolean;
        const primary = resultList[0].transcript as string;

        if (!isFinal) {
          // Résultat intermédiaire : mise à jour du feedback visuel uniquement
          setInterimText(primary);
          onInterimRef.current?.(primary);
          continue;
        }

        // Résultat final : déclencher le parsing
        setInterimText('');
        const confidence = (resultList[0].confidence as number) || 0.8;

        // Toutes les alternatives pour parsing de fallback
        const alternatives: string[] = [];
        for (let i = 1; i < resultList.length; i++) {
          const t = resultList[i].transcript as string;
          if (t && t !== primary) alternatives.push(t);
        }

        onResultRef.current(primary, alternatives, confidence);
      }
    };

    // ── Fin de session ─────────────────────────────────────────────────────
    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    // ── Erreur ────────────────────────────────────────────────────────────
    recognition.onerror = (event: SpeechRecognitionAny) => {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;

      const message = localizeASRError(event.error as string);
      if (message) {
        onErrorRef.current?.(message);
      }
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      // Peut échouer si déjà démarrée (rare mais possible)
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [isSupported, lang]);

  // -------------------------------------------------------------------------
  // stopListening — arrête la session en cours
  // -------------------------------------------------------------------------
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // -------------------------------------------------------------------------
  // Nettoyage lors du démontage du composant
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, startListening, stopListening, interimText };
}
