import React, { useState } from 'react';
import { Participant, Match, TournamentFormat, TournamentConfig } from '../types';
import { Check, Edit2, X, Search, Zap, Download, Info } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Language, t } from '../i18n';

interface Props {
  players: Participant[];
  matches: Match[];
  format: TournamentFormat;
  totalRounds: number;
  onUpdateMatch: (match: Match) => void;
  onAddMatches: (matches: Match[]) => void;
  lang: Language;
  config: TournamentConfig;
}

export default function Bracket({ players, matches, format, totalRounds, onUpdateMatch, onAddMatches, lang, config }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showRulesPopup, setShowRulesPopup] = useState(false);
  const [editingRoundTime, setEditingRoundTime] = useState<number | null>(null);
  const [tempRoundTime, setTempRoundTime] = useState<string>('');

  const getPlayerName = (id: string | null) => {
    if (!id) return 'TBD';
    return players.find(p => p.id === id)?.name || 'Unknown';
  };

  const currentMaxRound = Math.max(...matches.map(m => m.round));
  const rounds = Array.from({ length: currentMaxRound }, (_, i) => i + 1);

  // Standings calculation for Round Robin / Swiss
  const calculateStandings = () => {
    const standings = players.map(p => ({
      ...p,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0, // goals for (score)
      ga: 0, // goals against
      gd: 0, // goal difference
      points: 0
    }));

    matches.forEach(m => {
      if (m.isBye && m.player1Id) {
        const p1 = standings.find(s => s.id === m.player1Id);
        if (p1) {
          p1.played++;
          p1.won++;
          p1.points += 3;
        }
      } else if (m.score1 !== '' && m.score2 !== '') {
        const p1 = standings.find(s => s.id === m.player1Id);
        const p2 = standings.find(s => s.id === m.player2Id);
        
        if (p1 && p2) {
          p1.played++;
          p2.played++;
          
          p1.gf += Number(m.score1);
          p1.ga += Number(m.score2);
          p2.gf += Number(m.score2);
          p2.ga += Number(m.score1);

          if (m.score1 > m.score2) {
            p1.won++;
            p1.points += 3;
            p2.lost++;
          } else if (m.score1 < m.score2) {
            p2.won++;
            p2.points += 3;
            p1.lost++;
          } else {
            p1.drawn++;
            p2.drawn++;
            p1.points += 1;
            p2.points += 1;
          }
        }
      }
    });

    standings.forEach(s => s.gd = s.gf - s.ga);
    
    // Sort by points, then GD, then GF
    return standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  };

  const handleGenerateNextRound = () => {
    const standings = calculateStandings();
    const newMatches: Match[] = [];
    const availablePlayers = [...standings];
    let matchCounter = 0;

    // Handle odd players: give BYE to lowest player who hasn't had a BYE
    if (availablePlayers.length % 2 !== 0) {
      let byePlayerIndex = availablePlayers.length - 1;
      for (let i = availablePlayers.length - 1; i >= 0; i--) {
        const hasHadBye = matches.some(m => m.isBye && m.player1Id === availablePlayers[i].id);
        if (!hasHadBye) {
          byePlayerIndex = i;
          break;
        }
      }
      const byePlayer = availablePlayers.splice(byePlayerIndex, 1)[0];
      newMatches.push({
        id: `rr-r${currentMaxRound + 1}-m${matchCounter++}`,
        round: currentMaxRound + 1,
        matchOrder: matchCounter,
        player1Id: byePlayer.id,
        player2Id: null,
        score1: '', score2: '', winnerId: byePlayer.id, nextMatchId: null, isBye: true
      });
    }

    // Pair remaining players 1v2, 3v4, etc.
    for (let i = 0; i < availablePlayers.length; i += 2) {
      const p1 = availablePlayers[i];
      const p2 = availablePlayers[i+1];
      newMatches.push({
        id: `rr-r${currentMaxRound + 1}-m${matchCounter++}`,
        round: currentMaxRound + 1,
        matchOrder: matchCounter,
        player1Id: p1.id,
        player2Id: p2.id,
        score1: '', score2: '', winnerId: null, nextMatchId: null, isBye: false
      });
    }

    onAddMatches(newMatches);
  };

  const handleExportRound = async (round: number) => {
    const element = document.getElementById(`round-${round}`);
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#f8fafc', // slate-50
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.getAttribute('data-html2canvas-ignore') === 'true') {
            return false;
          }
          return true;
        }
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `tournament-round-${round}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('Failed to export image. Please try again.');
    }
  };

  const handleExportLeaderboard = async () => {
    const element = document.getElementById('leaderboard');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#f8fafc', // slate-50
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.getAttribute('data-html2canvas-ignore') === 'true') {
            return false;
          }
          return true;
        }
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `tournament-leaderboard.png`;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('Failed to export image. Please try again.');
    }
  };

  const filteredMatches = matches.filter(m => {
    if (!searchTerm) return true;
    const p1Name = getPlayerName(m.player1Id).toLowerCase();
    const p2Name = m.isBye ? 'bye' : getPlayerName(m.player2Id).toLowerCase();
    const term = searchTerm.toLowerCase();
    return p1Name.includes(term) || p2Name.includes(term);
  });

  const currentRoundMatches = matches.filter(m => m.round === currentMaxRound);
  const isCurrentRoundFinished = currentRoundMatches.every(m => m.isBye || (m.score1 !== '' && m.score2 !== ''));

  return (
    <div className="space-y-8 sm:space-y-12">
      {format === 'round_robin' && (
        <div id="leaderboard" className="cartoon-card p-4 sm:p-8 overflow-x-auto relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="cartoon-title text-xl sm:text-2xl text-slate-900 mx-auto">🏆 {t('standings', lang)}</h3>
            <button 
              onClick={handleExportLeaderboard}
              data-html2canvas-ignore="true"
              className="absolute right-4 top-4 sm:right-8 sm:top-8 p-2 bg-white border-2 border-slate-900 rounded-lg shadow-[2px_2px_0px_#0f172a] text-slate-600 hover:text-blue-600 hover:-translate-y-0.5 transition-all"
              title={t('exportImage', lang)}
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
            </button>
          </div>
          <div className="border-4 border-slate-900 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm font-bold min-w-[600px]">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-2 sm:py-3 pl-2 sm:pl-4">#</th>
                  <th className="py-2 sm:py-3">{t('player', lang)}</th>
                  <th className="py-2 sm:py-3 text-center">{t('played', lang)}</th>
                  <th className="py-2 sm:py-3 text-center text-green-400">{t('won', lang)}</th>
                  <th className="py-2 sm:py-3 text-center text-yellow-400">
                    <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setShowRulesPopup(true)}>
                      D <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2 sm:py-3 text-center text-red-400">{t('lost', lang)}</th>
                  <th className="py-2 sm:py-3 text-center">
                    <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setShowRulesPopup(true)}>
                      GF <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2 sm:py-3 text-center">
                    <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setShowRulesPopup(true)}>
                      GA <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2 sm:py-3 text-center">
                    <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setShowRulesPopup(true)}>
                      +/- <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2 sm:py-3 text-center text-yellow-400 text-sm sm:text-base">{t('points', lang)}</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {calculateStandings().map((s, idx) => (
                  <tr key={s.id} className="border-b-4 border-slate-900 last:border-b-0 hover:bg-slate-100 transition-colors">
                    <td className="py-2 sm:py-3 pl-2 sm:pl-4 text-slate-500">{idx + 1}</td>
                    <td className="py-2 sm:py-3 text-slate-900 text-sm sm:text-base">{s.name}</td>
                    <td className="py-2 sm:py-3 text-center text-slate-600">{s.played}</td>
                    <td className="py-2 sm:py-3 text-center text-green-600">{s.won}</td>
                    <td className="py-2 sm:py-3 text-center text-yellow-600">{s.drawn}</td>
                    <td className="py-2 sm:py-3 text-center text-red-600">{s.lost}</td>
                    <td className="py-2 sm:py-3 text-center text-slate-600">{s.gf}</td>
                    <td className="py-2 sm:py-3 text-center text-slate-600">{s.ga}</td>
                    <td className="py-2 sm:py-3 text-center text-blue-600">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                    <td className="py-2 sm:py-3 text-center text-slate-900 text-base sm:text-lg">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="cartoon-card p-4 sm:p-8">
        <div className="mb-6 sm:mb-8 max-w-md mx-auto flex items-center bg-white cartoon-border shadow-[4px_4px_0px_#0f172a] rounded-xl overflow-hidden px-3 sm:px-4">
          <Search className="text-slate-400 w-6 h-6 flex-shrink-0" strokeWidth={3} />
          <input 
            type="text" 
            placeholder={lang === 'th' ? 'ค้นหาผู้เล่น...' : 'Search player...'}
            className="w-full py-3 px-3 outline-none text-slate-700 font-bold bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto pb-8">
          <div className="flex gap-12 min-w-max">
            {rounds.map(round => {
              const roundMatches = filteredMatches.filter(m => m.round === round).sort((a, b) => a.matchOrder - b.matchOrder);
              if (roundMatches.length === 0) return null;
              
              return (
                <div key={round} id={`round-${round}`} className="flex flex-col justify-around gap-8 w-72 p-4 bg-slate-50 rounded-2xl relative">
                  <div className="text-center flex flex-col items-center gap-2">
                    <span className="inline-block bg-slate-900 text-white cartoon-title px-4 py-2 rounded-xl shadow-[4px_4px_0px_#3b82f6] transform -rotate-2">
                      {format === 'knockout' ? (
                        round === currentMaxRound ? `🏆 ${t('final', lang)}` : 
                        round === currentMaxRound - 1 ? `🔥 Semi-Finals` : 
                        `${t('round', lang)} ${round}`
                      ) : (
                        `${t('round', lang)} ${round}`
                      )}
                    </span>
                    
                    {/* Round Time (Editable) */}
                    {editingRoundTime === round ? (
                      <input
                        type="text"
                        autoFocus
                        value={tempRoundTime}
                        onChange={(e) => setTempRoundTime(e.target.value)}
                        onBlur={() => {
                          onUpdateMatch({
                            ...roundMatches[0],
                            customTime: tempRoundTime
                          });
                          setEditingRoundTime(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateMatch({
                              ...roundMatches[0],
                              customTime: tempRoundTime
                            });
                            setEditingRoundTime(null);
                          } else if (e.key === 'Escape') {
                            setEditingRoundTime(null);
                          }
                        }}
                        className="text-sm font-bold text-slate-700 bg-white border-2 border-slate-900 px-2 py-1 rounded-lg shadow-[2px_2px_0px_#0f172a] w-24 text-center outline-none"
                        placeholder="10:00"
                      />
                    ) : (
                      <div 
                        className="text-sm font-bold text-slate-700 bg-white border-2 border-slate-900 px-3 py-1 rounded-lg shadow-[2px_2px_0px_#0f172a] cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          setTempRoundTime(roundMatches[0]?.customTime || '');
                          setEditingRoundTime(round);
                        }}
                        title={lang === 'th' ? 'คลิกเพื่อแก้ไขเวลา' : 'Click to edit time'}
                      >
                        🕒 {roundMatches[0]?.customTime || (lang === 'th' ? 'ตั้งเวลา' : 'Set Time')}
                      </div>
                    )}

                    <button 
                      onClick={() => handleExportRound(round)}
                      data-html2canvas-ignore="true"
                      className="absolute right-2 top-2 p-2 bg-white border-2 border-slate-900 rounded-lg shadow-[2px_2px_0px_#0f172a] text-slate-600 hover:text-blue-600 hover:-translate-y-0.5 transition-all"
                      title={t('exportImage', lang)}
                    >
                      <Download className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </div>
                  {roundMatches.map((match, idx) => {
                    const courtNumber = (idx % config.numberOfCourts) + 1;
                    const timeSlot = Math.floor(idx / config.numberOfCourts);
                    const startTime = timeSlot * config.matchDuration;
                    
                    return (
                      <MatchCard 
                        key={match.id} 
                        match={match} 
                        getPlayerName={getPlayerName} 
                        onUpdateMatch={onUpdateMatch} 
                        format={format}
                        lang={lang}
                        courtNumber={courtNumber}
                        startTime={startTime}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {format === 'round_robin' && isCurrentRoundFinished && currentMaxRound < totalRounds && !searchTerm && (
          <div className="mt-8 flex justify-center">
            <button 
              onClick={handleGenerateNextRound}
              className="cartoon-button cartoon-button-yellow text-xl px-12 py-4"
            >
              <Zap className="w-6 h-6" fill="currentColor" />
              {t('generateNextRound', lang)}
            </button>
          </div>
        )}
      </div>

      {/* Rules Popup */}
      {showRulesPopup && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full cartoon-border shadow-[8px_8px_0px_#0f172a]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl cartoon-title text-slate-900">
                {lang === 'th' ? 'คำอธิบายตารางคะแนน' : 'Score Table Legend'}
              </h2>
              <button onClick={() => setShowRulesPopup(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" strokeWidth={3} />
              </button>
            </div>
            <div className="space-y-4 text-slate-700">
              <div className="flex gap-3">
                <span className="font-bold text-yellow-500 w-8">D</span>
                <span>{lang === 'th' ? 'Draw (เสมอ)' : 'Draw'}</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-slate-900 w-8">GF</span>
                <span>{lang === 'th' ? 'Goals For (คะแนนที่ได้)' : 'Goals For (Points Scored)'}</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-slate-900 w-8">GA</span>
                <span>{lang === 'th' ? 'Goals Against (คะแนนที่เสีย)' : 'Goals Against (Points Conceded)'}</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-blue-600 w-8">+/-</span>
                <span>{lang === 'th' ? 'Goal Difference (ผลต่างคะแนนได้เสีย)' : 'Goal Difference'}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRulesPopup(false)}
                className="cartoon-button bg-blue-500 text-white px-6 py-2"
              >
                {lang === 'th' ? 'เข้าใจแล้ว' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MatchCard: React.FC<{ 
  match: Match; 
  getPlayerName: (id: string | null) => string;
  onUpdateMatch: (match: Match) => void;
  format: TournamentFormat;
  lang: Language;
  courtNumber: number;
  startTime: number;
}> = ({ 
  match, 
  getPlayerName, 
  onUpdateMatch,
  format,
  lang,
  courtNumber,
  startTime
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [score1, setScore1] = useState<number | ''>(match.score1);
  const [score2, setScore2] = useState<number | ''>(match.score2);

  const isPlayable = match.player1Id && match.player2Id && !match.isBye;
  const isCompleted = format === 'knockout' ? match.winnerId !== null : (match.score1 !== '' && match.score2 !== '');

  const handleSave = () => {
    if (score1 === '' || score2 === '') {
      alert('Please enter scores for both players! 📝');
      return;
    }
    
    if (format === 'knockout' && score1 === score2) {
      alert('No ties allowed in Knockout! Someone has to win! 🥊');
      return;
    }

    let winnerId = null;
    if (score1 > score2) winnerId = match.player1Id;
    else if (score2 > score1) winnerId = match.player2Id;
    
    onUpdateMatch({
      ...match,
      score1,
      score2,
      winnerId
    });
    setIsEditing(false);
  };

  const handleWinByBye = (winnerId: string | null) => {
    if (!winnerId) return;
    
    // Set score to 0-0 but assign a winner
    onUpdateMatch({
      ...match,
      score1: winnerId === match.player1Id ? 1 : 0,
      score2: winnerId === match.player2Id ? 1 : 0,
      winnerId
    });
    setIsEditing(false);
  };

  if (match.isBye) {
    return (
      <div className="bg-slate-100 border-4 border-dashed border-slate-300 rounded-2xl p-4 opacity-70">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('bye', lang)}</div>
        <div className="font-bold text-slate-600 text-lg">{getPlayerName(match.player1Id)}</div>
      </div>
    );
  }

  return (
    <div className={`relative bg-white border-4 border-slate-900 rounded-2xl transition-all duration-200 ${
      isCompleted ? 'shadow-[4px_4px_0px_#94a3b8]' : 
      isPlayable ? 'shadow-[6px_6px_0px_#0f172a] hover:shadow-[8px_8px_0px_#0f172a] hover:-translate-y-1' : 'opacity-50 shadow-[2px_2px_0px_#0f172a]'
    }`}>
      {/* Court Info */}
      <div className="absolute -top-3 -right-3 bg-green-400 border-2 border-slate-900 px-2 py-0.5 rounded-lg font-bold text-[10px] shadow-[2px_2px_0px_#0f172a] transform rotate-3 text-slate-900 z-10">
        {t('court', lang)} {courtNumber}
      </div>

      {isEditing ? (
        <div className="p-4 pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-slate-900 truncate flex-1">{getPlayerName(match.player1Id)}</span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => handleWinByBye(match.player1Id)}
                className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border-2 border-slate-300 whitespace-nowrap"
                title={lang === 'th' ? 'ชนะบาย' : 'Win by Bye'}
              >
                {lang === 'th' ? 'บาย' : 'BYE'}
              </button>
              <input 
                type="number" 
                value={score1} 
                onChange={e => setScore1(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-20 px-2 py-1 text-center cartoon-input !shadow-[2px_2px_0px_#0f172a]"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center justify-center my-1 relative">
            <div className="absolute inset-x-0 h-0.5 bg-slate-100 rounded-full"></div>
            <span className="relative bg-white px-2 text-[10px] font-black text-slate-400 italic">{t('vs', lang)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-slate-900 truncate flex-1">{getPlayerName(match.player2Id)}</span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => handleWinByBye(match.player2Id)}
                className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border-2 border-slate-300 whitespace-nowrap"
                title={lang === 'th' ? 'ชนะบาย' : 'Win by Bye'}
              >
                {lang === 'th' ? 'บาย' : 'BYE'}
              </button>
              <input 
                type="number" 
                value={score2} 
                onChange={e => setScore2(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-20 px-2 py-1 text-center cartoon-input !shadow-[2px_2px_0px_#0f172a]"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="flex-1 cartoon-button cartoon-button-green py-2 text-sm">
              <Check className="w-4 h-4" strokeWidth={3} />
            </button>
            <button onClick={() => setIsEditing(false)} className="flex-1 cartoon-button cartoon-button-pink py-2 text-sm">
              <X className="w-4 h-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      ) : (
        <div 
          className={`p-4 pt-6 cursor-pointer group ${!isPlayable ? 'cursor-not-allowed' : ''}`}
          onClick={() => {
            if (isPlayable) {
              setScore1(match.score1);
              setScore2(match.score2);
              setIsEditing(true);
            }
          }}
        >
          <div className={`flex justify-between items-center py-1.5 ${match.winnerId === match.player1Id ? 'text-blue-600' : 'text-slate-600'}`}>
            <span className="text-base font-bold truncate pr-2">{getPlayerName(match.player1Id)}</span>
            <span className={`text-lg font-bold min-w-[2.5rem] px-1 text-center rounded-lg ${match.score1 !== '' ? 'bg-slate-100 border-2 border-slate-900' : ''}`}>
              {match.score1 !== '' ? match.score1 : '-'}
            </span>
          </div>
          <div className="flex items-center justify-center my-1 relative">
            <div className="absolute inset-x-0 h-0.5 bg-slate-100 rounded-full"></div>
            <span className="relative bg-white px-2 text-[10px] font-black text-slate-400 italic">{t('vs', lang)}</span>
          </div>
          <div className={`flex justify-between items-center py-1.5 ${match.winnerId === match.player2Id ? 'text-blue-600' : 'text-slate-600'}`}>
            <span className="text-base font-bold truncate pr-2">{getPlayerName(match.player2Id)}</span>
            <span className={`text-lg font-bold min-w-[2.5rem] px-1 text-center rounded-lg ${match.score2 !== '' ? 'bg-slate-100 border-2 border-slate-900' : ''}`}>
              {match.score2 !== '' ? match.score2 : '-'}
            </span>
          </div>
          
          {isPlayable && !isCompleted && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="bg-yellow-300 text-slate-900 font-bold px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] flex items-center gap-2 transform -rotate-3">
                <Edit2 className="w-4 h-4" strokeWidth={3} /> {t('edit', lang)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
