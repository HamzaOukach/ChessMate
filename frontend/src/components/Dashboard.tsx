import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Target, Brain, Clock, Loader2, Upload, ExternalLink } from "lucide-react";
import { getAllStats, uploadFile, getEtlStatus } from '../services/api';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

type EtlLog = {
  id: number;
  dateFin: string;
  nbParties: number;
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const [winRate, setWinRate] = useState<number>(0);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [nbParties, setNbParties] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [bestMoves, setBestMoves] = useState<any[]>([]);
  const [etlLog, setLogEtl] = useState<EtlLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [userElo, setUserElo] = useState<number>(800);

  useEffect(() => {
    const fetchElo = async () => {
      try {
        const joueurId = localStorage.getItem('joueurId');
        if (joueurId) {
          const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/joueurs/${joueurId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.elo) setUserElo(data.elo);
          }
        }
      } catch (e) {
        console.error("Erreur fetch elo:", e);
      }
    };
    fetchElo();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const joueurIdString = localStorage.getItem("joueurId") || "";
  const joueurId = Number(joueurIdString);

  const applyStats = (stats: any) => {
    setWinRate(stats?.winRate || 0);
    setRecentGames(stats?.lastParties || []);
    setNbParties(stats?.nbParties || 0);
    setAccuracy(stats?.accuracy || 0);
    setBestMoves(stats?.bestMoves || []);
    setLogEtl(stats?.logEtl || null);
  };

  const refreshStats = async () => {
    if (!joueurId) return;
    try {
      const stats = await getAllStats(joueurId);
      applyStats(stats);
      localStorage.setItem("stats", JSON.stringify(stats));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!joueurId) {
      setLoading(false);
      return;
    }
    const cached = localStorage.getItem("stats");
    if (cached) {
      applyStats(JSON.parse(cached));
      setLoading(false);
      // Still refresh in background
      refreshStats();
    } else {
      refreshStats();
    }
  }, [joueurId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const { jobId } = await uploadFile(file, joueurIdString);
      
      // Polling for completion
      const poll = async () => {
        try {
          const { status } = await getEtlStatus(jobId);
          if (status === "COMPLETED") {
            setStatusMessage({ type: 'success', text: "Analyse terminée avec succès !" });
            setIsUploading(false);
            refreshStats();
            return;
          }
          if (status === "FAILED") {
            setStatusMessage({ type: 'error', text: "L'analyse a échoué." });
            setIsUploading(false);
            return;
          }
          setTimeout(poll, 2000);
        } catch (e) {
          setStatusMessage({ type: 'error', text: "Erreur lors du suivi de l'analyse." });
          setIsUploading(false);
        }
      };
      poll();
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Erreur lors de l'envoi du fichier." });
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-slate-400 font-medium">Chargement de votre profil tactique...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-700">
      <div className="relative">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mb-2 tracking-tight">Tableau de bord</h2>
        <p className="text-slate-400 font-medium">
          Analyse de performance pour <span className="text-slate-200 font-bold">{localStorage.getItem('username')}</span>
        </p>
        <button 
          onClick={refreshStats}
          className="absolute top-0 right-0 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-white/5"
          title="Rafraîchir les statistiques"
        >
          <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-6 group hover:translate-y-[-2px] hover:shadow-cyan-500/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Parties totales</div>
            <Target className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-slate-100">{nbParties}</div>
        </div>

        <div className="glass-panel rounded-2xl p-6 group hover:translate-y-[-2px] hover:shadow-indigo-500/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Taux de victoire</div>
            <TrendingUp className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-slate-100">{winRate}%</div>
        </div>

        <div className="glass-panel rounded-2xl p-6 group hover:translate-y-[-2px] hover:shadow-fuchsia-500/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Précision moyenne</div>
            <Brain className="w-5 h-5 text-fuchsia-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-slate-100">{accuracy}%</div>
        </div>

        <div className="glass-panel rounded-2xl p-6 group hover:translate-y-[-2px] hover:shadow-amber-500/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Classement ELO</div>
            <TrendingUp className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-slate-100">{userElo}</div>
          <div className="text-xs text-slate-500 mt-1">Niveau compétitif</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-white mb-6 text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Parties récentes
          </h3>
          <div className="space-y-3">
            {recentGames.length > 0 ? recentGames.map((game, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => onNavigate?.('history')}
              >
                <div className="flex-1">
                  <div className="text-slate-100 font-semibold">{game.adversaire}</div>
                  <div className="text-xs text-slate-500">{new Date(game.dates).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium text-slate-300">
                    Précision: <span className={game.precision > 0 ? 'text-cyan-400' : 'text-slate-500 italic'}>
                      {game.precision > 0 ? `${game.precision}%` : 'Calcul...'}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      game.resultat === "Victoire"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {game.resultat}
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                Aucune partie importée.
              </div>
            )}
          </div>
          {recentGames.length > 0 && (
            <button 
              onClick={() => onNavigate?.('history')}
              className="w-full mt-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 font-medium flex items-center justify-center gap-1 transition-colors"
            >
              Voir tout l'historique <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-white mb-6 text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Meilleurs coups par probabilité
          </h3>
          <div className="space-y-6">
            {bestMoves.length > 0 ? bestMoves.map((move, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-medium">{move.phase}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Coup: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 border border-slate-700">{move.coup}</span> • {move.parties} parties
                    </div>
                  </div>
                  <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">{move.winrate}%</div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 shadow-inner">
                  <div
                    className="h-2.5 rounded-full transition-all duration-1000 bg-gradient-to-r from-cyan-500 to-indigo-500 relative"
                    style={{ width: `${move.winrate}%` }}
                  >
                    <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/20 blur-[2px] rounded-full"></div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                L'analyse des ouvertures apparaîtra ici.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl p-8 border border-white/10 bg-slate-900/40 backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="relative z-10">
          <h3 className="text-white mb-2 text-2xl font-bold tracking-tight">Scanner d'Analyse</h3>
          <p className="text-slate-400 mb-6 max-w-2xl">
            Importez vos fichiers PGN ou connectez votre base de données Lichess pour initier une analyse algorithmique avec détection d'anomalies.
          </p>
          <div className="flex gap-4 items-center flex-wrap">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pgn" 
              className="hidden" 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-cyan-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {isUploading ? "Analyse en cours..." : "Importer PGN"}
            </button>

            <button
              onClick={() => onNavigate?.("cheat")}
              className="px-6 py-3 bg-transparent text-cyan-400 font-bold border-2 border-cyan-500/30 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-400 transition-all"
            >
              Lancer Détection Triche
            </button>

            {statusMessage && (
              <div className={`text-sm font-bold px-4 py-2 rounded-lg ${
                statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              } animate-in slide-in-from-left-4`}>
                {statusMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}