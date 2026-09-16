import { useState } from 'react';
import { Clock, User, Bot, Zap, Timer, Crown, Play, Settings, Brain, Globe, Swords } from 'lucide-react';

interface TimePreset {
  label: string;
  minutes: number;
  increment: number;
}

interface GameSetupProps {
  onStartGame: (settings: any) => void;
}

const TIME_PRESETS: { [key: string]: TimePreset[] } = {
  bullet: [
    { label: '1+0', minutes: 1, increment: 0 },
    { label: '1+1', minutes: 1, increment: 1 },
    { label: '2+1', minutes: 2, increment: 1 },
  ],
  blitz: [
    { label: '3+0', minutes: 3, increment: 0 },
    { label: '3+2', minutes: 3, increment: 2 },
    { label: '5+0', minutes: 5, increment: 0 },
    { label: '5+3', minutes: 5, increment: 3 },
  ],
  rapid: [
    { label: '10+0', minutes: 10, increment: 0 },
    { label: '10+5', minutes: 10, increment: 5 },
    { label: '15+10', minutes: 15, increment: 10 },
  ],
  classical: [
    { label: '30+0', minutes: 30, increment: 0 },
    { label: '30+20', minutes: 30, increment: 20 },
    { label: '60+0', minutes: 60, increment: 0 },
  ],
};

