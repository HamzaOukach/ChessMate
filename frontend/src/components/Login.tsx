import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { BACKEND_API_URL } from '../services/api';

interface LoginProps {
  onLogin: (token: string, username: string, joueurId?: number) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = BACKEND_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';

      const body = isSignup
        ? { email, hash: password, joueur: { pseudo: username } }
        : { email, hash: password };

      console.log('Sending request to:', `${API_URL}${endpoint}`, 'Body:', body);

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(errorText || 'Une erreur est survenue');
      }

      const data = await response.json();
      console.log('Success response:', data);

      if (isSignup) {
        setIsSignup(false);
        setError('Inscription réussie ! Veuillez vous connecter.');
        return;
      }

      if (data.token) {
        onLogin(data.token, data.username || email, data.joueurId);
      } else {
        throw new Error('Token manquant dans la réponse');
      }

    } catch (err) {
      console.error('Request error:', err);

      if (err instanceof TypeError) {
        setError(`Impossible de se connecter au serveur. Vérifiez que le backend tourne sur ${API_URL}`);
      } else {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="glass-panel rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">♟</div>
          <h1 className="text-slate-100 text-xl font-semibold">ChessMate</h1>
          <p className="text-slate-400 mt-2">
            Analysez vos parties avec Lichess et Stockfish
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setIsSignup(false);
              setError('');
            }}
            className={
              !isSignup
                ? 'flex-1 py-2 px-4 rounded-md bg-blue-600 text-white'
                : 'flex-1 py-2 px-4 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700'
            }
          >
            <LogIn className="inline-block w-4 h-4 mr-2" />
            Connexion
          </button>

          <button
            onClick={() => {
              setIsSignup(true);
              setError('');
            }}
            className={
              isSignup
                ? 'flex-1 py-2 px-4 rounded-md bg-blue-600 text-white'
                : 'flex-1 py-2 px-4 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700'
            }
          >
            <UserPlus className="inline-block w-4 h-4 mr-2" />
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {isSignup && (
            <div>
              <label className="block text-slate-300 mb-2">
                Nom utilisateur (Pseudo)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className={`border px-4 py-3 rounded-md ${error.includes('réussie')
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Chargement...' : isSignup ? 'Inscrire' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Assurez-vous que le backend tourne sur {API_URL}</p>
        </div>
      </div>
    </div>
  );
}