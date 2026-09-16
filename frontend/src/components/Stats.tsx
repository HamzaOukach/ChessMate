import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, Activity } from 'lucide-react';
import { getAllStats, getStatsCouleur } from '../services/api';
import { useState, useEffect } from 'react';

type EtlLog = {
  id: number;
  dateFin: string;
  nbParties: number;
};

type CouleurStats = {
  nbPartiesBlanc: number;
  nbPartiesNoir: number;
  winRateBlanc: number;
  winRateNoir: number;
  nullRateBlanc: number;
  nullRateNoir: number;
};

export function Stats() {
  const [winRate, setWinRate] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [openingStats, setOpeningStats] = useState<any[]>([]);
  const [nbParties, setNbParties] = useState<number>(0);
  const [groupedData, setGroupedData] = useState<any>({});
  const [etlLog, setLogEtl] = useState<EtlLog | null>(null);
  const [lastAnalyze, setLastAnalyze] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [bestMovesProbability, setBestMoves] = useState<any[]>([]);
  const [accuracyOverTime, setAccuracyOverTime] = useState<any[]>([]);
  const [engineRate, setEngineRate] = useState<number>(0);
  const [accuracyBySituation, setAccuracyBySituation] = useState<any[]>([]);
  const [couleurStats, setCouleurStats] = useState<CouleurStats | null>(null);

  const joueurId = Number(localStorage.getItem("joueurId"));

  const groupByYear = (data: any[]) => {
    if (!data || data.length === 0) return {};

    const grouped: any = {};

    data.forEach((row) => {
      const year = Number(row.annee);

      if (!grouped[year]) grouped[year] = [];

      grouped[year].push({
        mois: row.mois.trim(),
        moisNumero: Number(row.mois_numero),
        victoires: Number(row.victoires),
        defaites: Number(row.defaites),
        nulles: Number(row.nulles),
      });
    });

    // Tri des mois dans chaque année
    Object.keys(grouped).forEach((year) => {
      grouped[year].sort(
        (a: any, b: any) => a.moisNumero - b.moisNumero
      );
    });

    return grouped;
  };

  const applyStats = (stats: any) => {
    setWinRate(stats?.winRate || 0);
    // On s'assure que openingStats est toujours un tableau
    setOpeningStats(stats?.bestOpenings || []);
    setAccuracy(stats?.accuracy || 0);
    setLogEtl(stats?.logEtl || null);
    setNbParties(stats?.nbParties || 0);
    setAccuracyOverTime(stats?.accuracyOverTime);
    setBestMoves(stats?.moveStatsStockfish);
    setEngineRate(stats?.engineMatch);
    setAccuracyBySituation(stats?.accuracyBySituation);

    // Sécurité sur la performance mensuelle
    const performanceData = stats?.performanceMensuelle || [];
    const grouped = groupByYear(performanceData);
    setGroupedData(grouped);

    const years = Object.keys(grouped).map(Number);
    if (years.length > 0) {
      setSelectedYear(Math.max(...years));
    } else {
      setSelectedYear(null); // Important pour l'affichage conditionnel
    }
  };

  const refreshStats = async () => {
    const stats = await getAllStats(joueurId);
    applyStats(stats);
    localStorage.setItem("stats", JSON.stringify(stats));
  };

  const exportStats = () => {
    // 1. Préparation des statistiques globales
    let csvContent = "STATISTIQUES CHESSMATE\n";
    csvContent += `Date de l'export : ${new Date().toLocaleString()}\n`;
    csvContent += `Dernière analyse ETL : ${etlLog?.dateFin || 'N/A'}\n\n`;

    csvContent += "RESUME GLOBAL\n";
    csvContent += `Nombre de parties -> ${nbParties}\n`;
    csvContent += `Taux de victoire -> ${winRate}%\n`;
    csvContent += `Précision moyenne -> ${accuracy}%\n`;
    csvContent += `Score de précision moteur -> ${engineRate}%\n\n`;

    // 2. Ajout des stats par situation (Avantage/Désavantage)
    if (accuracyBySituation.length > 0) {
      csvContent += "PRECISION PAR SITUATION\n";
      csvContent += "Situation, Précision (%)\n";
      accuracyBySituation.forEach(item => {
        csvContent += `${item.situation}, ${item.accuracy}\n`;
      });
      csvContent += "\n";
    }

    // 3. Ajout des stats d'ouvertures
    if (openingStats.length > 0) {
      csvContent += "TOP OUVERTURES\n";
      csvContent += "Nom, Nb Parties, Winrate (%), Taux d'utilisation (%)\n";
      openingStats.forEach(op => {
        csvContent += `"${op.ouverture}", ${op.parties}, ${op.winrate}, ${op.utilisation}\n`;
      });
      csvContent += "\n";
    }

    // 4. Ajout des meilleurs coups (probabilités)
    if (bestMovesProbability.length > 0) {
      csvContent += "MEILLEURS COUPS (ENGINE)\n";
      csvContent += "Coup, Nb Fois, Winrate (%), Engine Match (%)\n";
      bestMovesProbability.forEach(move => {
        csvContent += `${move.moveUci}, ${move.count}, ${move.avgAccuracy}, ${move.engineMatchRate}\n`;
      });
    }

    // Création du fichier et téléchargement
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chessmate_stats_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!joueurId) return;

    const cached = localStorage.getItem("stats");

    if (cached) {
      applyStats(JSON.parse(cached));
      refreshStats(); // Still refresh in background
    } else {
      refreshStats();
    }

    // Fetch couleur stats (not cached)
    getStatsCouleur(joueurId).then(setCouleurStats).catch(console.error);
  }, [joueurId]);

  useEffect(() => {
    if (!etlLog || !etlLog.dateFin) {
      setLastAnalyze("-");
      return;
    }

    const end = new Date(etlLog.dateFin).getTime();
    const now = Date.now();

    const diffMs = now - end;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      setLastAnalyze(`il y a ${days} jour(s)`);
    } else if (hours > 0) {
      setLastAnalyze(`il y a ${hours} heure(s)`);
    } else if (minutes > 0) {
      setLastAnalyze(`il y a ${minutes} minute(s)`);
    } else {
      setLastAnalyze(`il y a ${seconds} seconde(s)`);
    }

  }, [etlLog]);


  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const clampPercentage = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  };

  const roundPercentage = (value: number) =>
    Math.round(clampPercentage(value) * 10) / 10;

  const buildColorBreakdown = (games: number, winRate: number, drawRate: number) => {
    const safeWinRate = roundPercentage(Number(winRate));
    const safeDrawRate = roundPercentage(Number(drawRate));
    const lossRate = roundPercentage(100 - safeWinRate - safeDrawRate);

    return {
      games,
      winRate: safeWinRate,
      drawRate: safeDrawRate,
      lossRate,
    };
  };

  const colorPerformance = couleurStats
    ? [
      {
        key: "white",
        label: "Blancs",
        badge: <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shadow" />,
        breakdown: buildColorBreakdown(
          couleurStats.nbPartiesBlanc,
          couleurStats.winRateBlanc,
          couleurStats.nullRateBlanc
        ),
      },
      {
        key: "black",
        label: "Noirs",
        badge: <div className="w-5 h-5 rounded-full shadow" style={{ backgroundColor: "#000000" }} />,
        breakdown: buildColorBreakdown(
          couleurStats.nbPartiesNoir,
          couleurStats.winRateNoir,
          couleurStats.nullRateNoir
        ),
      },
    ]
    : [];



  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={refreshStats}
          className="p-2 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-blue-600 transition-all"
          title="Rafraîchir"
        >
          <Activity className="w-5 h-5" />
        </button>
        <button
          onClick={exportStats}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter les stats
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* WINRATE */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm opacity-90">Taux de victoire</div>
            <TrendingUp className="w-5 h-5 opacity-90" />
          </div>

          <div className="text-3xl font-bold">
            {nbParties > 0 ? `${winRate}%` : "—"}
          </div>

          <div className="text-xs mt-1 opacity-80">
            Performance globale
          </div>
        </div>

        {/* ACCURACY */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm opacity-90">Précision moyenne</div>
            <Activity className="w-5 h-5 opacity-90" />
          </div>

          <div className="text-3xl font-bold">
            {nbParties > 0 ? `${accuracy}%` : "—"}
          </div>

          <div className="text-xs mt-1 opacity-80">
            Qualité des coups
          </div>
        </div>

        {/* ENGINE MATCH */}
        <div className="bg-gradient-to-br from-indigo-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm opacity-90">Match avec Stockfish</div>
            <Activity className="w-5 h-5 opacity-90" />
          </div>

          <div className="text-3xl font-bold">
            {nbParties > 0 && engineRate != null ? `${engineRate}%` : "—"}
          </div>

          <div className="text-xs mt-1 opacity-80">
            % de vos coups validés comme optimaux par l'IA
          </div>
        </div>

        {/* PARTIES */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm opacity-90">Parties analysées</div>
            <Activity className="w-5 h-5 opacity-90" />
          </div>

          <div className="text-3xl font-bold">
            {nbParties}
          </div>

          <div className="text-xs mt-1 opacity-80">
            Lichess ETL
          </div>
        </div>

      </div>

      {/* Performance par mois */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-gray-900 mb-4">Performance mensuelle</h3>

        {selectedYear ? (
          <>
            {/* Boutons années */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(groupedData)
                .sort((a, b) => Number(b) - Number(a)) // années décroissantes
                .map((year) => (
                  <button
                    key={year}
                    className={`px-3 py-1 rounded-lg border transition ${Number(year) === selectedYear
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                      }`}
                    onClick={() => setSelectedYear(Number(year))}
                  >
                    {year}
                  </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={selectedYear ? groupedData[selectedYear] : []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="victoires" fill="#10b981" />
                <Bar dataKey="defaites" fill="#ef4444" />
                <Bar dataKey="nulles" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed">
            <Activity className="w-12 h-12 text-gray-300 mb-2" />
            <p className="text-gray-500">Aucune donnée historique disponible</p>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution de la précision */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h3 className="text-gray-900">
              Évolution de performance
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              Basé sur la progression de la précision
            </p>
          </div>
          {accuracyOverTime && accuracyOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={accuracyOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="game" />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                />
                <Tooltip
                  formatter={(value) => {
                    const v = Number(value);

                    if (Number.isNaN(v)) return ["0.0%", "Précision"];

                    return [`${v.toFixed(1)}%`, "Précision"];
                  }}
                />
                <Legend
                  content={() => (
                    <div className="text-sm text-gray-600 mt-2 space-y-1">
                      <div>
                        <span className="font-semibold">Axe X (horizontal)</span> : progression des parties par groupes (ex : 1-10, 11-20...)
                      </div>

                      <div>
                        <span className="font-semibold">Axe Y (vertical)</span> : précision moyenne des coups en %
                      </div>

                      <div>
                        📈 Une courbe qui monte = amélioration de ton niveau de jeu
                      </div>

                      <div>
                        📉 Une courbe qui baisse = pertes de précision ou erreurs plus fréquentes
                      </div>

                      <div>
                        🎯 Chaque point = moyenne de précision sur une tranche de parties consécutives
                      </div>
                    </div>
                  )} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#92f63b"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Précision (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed">
              <Activity className="w-12 h-12 text-gray-300 mb-2" />
              <p className="text-gray-500">Aucune évolution disponible</p>
              <p className="text-sm text-gray-400">
                Analyse Stockfish en cours... Les résultats s'afficheront une fois les premières variantes calculées.
              </p>
            </div>
          )}
        </div>

        {/* Meilleurs coups avec probabilités */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Analyse des coups les plus joués (Stockfish)
          </h3>

          {bestMovesProbability && bestMovesProbability.length > 0 ? (
            <div className="space-y-4">
              {bestMovesProbability.map((move, index) => {
                const rate = Math.min(Math.max(move.engineMatchRate ?? 0, 0), 100);

                return (
                  <div key={index} className="border-b pb-4 last:border-b-0">

                    {/* TOP ROW */}
                    <div className="flex items-center justify-between mb-2">

                      {/* LEFT */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="font-mono text-sm">{move.moveUci}</span>
                        </div>
                        <div>
                          <div className="text-gray-900">
                            {move.count} parties
                          </div>
                          <div className="text-sm text-gray-600">
                            Précision: {Number(move.avgAccuracy).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* RIGHT */}
                      <div className="text-right">
                        <div className="text-blue-600">
                          {rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">
                          Match avec Stockfish
                        </div>
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Number(move.avgAccuracy).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed">
              <Activity className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-gray-500">Aucune analyse disponible</p>
              <p className="text-sm text-gray-400">
                Analyse Stockfish en cours... Les résultats s'afficheront une fois les premières variantes calculées.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Qualité de jeu selon contexte */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-4">
          <h3 className="text-gray-900 font-semibold text-lg">
            Qualité de jeu selon contexte
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Compare ta précision selon les situations de jeu
          </p>

          {/* EXPLICATION AXES */}
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            <div>
              <span className="font-semibold">Axe X :</span> situation de jeu (Winning, Equal, Under pressure)
            </div>
            <div>
              <span className="font-semibold">Axe Y :</span> précision moyenne des coups en %
            </div>
          </div>
        </div>

        {accuracyBySituation && accuracyBySituation.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accuracyBySituation}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="situation" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />

              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(1)}%`,
                  "Précision"
                ]}
              />

              <Legend />

              <Bar dataKey="accuracy" name="Précision (%)" radius={[6, 6, 0, 0]}>
                {accuracyBySituation.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.situation === "Winning"
                        ? "#22c55e"
                        : entry.situation === "Equal"
                          ? "#3b82f6"
                          : "#ef4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-500 font-medium">
              Aucune donnée de contexte disponible -
              Analyse Stockfish -&gt Les résultats s'afficheront une fois les premières variantes calculées.
            </p>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Répartition des ouvertures */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Répartition des ouvertures
          </h3>
          {openingStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={openingStats}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="utilisation"
                    label={({ ouverture, percent }) =>
                      `${ouverture} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {openingStats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>

              {/* Légende détaillée */}
              <div className="mt-6 space-y-3">
                {openingStats.map((opening, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm bg-gray-50 rounded p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-800">{opening.ouverture}</span>
                    </div>

                    <div className="text-right text-gray-600">
                      <div>{opening.parties} parties</div>
                      <div className="text-green-600 font-medium">{opening.winrate}% victoires</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500 italic">
              Analysez vos premières parties pour voir vos ouvertures favorites.
            </div>
          )}
        </div>



      </div>
      {/* Performance par couleur */}
      {couleurStats && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance par couleur</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {colorPerformance.map(({ key, label, badge, breakdown }) => (
              <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {badge}
                  <span className="font-semibold text-gray-800">{label}</span>
                  <span className="text-sm text-gray-500 ml-auto">{breakdown.games} parties</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600 font-medium">Victoires</span>
                      <span className="text-gray-800">{breakdown.winRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${breakdown.winRate}%`,
                          backgroundColor: "#22c55e",
                        }}
                        title={`Victoires ${breakdown.winRate}%`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 font-medium">Nulles</span>
                      <span className="text-gray-800">{breakdown.drawRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${breakdown.drawRate}%`,
                          backgroundColor: "#6b7280",
                        }}
                        title={`Nulles ${breakdown.drawRate}%`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-500 font-medium">Defaites</span>
                      <span className="text-gray-800">{breakdown.lossRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${breakdown.lossRate}%`,
                          backgroundColor: "#ef4444",
                        }}
                        title={`Defaites ${breakdown.lossRate}%`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {couleurStats && false && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance par couleur</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Blancs */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shadow"></div>
                <span className="font-semibold text-gray-800">Blancs</span>
                <span className="text-sm text-gray-500 ml-auto">{couleurStats!.nbPartiesBlanc} parties</span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600 font-medium">Victoires</span>
                  <span className="text-green-600">{couleurStats!.winRateBlanc}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: `${couleurStats!.winRateBlanc}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 font-medium">Nulles</span>
                  <span className="text-gray-500">{couleurStats!.nullRateBlanc}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-gray-400 h-3 rounded-full" style={{ width: `${couleurStats!.nullRateBlanc}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-500 font-medium">Défaites</span>
                  <span className="text-red-500">{Math.round((100 - couleurStats!.winRateBlanc - couleurStats!.nullRateBlanc) * 10) / 10}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-red-400 h-3 rounded-full" style={{ width: `${Math.max(0, 100 - couleurStats!.winRateBlanc - couleurStats!.nullRateBlanc)}%` }} />
                </div>
              </div>
            </div>
            {/* Noirs */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-5 h-5 rounded-full bg-gray-800 shadow"></div>
                <span className="font-semibold text-gray-800">Noirs</span>
                <span className="text-sm text-gray-500 ml-auto">{couleurStats!.nbPartiesNoir} parties</span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600 font-medium">Victoires</span>
                  <span className="text-green-600">{couleurStats!.winRateNoir}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: `${couleurStats!.winRateNoir}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 font-medium">Nulles</span>
                  <span className="text-gray-500">{couleurStats!.nullRateNoir}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-gray-400 h-3 rounded-full" style={{ width: `${couleurStats!.nullRateNoir}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-500 font-medium">Défaites</span>
                  <span className="text-red-500">{Math.round((100 - couleurStats!.winRateNoir - couleurStats!.nullRateNoir) * 10) / 10}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-red-400 h-3 rounded-full" style={{ width: `${Math.max(0, 100 - couleurStats!.winRateNoir - couleurStats!.nullRateNoir)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
