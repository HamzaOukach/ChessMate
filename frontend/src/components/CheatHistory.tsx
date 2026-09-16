import { useEffect, useState } from "react";
import { BACKEND_API_URL } from "../services/api";

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

export function CheatHistory() {
  const [items, setItems] = useState<CheatHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CheatHistoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const getTextColor = (score: number) => {
    if (score < 40) return "text-green-600";
    if (score < 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getBarColor = (score: number) => {
    if (score < 40) return "bg-green-500";
    if (score < 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${BACKEND_API_URL}/api/cheat/history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Erreur lors du chargement de l'historique");
      }

      setItems(data);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id: number) => {
    try {
      setDetailsLoading(true);
      setError("");

      const response = await fetch(`${BACKEND_API_URL}/api/cheat/history/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Erreur lors du chargement du détail");
      }

      setSelectedItem(data);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl text-gray-900">Historique des analyses</h2>
        <button
          onClick={loadHistory}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Rafraîchir
        </button>
      </div>

      {loading && <p className="text-gray-600">Chargement...</p>}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-gray-600">Aucune analyse sauvegardée.</p>
      )}

      {items.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => loadDetails(item.id)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">Analyse #{item.id}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`font-semibold ${getTextColor(item.globalScore)}`}>
                    {item.globalVerdict}
                  </span>
                </div>

                <div className="mt-3">
                  <p className={getTextColor(item.globalScore)}>
                    <strong>Score global :</strong> {item.globalScore.toFixed(2)}
                  </p>

                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`${getBarColor(item.globalScore)} h-2 rounded-full`}
                      style={{ width: `${Math.min(item.globalScore, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <p className={`mt-2 text-sm ${item.reliable ? "text-green-600" : "text-orange-600"}`}>
                  {item.reliabilityMessage}
                </p>
              </div>
            ))}
          </div>

          <div className="border rounded-lg p-4 bg-white min-h-[300px]">
            {detailsLoading && <p className="text-gray-600">Chargement du détail...</p>}

            {!detailsLoading && !selectedItem && (
              <p className="text-gray-600">Clique sur une analyse pour voir le détail.</p>
            )}

            {!detailsLoading && selectedItem && (
              <div className="space-y-4">
                <h3 className="text-xl text-gray-900">
                  Détail analyse #{selectedItem.id}
                </h3>

                <div>
                  <p className={getTextColor(selectedItem.globalScore)}>
                    <strong>Score global :</strong> {selectedItem.globalScore.toFixed(2)}
                  </p>
                  <p className={getTextColor(selectedItem.globalScore)}>
                    <strong>Verdict global :</strong> {selectedItem.globalVerdict}
                  </p>
                  <p className={`mt-1 text-sm ${selectedItem.reliable ? "text-green-600" : "text-orange-600"}`}>
                    {selectedItem.reliabilityMessage}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Blanc</h4>
                    <p className={getTextColor(selectedItem.whiteScore)}>
                      <strong>Score :</strong> {selectedItem.whiteScore.toFixed(2)}
                    </p>
                    <p className={getTextColor(selectedItem.whiteScore)}>
                      <strong>Verdict :</strong> {selectedItem.whiteVerdict}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-100 border">
                    <h4 className="font-semibold text-gray-900 mb-2">Noir</h4>
                    <p className={getTextColor(selectedItem.blackScore)}>
                      <strong>Score :</strong> {selectedItem.blackScore.toFixed(2)}
                    </p>
                    <p className={getTextColor(selectedItem.blackScore)}>
                      <strong>Verdict :</strong> {selectedItem.blackVerdict}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">PGN</h4>
                  <textarea
                    readOnly
                    value={selectedItem.pgn}
                    rows={12}
                    className="w-full border rounded-lg p-3 text-sm font-mono bg-gray-50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}