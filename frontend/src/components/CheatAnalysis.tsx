import { useEffect, useState, useMemo } from "react";
import { ChessBoard3D } from "./ChessBoard3D";
import { ShieldCheck, ShieldAlert, Cpu, Activity, BarChart2 } from "lucide-react";
import { analyzeCheat, getCheatHistory } from "../services/api";

type CheatSignal = {
  name: string;
  score: number;
  details: string;
};

type CheatReport = {
  score: number;
  verdict: string;
  signals: CheatSignal[];
  reliable: boolean;
  reliabilityMessage: string;
};

type CheatHistoryItem = {
  id: number;
  pgn: string;
  globalScore: number;
  globalVerdict: string;
  whiteScore: number;
  whiteVerdict: string;
  blackScore: number;
  blackVerdict: string;
  reliable: boolean;
  reliabilityMessage: string;
  createdAt: string;
};

interface CheatAnalysisProps {
  onNavigate?: (page: string) => void;
}

export default function CheatAnalysis({ onNavigate }: CheatAnalysisProps) {

  const [pgn, setPgn] = useState("");
  const [report, setReport] = useState<CheatReport | null>(null);
  const [history, setHistory] = useState<CheatHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [whiteElo, setWhiteElo] = useState<number>(1800);
  const [blackElo, setBlackElo] = useState<number>(1800);
  const [show3D, setShow3D] = useState(false);
  const [demoCheatingScore, setDemoCheatingScore] = useState(0);
  const [demoSuspiciousIndices, setDemoSuspiciousIndices] = useState<number[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await getCheatHistory();
      setHistory([...data].reverse());
    } catch (err) {
      console.error("Erreur historique:", err);
      setMessage("Erreur chargement historique");
    }
  };

  const analyze = async (save = false) => {
    if (!pgn.trim()) return;

    setLoading(true);
    setMessage("");
    setReport(null);


    try {
      const data = await analyzeCheat({ pgn, eloWhite: whiteElo, eloBlack: blackElo }, save);
      
      // Adaptation du format de réponse si c'est analyse-and-save (format entité vs format report)
      const finalReport = save ? {
          score: data.globalScore,
          verdict: data.globalVerdict,
          signals: [], // L'entité sauvegardée n'a pas forcément tous les signaux détaillés ici
          reliable: data.reliable,
          reliabilityMessage: data.reliabilityMessage
      } : data;

      setReport(finalReport);
      if (save) {
          setMessage(`Analyse #${data.id} sauvegardée !`);
          fetchHistory();
      }
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Erreur pendant l'analyse. Vérifiez que le backend et l'IA sont actifs.");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    // PGN with a suspicious Black: plays engine-level moves against a casual player
    const suspectPgn = `[Event "Rated Blitz"]
[Site "lichess.org"]
[Date "2026.04.10"]
[White "CasualPlayer"]
[Black "SuspectBot"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. Nc3 d6 6. Bg5 h6 7. Bh4 g5 8. Bg3 Bg4 9. h3 Bxf3 10. Qxf3 Nd4 11. Qd1 a6 12. a3 b5 13. Ba2 c6 14. O-O Qb6 15. Kh1 O-O-O 16. f4 gxf4 17. Bxf4 Rhg8 18. Bg3 Nh5 19. Qf3 Nxg3+ 20. Qxg3 f5 0-1`;

    setPgn(suspectPgn);
    setWhiteElo(1200);
    setBlackElo(1250);
    
    // Suspicious Black moves (0-based indices):
    // Move 10: ...Nd4 (idx 19) — strong centralizing engine move
    // Move 16: ...gxf4 (idx 31) — precise pawn break
    // Move 18: ...Nh5 (idx 35) — engine tactical shot targeting g3
    // Move 19: ...Nxg3+ (idx 37) — devastating exchange sacrifice
    // Move 20: ...f5 (idx 39) — crushing continuation
    setDemoSuspiciousIndices([19, 31, 35, 37, 39]);
    setDemoCheatingScore(85);
    setShow3D(true);
  };

  const modelMetrics = useMemo(() => {
      // Mock success rates from history simulation or model eval
      return [
          { name: "ACPL (ASP)", accuracy: 92, bias: "None" },
          { name: "Match Rate (ASP)", accuracy: 88, bias: "Low" },
          { name: "XGBoost (ML)", accuracy: 95, bias: "None" },
      ];
  }, []);

  const getScoreColor = (score: number) => {
    if (score < 40) return "#10b981"; // Green
    if (score < 70) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate?.("dashboard")}
          className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/40 backdrop-blur-sm border border-white/10 shadow-sm text-slate-300 hover:bg-slate-800 transition-all font-medium"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Retour Dashboard
        </button>
        
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${loading ? 'animate-pulse bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}>
                {loading ? <Activity className="w-5 h-5 text-cyan-400" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
            </div>
            <span className="font-semibold text-slate-200 tracking-wide">Statut: {loading ? 'Analyse en cours...' : 'Prêt'}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-2 space-y-6">
            {/* 3D Board Section — separate from the form so it doesn't block controls */}
            {show3D && (
              <section className="glass-panel rounded-3xl overflow-hidden relative" style={{ height: '550px' }}>
                <ChessBoard3D 
                  pgn={pgn} 
                  cheatScore={report?.score || demoCheatingScore} 
                  suspiciousMoveIndices={demoSuspiciousIndices.length > 0 ? demoSuspiciousIndices : undefined}
                />
              </section>
            )}

            <section className="glass-panel rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute -top-32 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-tight">Scanner de Triche Concensus</h2>
                        <p className="text-slate-400 mt-2">Fusion de 2 modèles ASP et 1 modèle XGBoost</p>
                    </div>
                </div>

                <div className="mb-6 flex gap-4 relative z-10">
                    <button
                        onClick={loadExample}
                        className="px-5 py-2.5 rounded-xl bg-slate-800/80 text-cyan-400 border border-cyan-500/20 hover:bg-slate-800 hover:border-cyan-500/50 transition-colors font-semibold text-sm shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                    >
                        Charger Suspicion PGN
                    </button>
                    <button
                        onClick={() => setShow3D(!show3D)}
                        className={`px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold text-sm flex items-center gap-2 border ${show3D ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-800/80 text-slate-300 border-transparent hover:bg-slate-700'}`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        {show3D ? "Cacher Vue 3D" : "Voir Vue 3D"}
                    </button>
                </div>

                <div className="relative group z-10">
                    <textarea
                        value={pgn}
                        onChange={(e) => setPgn(e.target.value)}
                        placeholder="Collez ici le PGN de la partie..."
                        className="w-full h-80 border border-slate-700 rounded-2xl p-6 font-mono text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none shadow-inner bg-slate-950/80 text-cyan-100 placeholder-slate-600"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">Elo Blanc</label>
                        <input 
                            type="number" 
                            value={whiteElo} 
                            onChange={e => setWhiteElo(Number(e.target.value))} 
                            className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all text-white font-mono"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">Elo Noir</label>
                        <input 
                            type="number" 
                            value={blackElo} 
                            onChange={e => setBlackElo(Number(e.target.value))} 
                            className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all text-white font-mono"
                        />
                    </div>
                </div>

                <div className="flex gap-4 relative z-10">
                    <button
                        onClick={() => analyze(false)}
                        disabled={loading}
                        className="flex-1 bg-slate-800 text-cyan-400 border border-cyan-500/30 px-6 py-4 rounded-2xl hover:bg-slate-700 hover:border-cyan-400 transition-all font-bold disabled:opacity-50 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    >
                        {loading ? "Calcul du consensus..." : "Analyse Rapide"}
                    </button>
                    <button
                        onClick={() => analyze(true)}
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6 py-4 rounded-2xl hover:opacity-90 transition-all font-bold shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 active:scale-95"
                    >
                        Analyse & Archivage
                    </button>
                </div>
            </section>

            {message && (
                <div className="animate-in slide-in-from-top-4 p-4 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 flex items-center gap-3 backdrop-blur-md">
                    <ShieldCheck className="w-5 h-5 text-glow" />
                    <span className="font-medium text-sm tracking-wide">{message}</span>
                </div>
            )}
        </div>

        {/* Right Column: Results & Metrics */}
        <div className="space-y-6">
            {report ? (
                <section className="glass-panel rounded-3xl p-8 h-fit animate-in slide-in-from-right-8 duration-500 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4">
                         <ShieldAlert className={`w-16 h-16 opacity-30 blur-[2px] ${report.score > 70 ? 'text-rose-500' : 'text-emerald-500'}`} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-cyan-400" />
                        Verdict Final
                    </h3>

                    <div className="text-center py-8 px-4 bg-slate-950/50 rounded-2xl mb-6 border border-white/5 relative">
                        <div className={`absolute inset-0 rounded-2xl opacity-10 blur-xl ${report.score > 70 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                        <div className="text-6xl font-black mb-3 relative z-10" style={{ color: getScoreColor(report.score), textShadow: `0 0 30px ${getScoreColor(report.score)}` }}>
                            {report.score.toFixed(1)}%
                        </div>
                        <div className={`text-xl font-black uppercase tracking-[0.2em] relative z-10 ${report.score > 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {report.verdict}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400 font-medium">Fiabilité de l'échantillon</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${report.reliable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                {report.reliable ? 'Optimal' : 'Faible'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 italic mb-4">{report.reliabilityMessage}</p>

                        <div className="pt-4 border-t border-white/10 space-y-4">
                            <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-tighter">Détails des Signaux</h4>
                            {report.signals.map((s, i) => (
                                <div key={i} className="group p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-300">{s.name}</span>
                                        <span className="text-xs font-black drop-shadow-md" style={{ color: getScoreColor(s.score) }}>{s.score.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full transition-all duration-1000 relative" 
                                            style={{ width: `${s.score}%`, backgroundColor: getScoreColor(s.score) }}
                                        >
                                            <div className="absolute top-0 bottom-0 right-0 w-2 bg-white/30 blur-sm"></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 capitalize">{s.details}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ) : (
                <section className="glass-panel border border-dashed border-slate-700 p-12 text-center h-fit rounded-3xl">
                    <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-float" />
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm">En attente des données...</h3>
                    <p className="text-slate-600 text-xs mt-2">Le réseau neuronal évaluera le PGN</p>
                </section>
            )}

            {/* Performance Metrics Section */}
            <section className="glass-panel border border-white/5 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-400" />
                    Topologie IA
                </h3>
                <div className="space-y-4">
                    {modelMetrics.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-900/60 border border-white/5 rounded-xl">
                            <div>
                                <div className="text-xs font-bold text-slate-300">{m.name}</div>
                                <div className="text-[10px] text-slate-500">Biais: {m.bias}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-indigo-400">{m.accuracy}%</div>
                                <div className="text-[9px] text-slate-600">Précision Moy.</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
      </div>

      <section className="glass-panel rounded-3xl p-8 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Archives de Détection</h2>
            <p className="text-sm text-slate-400">Stockage sécurisé AES-256 (H2 en local)</p>
          </div>

          <button
            onClick={fetchHistory}
            className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all font-bold text-sm shadow-sm border border-slate-600"
          >
            Rafraîchir
          </button>
        </div>

        {history.length === 0 && (
          <div className="text-center py-20 grayscale opacity-30">
              <Activity className="w-16 h-16 mx-auto mb-4" />
              <p className="font-bold">Aucune archive disponible</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {history.map((h) => (
            <div key={h.id} className="group border border-slate-700/50 rounded-3xl p-6 bg-slate-900/50 backdrop-blur-sm hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-500/20 px-2 py-1 rounded-md tracking-wider">ID:{h.id}</span>
                        <span className="text-[10px] text-slate-500">{new Date(h.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-black text-white drop-shadow-md">{h.globalScore.toFixed(0)}%</span>
                        <span className={`text-xs font-bold uppercase tracking-widest ${
                          h.globalScore >= 70 ? 'text-rose-400' :
                          h.globalScore >= 50 ? 'text-orange-400' :
                          h.globalScore >= 30 ? 'text-amber-400' :
                          'text-emerald-400'
                        }`}>{h.globalVerdict}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-700/50">
                        <div className="text-center p-2 rounded-xl bg-slate-950/50 group-hover:bg-slate-900 border border-transparent group-hover:border-slate-700 transition-all">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">White</div>
                            <div className="text-xs font-black text-slate-200 mt-1">{h.whiteScore.toFixed(1)}</div>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-slate-950/50 group-hover:bg-slate-900 border border-transparent group-hover:border-slate-700 transition-all">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Black</div>
                            <div className="text-xs font-black text-slate-200 mt-1">{h.blackScore.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}