export function GameSetup({ onStartGame }: GameSetupProps) {
  const [timeControl, setTimeControl] = useState<string>('blitz');
  const [selectedPreset, setSelectedPreset] = useState<TimePreset>(TIME_PRESETS.blitz[1]);
  const [opponent, setOpponent] = useState<string>('bot');
  const [depth, setDepth] = useState<number | null>(null);
  const [movetime, setMovetime] = useState<number | null>(null);
  const [useDepth, setUseDepth] = useState<boolean>(true);
  const [joinCode, setJoinCode] = useState('');

  const handleTimeControlChange = (control: string) => {
    setTimeControl(control);
    setSelectedPreset(TIME_PRESETS[control][0]);
  };

  const handleStartGame = () => {
    // Validate engine settings for bot mode
    if (opponent === 'bot') {
      if (useDepth && depth === null) {
        alert('Veuillez sélectionner une profondeur');
        return;
      }
      if (!useDepth && movetime === null) {
        alert('Veuillez sélectionner un temps');
        return;
      }
    }

    onStartGame({
      timeControl,
      timeMinutes: selectedPreset.minutes,
      increment: selectedPreset.increment,
      opponent,
      joinCode: opponent === 'friend_join' ? joinCode : undefined,
      engineSettings: opponent === 'bot' ? {
        depth: useDepth ? depth : null,
        movetime: !useDepth ? movetime : null,
        useDepth,
      } : null,
    });
  };

  const getTimeControlClass = (control: string): string => {
    const baseClass = 'p-4 rounded-xl border-2 transition-all duration-200';
    if (timeControl === control) {
      return baseClass + ' border-blue-500 bg-cyan-900/30 shadow-lg scale-105';
    }
    return baseClass + ' border-slate-200 glass-panel hover:border-blue-300 hover:shadow-md';
  };

  const getPresetClass = (preset: TimePreset): string => {
    const baseClass = 'p-4 rounded-xl border-2 transition-all duration-200';
    if (selectedPreset.label === preset.label) {
      return baseClass + ' border-purple-500 bg-purple-50 shadow-lg scale-105';
    }
    return baseClass + ' border-slate-200 glass-panel hover:border-purple-300 hover:shadow-md';
  };

  const opponentLabel = (op: string): string => {
    const map: { [k: string]: string } = {
      bot: 'Bot Stockfish', bot_ml: 'Mon Bot ML', human: 'Humain (local)',
      online: 'En ligne', friend_create: 'Créer partie ami', friend_join: 'Rejoindre partie',
    };
    return map[op] || op;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass-panel p-8">
        <div className="text-center mb-8">
          <h2 className="text-slate-100 mb-2 text-2xl font-bold">Nouvelle partie</h2>
          <p className="text-slate-400">Configurez votre partie</p>
        </div>

        {/* Time Control */}
        <div className="mb-8">
          <label className="flex items-center gap-2 text-slate-100 mb-4 font-semibold">
            <Clock className="w-5 h-5 text-cyan-400" />
            Cadence de jeu
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => handleTimeControlChange('bullet')} className={getTimeControlClass('bullet')}>
              <Zap className={timeControl === 'bullet' ? 'w-6 h-6 mx-auto mb-2 text-cyan-400' : 'w-6 h-6 mx-auto mb-2 text-slate-400'} />
              <div className={timeControl === 'bullet' ? 'text-cyan-100' : 'text-slate-300'}>Bullet</div>
              <div className="text-xs text-slate-500 mt-1">moins 3 min</div>
            </button>
            <button onClick={() => handleTimeControlChange('blitz')} className={getTimeControlClass('blitz')}>
              <Timer className={timeControl === 'blitz' ? 'w-6 h-6 mx-auto mb-2 text-cyan-400' : 'w-6 h-6 mx-auto mb-2 text-slate-400'} />
              <div className={timeControl === 'blitz' ? 'text-cyan-100' : 'text-slate-300'}>Blitz</div>
              <div className="text-xs text-slate-500 mt-1">3-10 min</div>
            </button>
            <button onClick={() => handleTimeControlChange('rapid')} className={getTimeControlClass('rapid')}>
              <Clock className={timeControl === 'rapid' ? 'w-6 h-6 mx-auto mb-2 text-cyan-400' : 'w-6 h-6 mx-auto mb-2 text-slate-400'} />
              <div className={timeControl === 'rapid' ? 'text-cyan-100' : 'text-slate-300'}>Rapide</div>
              <div className="text-xs text-slate-500 mt-1">10-20 min</div>
            </button>
            <button onClick={() => handleTimeControlChange('classical')} className={getTimeControlClass('classical')}>
              <Crown className={timeControl === 'classical' ? 'w-6 h-6 mx-auto mb-2 text-cyan-400' : 'w-6 h-6 mx-auto mb-2 text-slate-400'} />
              <div className={timeControl === 'classical' ? 'text-cyan-100' : 'text-slate-300'}>Classique</div>
              <div className="text-xs text-slate-500 mt-1">plus 20 min</div>
            </button>
          </div>
        </div>

        {/* Time presets */}
        <div className="mb-8">
          <label className="text-slate-100 mb-4 block font-semibold">Temps de jeu</label>
          <div className="grid grid-cols-3 gap-3">
            {TIME_PRESETS[timeControl].map((preset) => (
              <button key={preset.label} onClick={() => setSelectedPreset(preset)} className={getPresetClass(preset)}>
                <div className={selectedPreset.label === preset.label ? 'text-2xl mb-1 text-purple-900' : 'text-2xl mb-1 text-slate-300'}>
                  {preset.label}
                </div>
                <div className="text-xs text-slate-500">
                  {preset.minutes} min {preset.increment > 0 ? '+ ' + preset.increment + 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Opponent */}
        <div className="mb-8">
          <label className="text-slate-100 mb-4 block font-semibold">Adversaire</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Bot Stockfish */}
            <button onClick={() => setOpponent('bot')} className={opponent === 'bot' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-green-500 bg-green-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-green-300 hover:shadow-md'}>
              <Bot className={opponent === 'bot' ? 'w-7 h-7 mx-auto mb-2 text-green-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'bot' ? 'text-sm font-medium text-green-900' : 'text-sm font-medium text-slate-300'}>Bot Stockfish</div>
              <div className="text-xs text-slate-500 mt-1">Moteur d'échecs</div>
            </button>

            {/* Bot ML */}
            <button onClick={() => setOpponent('bot_ml')} className={opponent === 'bot_ml' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-indigo-500 bg-indigo-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-indigo-300 hover:shadow-md'}>
              <Brain className={opponent === 'bot_ml' ? 'w-7 h-7 mx-auto mb-2 text-indigo-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'bot_ml' ? 'text-sm font-medium text-indigo-900' : 'text-sm font-medium text-slate-300'}>Mon Bot ML</div>
              <div className="text-xs text-slate-500 mt-1">IA personnalisée</div>
            </button>

            {/* Local human */}
            <button onClick={() => setOpponent('human')} className={opponent === 'human' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-orange-500 bg-orange-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-orange-300 hover:shadow-md'}>
              <User className={opponent === 'human' ? 'w-7 h-7 mx-auto mb-2 text-orange-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'human' ? 'text-sm font-medium text-orange-900' : 'text-sm font-medium text-slate-300'}>Humain</div>
              <div className="text-xs text-slate-500 mt-1">2 joueurs local</div>
            </button>

            {/* Online matchmaking */}
            <button onClick={() => setOpponent('online')} className={opponent === 'online' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-cyan-500 bg-cyan-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-cyan-300 hover:shadow-md'}>
              <Globe className={opponent === 'online' ? 'w-7 h-7 mx-auto mb-2 text-cyan-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'online' ? 'text-sm font-medium text-cyan-900' : 'text-sm font-medium text-slate-300'}>En ligne</div>
              <div className="text-xs text-slate-500 mt-1">Matchmaking</div>
            </button>

            {/* Create friend game */}
            <button onClick={() => setOpponent('friend_create')} className={opponent === 'friend_create' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-purple-500 bg-purple-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-purple-300 hover:shadow-md'}>
              <Swords className={opponent === 'friend_create' ? 'w-7 h-7 mx-auto mb-2 text-purple-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'friend_create' ? 'text-sm font-medium text-purple-900' : 'text-sm font-medium text-slate-300'}>Créer partie</div>
              <div className="text-xs text-slate-500 mt-1">Inviter un ami</div>
            </button>

            {/* Join friend game */}
            <button onClick={() => setOpponent('friend_join')} className={opponent === 'friend_join' ? 'p-5 rounded-xl border-2 transition-all duration-200 border-pink-500 bg-pink-50 shadow-lg scale-105' : 'p-5 rounded-xl border-2 transition-all duration-200 border-slate-200 glass-panel hover:border-pink-300 hover:shadow-md'}>
              <User className={opponent === 'friend_join' ? 'w-7 h-7 mx-auto mb-2 text-pink-600' : 'w-7 h-7 mx-auto mb-2 text-slate-400'} />
              <div className={opponent === 'friend_join' ? 'text-sm font-medium text-pink-900' : 'text-sm font-medium text-slate-300'}>Rejoindre</div>
              <div className="text-xs text-slate-500 mt-1">Avec un code</div>
            </button>
          </div>
        </div>

        {/* Join code input */}
        {opponent === 'friend_join' && (
          <div className="mb-8 p-6 bg-pink-50 rounded-xl border-2 border-pink-200">
            <label className="block text-sm font-medium text-slate-300 mb-2">Code de la partie</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Ex: a1b2c3d4"
              className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg font-mono text-center"
            />
          </div>
        )}

        {/* Bot settings */}
        {opponent === 'bot' && (
          <div className="mb-8 p-6 bg-cyan-900/30 rounded-xl border-2 border-blue-200">
            <label className="flex items-center gap-2 text-slate-100 mb-4">
              <Settings className="w-5 h-5 text-cyan-400" />
              Paramètres du moteur Stockfish
            </label>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Mode de calcul</label>
              <div className="flex gap-4">
                <button onClick={() => setUseDepth(true)} className={`flex-1 p-3 rounded-lg border-2 transition-all ${useDepth ? 'border-blue-500 bg-cyan-500/20 text-cyan-100' : 'border-slate-200 glass-panel text-slate-300 hover:border-blue-300'}`}>
                  Profondeur
                </button>
                <button onClick={() => setUseDepth(false)} className={`flex-1 p-3 rounded-lg border-2 transition-all ${!useDepth ? 'border-purple-500 bg-purple-100 text-purple-900' : 'border-slate-200 glass-panel text-slate-300 hover:border-purple-300'}`}>
                  Temps
                </button>
              </div>
            </div>
            {useDepth ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Profondeur</label>
                <div className="grid grid-cols-5 gap-2">
                  {[5, 10, 15, 20, 25].map((d) => (
                    <button key={d} onClick={() => setDepth(d)} className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${depth === d ? 'border-blue-500 bg-cyan-500/20 text-cyan-100' : 'border-slate-200 glass-panel text-slate-300 hover:border-blue-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Temps de réflexion (ms)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 2000, 3000, 5000].map((t) => (
                    <button key={t} onClick={() => setMovetime(t)} className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${movetime === t ? 'border-purple-500 bg-purple-100 text-purple-900' : 'border-slate-200 glass-panel text-slate-300 hover:border-purple-300'}`}>
                      {t}ms
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary & Start */}
        <div className="border-t border-slate-200 pt-6">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 mb-6">
            <div className="text-sm text-slate-400 mb-2">Résumé de la partie</div>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm">
                {timeControl.charAt(0).toUpperCase() + timeControl.slice(1)}
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm">
                {selectedPreset.label}
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm">
                vs {opponentLabel(opponent)}
              </span>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={
              (opponent === 'bot' && ((useDepth && !depth) || (!useDepth && !movetime))) ||
              (opponent === 'friend_join' && !joinCode.trim())
            }
            className={`w-full py-4 rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center gap-3 text-white font-semibold ${
              (opponent === 'bot' && ((useDepth && !depth) || (!useDepth && !movetime))) ||
              (opponent === 'friend_join' && !joinCode.trim())
                ? 'bg-slate-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl'
            }`}
          >
            <Play className="w-6 h-6" />
            <span className="text-lg">Commencer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
