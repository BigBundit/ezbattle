import React, { useState } from 'react';
import { Participant, Match, TournamentFormat, TournamentConfig } from '../types';
import { Trash2, Play, Trophy, RefreshCw, UserPlus, Settings } from 'lucide-react';
import { Language, t } from '../i18n';

interface Props {
  players: Participant[];
  setPlayers: (players: Participant[]) => void;
  onStart: (matches: Match[], format: TournamentFormat, rounds: number, config: TournamentConfig) => void;
  lang: Language;
  config: TournamentConfig;
}

export default function Registration({ players, setPlayers, onStart, lang, config: initialConfig }: Props) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('round_robin');
  const [rounds, setRounds] = useState<number>(3);
  const [config, setConfig] = useState<TournamentConfig>(initialConfig);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const newPlayer: Participant = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim()
    };
    
    setPlayers([...players, newPlayer]);
    setName('');
  };

  const handleRemove = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const generateKnockout = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const numByes = bracketSize - shuffled.length;
    
    const newMatches: Match[] = [];
    const totalRounds = Math.log2(bracketSize);
    
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r);
      for (let m = 0; m < matchesInRound; m++) {
        newMatches.push({
          id: `r${r}-m${m}`,
          round: r,
          matchOrder: m,
          player1Id: null,
          player2Id: null,
          score1: '',
          score2: '',
          winnerId: null,
          nextMatchId: r < totalRounds ? `r${r+1}-m${Math.floor(m/2)}` : null,
          nextMatchSlot: r < totalRounds ? (m % 2 === 0 ? 1 : 2) : undefined,
          isBye: false,
        });
      }
    }
    
    // Distribute byes evenly across the bracket
    const round1Matches = newMatches.filter(m => m.round === 1);
    const byeIndices = new Set<number>();
    if (numByes > 0) {
      const step = round1Matches.length / numByes;
      for (let i = 0; i < numByes; i++) {
        byeIndices.add(Math.floor(i * step));
      }
    }

    let playerIndex = 0;
    for (let i = 0; i < round1Matches.length; i++) {
      const match = round1Matches[i];
      match.player1Id = shuffled[playerIndex++].id;
      
      if (byeIndices.has(i)) {
        match.isBye = true;
        match.winnerId = match.player1Id;
      } else {
        match.player2Id = shuffled[playerIndex++].id;
      }
    }
    
    newMatches.forEach(match => {
      if (match.winnerId && match.nextMatchId) {
        const nextMatch = newMatches.find(m => m.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 1) {
            nextMatch.player1Id = match.winnerId;
          } else {
            nextMatch.player2Id = match.winnerId;
          }
        }
      }
    });

    return newMatches;
  };

  const generateSwissRound1 = () => {
    const newMatches: Match[] = [];
    const ps = [...players].sort(() => Math.random() - 0.5); // Randomize initial positions
    
    let matchCounter = 0;
    
    // Handle odd number of players
    if (ps.length % 2 !== 0) {
      const byePlayer = ps.pop()!;
      newMatches.push({
        id: `rr-r1-m${matchCounter++}`,
        round: 1,
        matchOrder: matchCounter,
        player1Id: byePlayer.id,
        player2Id: null,
        score1: '',
        score2: '',
        winnerId: byePlayer.id,
        nextMatchId: null,
        isBye: true
      });
    }

    // Pair remaining players
    for (let i = 0; i < ps.length; i += 2) {
      const p1 = ps[i];
      const p2 = ps[i + 1];
      
      newMatches.push({
        id: `rr-r1-m${matchCounter++}`,
        round: 1,
        matchOrder: matchCounter,
        player1Id: p1.id,
        player2Id: p2.id,
        score1: '',
        score2: '',
        winnerId: null,
        nextMatchId: null,
        isBye: false
      });
    }
    
    return newMatches;
  };

  const handleGenerate = () => {
    if (players.length < 2) {
      alert(t('needMorePlayers', lang));
      return;
    }

    const newMatches = format === 'knockout' ? generateKnockout() : generateSwissRound1();
    onStart(newMatches, format, format === 'knockout' ? 1 : rounds, config);
  };

  return (
    <div className="max-w-2xl mx-auto cartoon-card">
      <div className="p-8 border-b-4 border-slate-900 bg-green-400 rounded-t-[1.25rem] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '16px 16px' }}></div>
        <h2 className="text-4xl cartoon-title text-slate-900 relative z-10 drop-shadow-[2px_2px_0px_#fff]">{t('whosPlaying', lang)}</h2>
        <p className="text-slate-800 font-bold mt-2 relative z-10">{t('addFriends', lang)}</p>
      </div>

      <div className="p-8 bg-white rounded-b-[1.25rem]">
        {/* Tournament Settings */}
        <div className="mb-10 p-6 bg-slate-50 border-4 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a]">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-6 h-6 text-slate-900" />
            <h3 className="cartoon-title text-lg text-slate-900">Tournament Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t('tournamentName', lang)}</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full cartoon-input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('numberOfCourts', lang)}</label>
                <input
                  type="number"
                  min="1"
                  value={config.numberOfCourts}
                  onChange={(e) => setConfig({ ...config, numberOfCourts: parseInt(e.target.value) || 1 })}
                  className="w-full cartoon-input"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('matchDuration', lang)}</label>
                <input
                  type="number"
                  min="1"
                  value={config.matchDuration}
                  onChange={(e) => setConfig({ ...config, matchDuration: parseInt(e.target.value) || 30 })}
                  className="w-full cartoon-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-10">
          <h3 className="cartoon-title text-lg mb-4 text-center text-slate-900">{t('chooseGameMode', lang)}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setFormat('round_robin')}
              className={`p-4 rounded-2xl border-4 border-slate-900 flex flex-col items-center gap-2 transition-all duration-200 ${
                format === 'round_robin' 
                  ? 'bg-pink-500 text-white shadow-[4px_4px_0px_#0f172a] transform -translate-y-1' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 shadow-[2px_2px_0px_#0f172a]'
              }`}
            >
              <RefreshCw className="w-8 h-8" strokeWidth={2.5} />
              <div className="text-center">
                <span className="block cartoon-title text-lg">{t('roundRobin', lang)}</span>
                <span className="block text-sm font-bold opacity-80 mt-1">{t('pairByPoints', lang)}</span>
              </div>
            </button>
            <button
              onClick={() => setFormat('knockout')}
              className={`p-4 rounded-2xl border-4 border-slate-900 flex flex-col items-center gap-2 transition-all duration-200 ${
                format === 'knockout' 
                  ? 'bg-blue-500 text-white shadow-[4px_4px_0px_#0f172a] transform -translate-y-1' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 shadow-[2px_2px_0px_#0f172a]'
              }`}
            >
              <Trophy className="w-8 h-8" strokeWidth={2.5} />
              <div className="text-center">
                <span className="block cartoon-title text-lg">{t('knockout', lang)}</span>
                <span className="block text-sm font-bold opacity-80 mt-1">{t('singleElimination', lang)}</span>
              </div>
            </button>
          </div>
          
          {format === 'round_robin' && (
            <div className="mt-6 p-4 bg-pink-50 border-4 border-pink-200 rounded-2xl flex items-center justify-between">
              <label className="font-bold text-slate-700">{t('numberOfRounds', lang)}</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setRounds(Math.max(1, rounds - 1))}
                  className="w-8 h-8 rounded-lg bg-white border-2 border-slate-900 font-bold flex items-center justify-center hover:bg-slate-100"
                >-</button>
                <span className="cartoon-title text-xl w-8 text-center">{rounds}</span>
                <button 
                  onClick={() => setRounds(rounds + 1)}
                  className="w-8 h-8 rounded-lg bg-white border-2 border-slate-900 font-bold flex items-center justify-center hover:bg-slate-100"
                >+</button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleAdd} className="flex gap-3 mb-10">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('playerNamePlaceholder', lang)}
            className="flex-1 cartoon-input"
          />
          <button 
            type="submit"
            disabled={!name.trim()}
            className="cartoon-button cartoon-button-green"
          >
            <UserPlus className="w-5 h-5" strokeWidth={3} />
            {t('add', lang)}
          </button>
        </form>

        <div className="space-y-4 mb-10">
          <div className="flex justify-between items-center mb-4 border-b-4 border-slate-900 pb-2">
            <h3 className="cartoon-title text-lg text-slate-900">{t('playerList', lang)}</h3>
            <span className="bg-slate-900 text-white font-bold px-3 py-1 rounded-full text-sm shadow-[2px_2px_0px_#94a3b8]">{players.length}</span>
          </div>
          
          {players.length === 0 ? (
            <div className="text-center py-10 bg-slate-100 rounded-2xl border-4 border-dashed border-slate-300 font-bold text-slate-400">
              {t('noPlayers', lang)}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {players.map((player, index) => (
                <li key={player.id} className="flex items-center justify-between p-3 bg-white border-4 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] hover:shadow-[4px_4px_0px_#0f172a] hover:-translate-y-1 transition-all group">
                  <span className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-slate-900">
                      {index + 1}
                    </span>
                    {player.name}
                  </span>
                  <button
                    onClick={() => handleRemove(player.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-100 p-1.5 rounded-lg border-2 border-transparent hover:border-red-500"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-center pt-6">
          <button
            onClick={handleGenerate}
            disabled={players.length < 2}
            className="cartoon-button cartoon-button-yellow text-xl px-10 py-4 w-full sm:w-auto"
          >
            <Play className="w-6 h-6" fill="currentColor" strokeWidth={2} />
            {t('letsGo', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
