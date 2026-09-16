import { useState, useEffect } from "react";
import { getAllMyParties } from "../services/api";
import { Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useNavigate } from 'react-router-dom';

type FilterType = "Toutes" | "Victoire" | "Défaite" | "Nulle";
type DateOrder = "Récentes" | "Anciennes";

export function Parties() {
  const [allGames, setAllGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("Toutes");
  const [dateOrder, setDateOrder] = useState<DateOrder>("Récentes");
  const itemsPerPage = 20;
  const joueurId = Number(localStorage.getItem("joueurId"));

  const navigate = useNavigate();

  const refreshStats = async (joueurId: number) => {
    try {
      const games = await getAllMyParties(joueurId);

      localStorage.setItem("games", JSON.stringify(games));
      setAllGames(games);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };  

  useEffect(() => {
    const fetchGames = async () => {
      const cached = localStorage.getItem("games");

      if (cached) {
        setAllGames(JSON.parse(cached));
        setLoading(false);
      } else {
        await refreshStats(joueurId);
      }
    };

    fetchGames();
  }, [joueurId]);
  if (loading) return <div>Chargement des parties...</div>;
  if (allGames.length === 0) return <p className="text-gray-600">Aucune partie trouvée.</p>;

  // Appliquer le filtre par résultat
  let filteredGames = allGames.filter((game) => filter === "Toutes" || game.resultat === filter);

  // Trier par date
  filteredGames.sort((a, b) => {
    const dateA = new Date(a.dates).getTime();
    const dateB = new Date(b.dates).getTime();
    return dateOrder === "Récentes" ? dateB - dateA : dateA - dateB;
  });

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredGames.length);
  const currentGames = filteredGames.slice(startIndex, endIndex);

  // Pagination
  const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 0));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  const handleFirst = () => setCurrentPage(0);
  const handleLast = () => setCurrentPage(totalPages - 1);

  // Changement de filtre
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(0);
  };

  const handleDateOrderChange = (order: DateOrder) => {
    setDateOrder(order);
    setCurrentPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Titre + nombre de parties */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
        <h2 className="text-gray-900 text-2xl font-semibold">
          Toutes les parties ({allGames.length})
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
  {/* Filtre par résultat */}
  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg shadow-sm">
    <span className="text-gray-600 text-sm font-medium">Résultat :</span>
    {["Toutes", "Victoire", "Défaite", "Nulle"].map((f) => (
      <button
        key={f}
        onClick={() => handleFilterChange(f as FilterType)}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
          filter === f
            ? "bg-blue-600 text-white shadow"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
        }`}
      >
        {f}
      </button>
    ))}
  </div>

    {/* Filtre par date */}
    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg shadow-sm">
      <span className="text-gray-600 text-sm font-medium">Date :</span>
      {["Récentes", "Anciennes"].map((o) => (
        <button
          key={o}
          onClick={() => handleDateOrderChange(o as DateOrder)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            dateOrder === o
              ? "bg-blue-600 text-white shadow"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
          }`}
        >
          {o}
        </button>
      ))}
      </div>
    </div>
  </div>

      {/* Grille des parties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentGames.map((game) => (
          <div
            key={game.id}
            className="flex flex-col justify-between p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div>
              <div className="text-gray-900 font-medium">Adversaire : {game.adversaire}</div>
              <div className="text-sm text-gray-500">Date : {game.dates}</div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-gray-600">Précision: {game.precision ?? 0}%</div>
              <div
                className={`px-3 py-1 rounded-full text-sm ${
                  game.resultat === "Victoire"
                    ? "bg-green-100 text-green-800"
                    : game.resultat === "Défaite"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {game.resultat}
              </div>
              <button
                onClick={() => {
                  console.log("Review partie", game.id);
                  localStorage.setItem("partieId", game.id.toString());
                  localStorage.setItem("partieDate", game.dates);
                  navigate(`/review`);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <Eye className="w-4 h-4" /> Review
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination améliorée */}
      <div className="flex justify-center items-center gap-2 mt-6">
        <button
          onClick={handleFirst}
          disabled={currentPage === 0}
          className={`p-2 rounded-md border transition-colors ${
            currentPage === 0
              ? "text-gray-400 border-gray-300 cursor-not-allowed"
              : "text-gray-700 border-gray-400 hover:bg-gray-100"
          }`}
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>

        <button
          onClick={handlePrev}
          disabled={currentPage === 0}
          className={`p-2 rounded-md border transition-colors ${
            currentPage === 0
              ? "text-gray-400 border-gray-300 cursor-not-allowed"
              : "text-gray-700 border-gray-400 hover:bg-gray-100"
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-gray-700 font-medium">
          {startIndex + 1} - {endIndex} sur {filteredGames.length}
        </span>

        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1}
          className={`p-2 rounded-md border transition-colors ${
            currentPage >= totalPages - 1
              ? "text-gray-400 border-gray-300 cursor-not-allowed"
              : "text-gray-700 border-gray-400 hover:bg-gray-100"
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={handleLast}
          disabled={currentPage >= totalPages - 1}
          className={`p-2 rounded-md border transition-colors ${
            currentPage >= totalPages - 1
              ? "text-gray-400 border-gray-300 cursor-not-allowed"
              : "text-gray-700 border-gray-400 hover:bg-gray-100"
          }`}
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}