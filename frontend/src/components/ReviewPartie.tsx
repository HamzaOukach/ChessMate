import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInfoPartie } from "../services/api";
import { ArrowLeft } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ReviewPartie() {
  const [partie, setPartie] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chess, setChess] = useState<Chess | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  const navigate = useNavigate();
  const joueurConnecteId = Number(localStorage.getItem("joueurId"));
  const partieId = Number(localStorage.getItem("partieId"));

  
  useEffect(() => {
    if (!partieId || isNaN(partieId)) {
      console.error("ID de partie invalide");
      setLoading(false);
      return;
    }

    const fetchPartie = async () => {
      try {
        const res = await getInfoPartie(partieId);
        setPartie(res);
        console.log(res);
        // Initialisation de l'échiquier
        const game = new Chess();
        if (res.pgnPartie) {
          const tempGame = new Chess();
          tempGame.loadPgn(res.pgnPartie);

          setHistory(tempGame.history()); // récupérer les coups
        }

        setChess(game); // échiquier au début
        setCurrentMoveIndex(0);
      } catch (err) {
        console.error("Erreur récupération partie :", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPartie();
  }, [partieId]);

  
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setCurrentMoveIndex((prev) => {
        if (prev >= history.length) {
          setAutoPlay(false);
          return prev;
        }

        const game = new Chess();
        for (let i = 0; i <= prev; i++) {
          game.move(history[i]);
        }

        setChess(game);
        return prev + 1;
      });
    }, 1000); // 1 seconde par coup

    return () => clearInterval(interval);
  }, [autoPlay, history]);

  if (loading) return <div>Chargement de la partie...</div>;
  if (!partie) return <div className="text-red-600">Partie introuvable</div>;

  const joueurEstBlanc = partie.joueurBlanc?.id === joueurConnecteId;
  const joueurEstNoir = partie.joueurNoir?.id === joueurConnecteId;
  const adversaire = joueurEstBlanc ? partie.joueurNoir : partie.joueurBlanc;

  let resultatJoueur: string;
  if (partie.resultat === 1) {
    resultatJoueur = "Nulle";
  } else if ((partie.resultat === 0 && joueurEstNoir) || (partie.resultat === 2 && joueurEstBlanc)) {
    resultatJoueur = "Victoire";
  } else {
    resultatJoueur = "Défaite";
  }

  // ===== STATS ELO JOUEUR CONNECTÉ =====
  const eloJoueur = joueurEstBlanc ? partie.elo_Blanc : partie.elo_Noir;
  const eloAdversaire = joueurEstBlanc ? partie.elo_Noir : partie.elo_Blanc;

  // Écart ELO
  const ecartElo = Math.abs(eloJoueur - eloAdversaire);

  // Favori ou outsider
  const estFavori = eloJoueur > eloAdversaire;

  // Probabilité de victoire
  const expectedScore = 1 / (1 + Math.pow(10, (eloAdversaire - eloJoueur) / 400));
  const probaVictoire = Math.round(expectedScore * 100);

  // Score réel
  let scoreReel = 0.5;
  if (resultatJoueur === "Victoire") scoreReel = 1;
  else if (resultatJoueur === "Défaite") scoreReel = 0;

  // Gain/perte ELO
  const K = 32;
  const variationElo = Math.round(K * (scoreReel - expectedScore));
  const nouvelElo = eloJoueur + variationElo;

  // Upset (exploit)
  const upset = !estFavori && resultatJoueur === "Victoire";



  // Navigation coup par coup
  const nextMove = () => {
    if (!chess || currentMoveIndex >= history.length) return;

    const game = new Chess();
    for (let i = 0; i <= currentMoveIndex; i++) {
      game.move(history[i]);
    }
    setChess(game);
    setCurrentMoveIndex(currentMoveIndex + 1);
  };

  const prevMove = () => {
    if (!chess || currentMoveIndex <= 0) return;

    const game = new Chess();
    for (let i = 0; i < currentMoveIndex - 1; i++) {
      game.move(history[i]);
    }
    setChess(game);
    setCurrentMoveIndex(currentMoveIndex - 1);
  };


  // ===== STATS PARTIE (centrées sur le joueur connecté) =====
  const totalCoups = history.length;

  // Coups joueur / adversaire
  const coupsJoueur = joueurEstBlanc
    ? Math.ceil(totalCoups / 2)
    : Math.floor(totalCoups / 2);

  const coupsAdversaire = totalCoups - coupsJoueur;

  // Analyse détaillée
  let capturesJoueur = 0;
  let capturesAdversaire = 0;
  let premierEchecJoueur: number | null = null;
  let premierEchecAdversaire: number | null = null;

  const gameAnalysis = new Chess();

  history.forEach((move, index) => {
    const result = gameAnalysis.move(move);

    if (!result) return;

    const estJoueur =
      (result.color === "w" && joueurEstBlanc) ||
      (result.color === "b" && joueurEstNoir);

    // Captures
    if (result.captured) {
      if (estJoueur) capturesJoueur++;
      else capturesAdversaire++;
    }

    // Échecs
    if (gameAnalysis.inCheck()) {
      if (estJoueur && premierEchecJoueur === null) {
        premierEchecJoueur = index + 1;
      }
      if (!estJoueur && premierEchecAdversaire === null) {
        premierEchecAdversaire = index + 1;
      }
    }
  });

  // Génération des données du graphique
  const graphData: { coup: number; score: number }[] = [];

  const gameGraph = new Chess();

  let score = 0;

  history.forEach((move, index) => {
    const result = gameGraph.move(move);

    if (!result) return;

    const estJoueur =
      (result.color === "w" && joueurEstBlanc) ||
      (result.color === "b" && joueurEstNoir);

    // simple scoring basé sur captures
    if (result.captured) {
      score += estJoueur ? 1 : -1;
    }

    graphData.push({
      coup: index + 1,
      score: score,
    });
  });
  


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => {
          localStorage.removeItem("partieId");
          localStorage.removeItem("partieDate");
          navigate("/parties");
        }}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="w-5 h-5" /> Retour aux parties
      </button>

      <h2 className="text-2xl font-semibold text-gray-900">Titre de la partie : {partie.title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-lg shadow">
        {/* Joueur connecté */}
        <div className="border-2 border-blue-500 p-2 rounded">
          <h3 className="text-lg font-medium text-gray-700">
            Vous ({joueurEstBlanc ? "Blanc" : "Noir"})
          </h3>

          <p>Pseudo : {joueurEstBlanc ? partie.joueurBlanc.pseudo : partie.joueurNoir.pseudo}</p>

          {(() => {
            const eloActuel = joueurEstBlanc ? partie.joueurBlanc.elo : partie.joueurNoir.elo;

            return (
              <>
                <p>
                  Votre ELO : {eloActuel}
                </p>
                <p>ELO durant la partie : {eloJoueur}</p>
              </>
            );
          })()}
        </div>

        {/* Adversaire */}
        <div className="border-2 border-gray-300 p-2 rounded">
          <h3 className="text-lg font-medium text-gray-700">
            Adversaire ({joueurEstBlanc ? "Noir" : "Blanc"})
          </h3>

          <p>Pseudo : {adversaire?.pseudo ?? "Inconnu"}</p>

          {(() => {

            return (
              <>
                <p>
                  ELO de l'adversaire : {adversaire?.elo ?? 0}
                </p>
                <p>ELO durant la partie : {eloAdversaire}</p>
              </>
            );
          })()}
        </div>

        {/*Information partie*/}
        <div className="md:col-span-2 space-y-2">
          <p><strong>Résultat :</strong>{" "}
          <span
            className={
              resultatJoueur === "Victoire"
                ? "text-green-600 font-semibold"
                : resultatJoueur === "Défaite"
                ? "text-red-600 font-semibold"
                : "text-gray-600 font-semibold"
            }
          >
            {resultatJoueur}
          </span> | <strong>Type de résultat : </strong>{partie.type_Resultat ?? "Inconnu"}</p>
          <p><strong>Variant :</strong> {partie.variant ?? "Inconnu"}</p>
          <p><strong>Date :</strong> {partie.dateHeurePartie ? new Date(partie.dateHeurePartie).toLocaleString() : localStorage.getItem("partieDate")}</p>
          <p>
            <strong>Ouverture :</strong>{" "}
            {partie.ouverture?.libelleOuverture ?? "Inconnue"} (
            {partie.ouverture?.codeOuverture ?? "?"})
          </p>
          <p>
            <strong>Cadence :</strong>{" "}
            {partie.cadence
              ? `${partie.cadence.libelle} (${partie.cadence.typePartie})`
              : "Inconnue"}
          </p>
          <p><strong>Round :</strong> {partie.round ?? "?"}</p>

          {partie.broadcastUrl && (
            <p>
              <a href={partie.broadcastUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                Voir le broadcast
              </a>
            </p>
          )}
          {partie.gameUrl && (
            <p>
              <a href={partie.gameUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                Voir la partie en ligne
              </a>
            </p>
          )}
        </div>
        
          {/* Stats ELO joueur */}
        <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg space-y-2">
          <h3 className="text-lg font-semibold text-blue-800">📊 Vos statistiques ELO durant cette partie</h3>

          <p>
            <strong>ELO :</strong> {eloJoueur} → {nouvelElo}
            <span className={`ml-2 ${variationElo >= 0 ? "text-green-600" : "text-red-600"}`}>
              ({variationElo >= 0 ? "+" : ""}{variationElo})
            </span>
          </p>

          <p><strong>Écart avec l’adversaire :</strong> {ecartElo} points</p>

          <p>
            <strong>Statut :</strong>{" "}
            {estFavori ? "Favori" : "Outsider"}
          </p>

          <p>
            <strong>Chance de victoire estimée :</strong> {probaVictoire}%
          </p>

          <p>
            <strong>Performance :</strong>{" "}
            {upset ? "🔥 Exploit (victoire contre plus fort)" : "Normal"}
          </p>
        </div>
        
        {/* Stats partie joueur */}
        <div className="md:col-span-2 bg-green-50 p-4 rounded-lg space-y-3">
          <h3 className="text-lg font-semibold text-green-800">
            ♟️ Vos statistiques dans la partie
          </h3>

          <p>
            <strong>Coups joués :</strong> {coupsJoueur} 
            <span className="text-gray-500"> (Adversaire : {coupsAdversaire})</span>
          </p>

          <p>
            <strong>Captures :</strong> {capturesJoueur} 
            <span className="text-gray-500"> (Adversaire : {capturesAdversaire})</span>
          </p>

          <p>
            <strong>Premier échec donné :</strong>{" "}
            {premierEchecJoueur ? `coup ${premierEchecJoueur}` : "Aucun"}
          </p>

          <p>
            <strong>Premier échec subi :</strong>{" "}
            {premierEchecAdversaire ? `coup ${premierEchecAdversaire}` : "Aucun"}
          </p>

          {/* Barre visuelle */}
          <div>
            <p className="text-sm font-medium">
              ⏱Répartition des coups (activité)
            </p>

            <div className="flex h-5 w-full bg-gray-200 rounded overflow-hidden mt-1">
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-xs"
                style={{ width: `${(coupsJoueur / totalCoups) * 100}%` }}
              >
                {Math.round((coupsJoueur / totalCoups) * 100)}%
              </div>

              <div
                className="bg-gray-500 flex items-center justify-center text-white text-xs"
                style={{ width: `${(coupsAdversaire / totalCoups) * 100}%` }}
              >
                {Math.round((coupsAdversaire / totalCoups) * 100)}%
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Plus vous avez de coups → plus vous avez été actif dans la partie
            </p>
          </div>

          <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">
              Évolution de la partie
            </h3>

            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={graphData}>
                <XAxis 
                  dataKey="coup" 
                  label={{ value: "Numéro du coup", position: "insideBottom", offset: -5 }}
                />
                
                <YAxis 
                  label={{ value: "Avantage", angle: -90, position: "insideLeft" }}
                />

                <Tooltip 
                  formatter={(value: number) => [
                    `${value > 0 ? "+" : ""}${value} (avantage)`,
                    "Score"
                  ]}
                  labelFormatter={(label) => `Coup ${label}`}
                />

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Explications */}
            <div className="text-sm text-gray-600 mt-3 space-y-1">
              <p>📈 Courbe qui monte → vous prenez l’avantage</p>
              <p>📉 Courbe qui descend → l’adversaire prend l’avantage</p>
              <p>➖ Ligne stable → position équilibrée</p>
              <p>⚔️ Basé sur les captures (valeur des pièces)</p>
            </div>
          </div>
        </div>

        {/* Échiquier interactif */}
        
        <div>
          <div className="md:col-span-2 space-y-2">
          <p><strong>Revoir la partie</strong></p>
        </div>
        <div className="chessboard">
          <Chessboard 
          position={chess?.fen() ?? "start"} 
          boardWidth={550} 
          customDarkSquareStyle={{ backgroundColor: "#769656" }}
          customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
          />
          <div className="flex gap-4 mt-2">
            <button
              onClick={prevMove}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Précédent
            </button>

            <button
              onClick={nextMove}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Suivant
            </button>

            <button
              onClick={() => setAutoPlay(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              ▶ Auto
            </button>

            <button
              onClick={() => setAutoPlay(false)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              ⏸ Pause
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Coup de la partie</h3>
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-80 text-sm font-mono whitespace-pre">
            {partie.pgnPartie ?? "Aucun PGN disponible"}
          </div>
        </div>
        </div>
        
      </div>
    </div>
  );
}