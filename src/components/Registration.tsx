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
    
    const newNames = name
      .split(/\r?\n|\t|,/) // Split by newline, tab, or comma
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (newNames.length === 0) return;

    const newPlayers: Participant[] = newNames.map((n, index) => ({
      id: `p_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      name: n
    }));
    
    setPlayers([...players, ...newPlayers]);
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
    <div className="max-w-2xl mx-auto dash-card">
      <div className="p-8 border-b border-neutral-800 bg-[#171717] rounded-t-[1.5rem] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '16px 16px' }}></div>
        <h2 className="text-3xl font-bold text-white tracking-tight relative z-10">{t('whosPlaying', lang)}</h2>
        <p className="text-neutral-400 font-medium mt-2 relative z-10">{t('addFriends', lang)}</p>
      </div>

      <div className="p-8 bg-white rounded-b-[1.5rem]">
        {/* Tournament Settings */}
        <div className="mb-10 p-6 bg-neutral-50 border border-neutral-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-neutral-500" />
            <h3 className="font-bold text-lg text-[#171717]">Tournament Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-sm text-neutral-600 mb-1.5">{t('tournamentName', lang)}</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="dash-input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-sm text-neutral-600 mb-1.5">{t('numberOfCourts', lang)}</label>
                <input
                  type="number"
                  min="1"
                  value={config.numberOfCourts}
                  onChange={(e) => setConfig({ ...config, numberOfCourts: parseInt(e.target.value) || 1 })}
                  className="dash-input"
                />
              </div>
              <div>
                <label className="block font-medium text-sm text-neutral-600 mb-1.5">{t('matchDuration', lang)}</label>
                <input
                  type="number"
                  min="1"
                  value={config.matchDuration}
                  onChange={(e) => setConfig({ ...config, matchDuration: parseInt(e.target.value) || 30 })}
                  className="dash-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-10">
          <h3 className="font-bold text-lg mb-4 text-center text-[#171717]">{t('chooseGameMode', lang)}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setFormat('round_robin')}
              className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-200 ${
                format === 'round_robin' 
                  ? 'bg-[#171717] text-white border-[#171717] shadow-md' 
                  : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <RefreshCw className="w-7 h-7" strokeWidth={2} />
              <div className="text-center">
                <span className="block font-bold text-lg">{t('roundRobin', lang)}</span>
                <span className={`block text-xs font-medium mt-1 ${format === 'round_robin' ? 'text-neutral-400' : 'text-neutral-400'}`}>{t('pairByPoints', lang)}</span>
              </div>
            </button>
            <button
              onClick={() => setFormat('knockout')}
              className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-200 ${
                format === 'knockout' 
                  ? 'bg-[#171717] text-white border-[#171717] shadow-md' 
                  : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Trophy className="w-7 h-7" strokeWidth={2} />
              <div className="text-center">
                <span className="block font-bold text-lg">{t('knockout', lang)}</span>
                <span className={`block text-xs font-medium mt-1 ${format === 'knockout' ? 'text-neutral-400' : 'text-neutral-400'}`}>{t('singleElimination', lang)}</span>
              </div>
            </button>
          </div>
          
          {format === 'round_robin' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
              <label className="font-medium text-green-800">{t('numberOfRounds', lang)}</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setRounds(Math.max(1, rounds - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-green-200 text-green-700 font-bold flex items-center justify-center hover:bg-green-100 transition-colors"
                >-</button>
                <span className="font-bold text-xl w-8 text-center text-green-900">{rounds}</span>
                <button 
                  onClick={() => setRounds(rounds + 1)}
                  className="w-8 h-8 rounded-full bg-white border border-green-200 text-green-700 font-bold flex items-center justify-center hover:bg-green-100 transition-colors"
                >+</button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10 items-start">
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAdd(e);
              }
            }}
            placeholder={t('playerNamePlaceholder', lang)}
            className="flex-1 dash-input min-h-[50px] resize-y py-3"
            rows={2}
          />
          <button 
            type="submit"
            disabled={!name.trim()}
            className="dash-button bg-[#22c55e] hover:bg-[#16a34a] w-full sm:w-auto h-[50px] px-6"
          >
            <UserPlus className="w-4 h-4" strokeWidth={2} />
            {t('add', lang)}
          </button>
        </form>

        <div className="space-y-4 mb-10">
          <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
            <h3 className="font-bold text-lg text-[#171717]">{t('playerList', lang)}</h3>
            <span className="bg-[#171717] text-white font-medium px-3 py-0.5 rounded-full text-xs">{players.length}</span>
          </div>
          
          {players.length === 0 ? (
            <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 font-medium text-neutral-400">
              {t('noPlayers', lang)}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {players.map((player, index) => (
                <li key={player.id} className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="font-medium text-[#171717] flex items-center gap-3">
                    <span className="bg-neutral-100 text-neutral-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    {player.name}
                  </span>
                  <button
                    onClick={() => handleRemove(player.id)}
                    className="text-neutral-400 hover:text-red-500 transition-colors bg-neutral-50 hover:bg-red-50 p-1.5 rounded-full"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={handleGenerate}
            disabled={players.length < 2}
            className="dash-button bg-[#171717] hover:bg-[#22c55e] text-base px-10 py-3.5 w-full sm:w-auto"
          >
            <Play className="w-5 h-5" fill="currentColor" strokeWidth={2} />
            {t('letsGo', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
