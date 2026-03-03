import React, { useState } from 'react';
import { Participant, Match, TournamentFormat, TournamentConfig } from '../types';
import { Check, Edit2, X, Search, Zap, Download, Info, Trophy } from 'lucide-react';
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
        <div id="leaderboard" className="dash-card p-4 sm:p-8 overflow-x-auto relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl sm:text-2xl text-[#171717] mx-auto flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[#22c55e]" /> {t('standings', lang)}
            </h3>
            <button 
              onClick={handleExportLeaderboard}
              data-html2canvas-ignore="true"
              className="absolute right-4 top-4 sm:right-8 sm:top-8 p-2 bg-white border border-neutral-200 rounded-full shadow-sm text-neutral-500 hover:text-[#171717] hover:bg-neutral-50 transition-all"
              title={t('exportImage', lang)}
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
            </button>
          </div>
          <div className="border border-neutral-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm font-medium min-w-[600px]">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-3 sm:py-4 pl-4 sm:pl-6 font-semibold">#</th>
                  <th className="py-3 sm:py-4 font-semibold">{t('player', lang)}</th>
                  <th className="py-3 sm:py-4 text-center font-semibold">{t('played', lang)}</th>
                  <th className="py-3 sm:py-4 text-center text-[#22c55e] font-semibold">{t('won', lang)}</th>
                  <th className="py-3 sm:py-4 text-center text-yellow-500 font-semibold">
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-yellow-600" onClick={() => setShowRulesPopup(true)}>
                      D <Info className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3 sm:py-4 text-center text-red-500 font-semibold">{t('lost', lang)}</th>
                  <th className="py-3 sm:py-4 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-neutral-700" onClick={() => setShowRulesPopup(true)}>
                      GF <Info className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3 sm:py-4 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-neutral-700" onClick={() => setShowRulesPopup(true)}>
                      GA <Info className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3 sm:py-4 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-neutral-700" onClick={() => setShowRulesPopup(true)}>
                      +/- <Info className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3 sm:py-4 text-center text-[#171717] font-bold text-sm sm:text-base">{t('points', lang)}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-100">
                {calculateStandings().map((s, idx) => (
                  <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 sm:py-4 pl-4 sm:pl-6 text-neutral-400 font-medium">{idx + 1}</td>
                    <td className="py-3 sm:py-4 text-[#171717] font-semibold text-sm sm:text-base">{s.name}</td>
                    <td className="py-3 sm:py-4 text-center text-neutral-500">{s.played}</td>
                    <td className="py-3 sm:py-4 text-center text-[#22c55e] font-semibold">{s.won}</td>
                    <td className="py-3 sm:py-4 text-center text-yellow-600 font-medium">{s.drawn}</td>
                    <td className="py-3 sm:py-4 text-center text-red-500 font-medium">{s.lost}</td>
                    <td className="py-3 sm:py-4 text-center text-neutral-500">{s.gf}</td>
                    <td className="py-3 sm:py-4 text-center text-neutral-500">{s.ga}</td>
                    <td className="py-3 sm:py-4 text-center text-neutral-700 font-medium">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                    <td className="py-3 sm:py-4 text-center text-[#171717] font-bold text-base sm:text-lg">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dash-card p-4 sm:p-8">
        <div className="mb-6 sm:mb-8 w-full max-w-md mx-auto flex items-center bg-neutral-50 border border-neutral-200 rounded-full overflow-hidden px-4 focus-within:border-[#22c55e] focus-within:ring-4 focus-within:ring-[#22c55e]/10 transition-all">
          <Search className="text-neutral-400 w-5 h-5 flex-shrink-0" strokeWidth={2} />
          <input 
            type="text" 
            placeholder={lang === 'th' ? 'ค้นหาผู้เล่น...' : 'Search player...'}
            className="w-full py-3 px-3 outline-none text-[#171717] font-medium bg-transparent placeholder-neutral-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 sm:gap-8 min-w-max">
            {rounds.map(round => {
              const roundMatches = filteredMatches.filter(m => m.round === round).sort((a, b) => a.matchOrder - b.matchOrder);
              if (roundMatches.length === 0) return null;
              
              return (
                <div key={round} id={`round-${round}`} className="flex flex-col justify-start gap-4 sm:gap-6 w-[260px] sm:w-72 p-4 sm:p-5 bg-neutral-50 rounded-3xl border border-neutral-100 relative">
                  <div className="text-center flex flex-col items-center gap-3 mb-2">
                    <span className="inline-block bg-[#171717] text-white font-bold px-4 py-1.5 rounded-full text-sm shadow-sm">
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
                        className="text-sm font-medium text-[#171717] bg-white border border-[#22c55e] px-3 py-1 rounded-full shadow-sm w-24 text-center outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                        placeholder="10:00"
                      />
                    ) : (
                      <div 
                        className="text-sm font-medium text-neutral-500 bg-white border border-neutral-200 px-3 py-1 rounded-full shadow-sm cursor-pointer hover:bg-neutral-50 hover:text-[#171717] transition-colors flex items-center gap-1.5"
                        onClick={() => {
                          setTempRoundTime(roundMatches[0]?.customTime || '');
                          setEditingRoundTime(round);
                        }}
                        title={lang === 'th' ? 'คลิกเพื่อแก้ไขเวลา' : 'Click to edit time'}
                      >
                        <span className="text-xs">🕒</span> {roundMatches[0]?.customTime || (lang === 'th' ? 'ตั้งเวลา' : 'Set Time')}
                      </div>
                    )}

                    <button 
                      onClick={() => handleExportRound(round)}
                      data-html2canvas-ignore="true"
                      className="absolute right-3 top-3 p-2 bg-white border border-neutral-200 rounded-full shadow-sm text-neutral-400 hover:text-[#171717] hover:bg-neutral-50 transition-all"
                      title={t('exportImage', lang)}
                    >
                      <Download className="w-4 h-4" strokeWidth={2} />
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
              className="dash-button bg-[#171717] hover:bg-[#22c55e] text-base px-8 py-3 w-full sm:w-auto"
            >
              <Zap className="w-5 h-5" fill="currentColor" />
              {t('generateNextRound', lang)}
            </button>
          </div>
        )}
      </div>

      {/* Rules Popup */}
      {showRulesPopup && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="dash-card p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#171717]">
                {lang === 'th' ? 'คำอธิบายตารางคะแนน' : 'Score Table Legend'}
              </h2>
              <button onClick={() => setShowRulesPopup(false)} className="text-neutral-400 hover:text-neutral-600 p-1 rounded-full hover:bg-neutral-100 transition-colors">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="space-y-4 text-neutral-600 text-sm">
              <div className="flex gap-3 items-center">
                <span className="font-bold text-yellow-500 w-8 text-center bg-yellow-50 rounded py-1">D</span>
                <span>{lang === 'th' ? 'Draw (เสมอ)' : 'Draw'}</span>
              </div>
              <div className="flex gap-3 items-center">
                <span className="font-bold text-[#171717] w-8 text-center bg-neutral-100 rounded py-1">GF</span>
                <span>{lang === 'th' ? 'Goals For (คะแนนที่ได้)' : 'Goals For (Points Scored)'}</span>
              </div>
              <div className="flex gap-3 items-center">
                <span className="font-bold text-[#171717] w-8 text-center bg-neutral-100 rounded py-1">GA</span>
                <span>{lang === 'th' ? 'Goals Against (คะแนนที่เสีย)' : 'Goals Against (Points Conceded)'}</span>
              </div>
              <div className="flex gap-3 items-center">
                <span className="font-bold text-neutral-500 w-8 text-center bg-neutral-50 rounded py-1">+/-</span>
                <span>{lang === 'th' ? 'Goal Difference (ผลต่างคะแนนได้เสีย)' : 'Goal Difference'}</span>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setShowRulesPopup(false)}
                className="dash-button"
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
      <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl p-4 opacity-70 flex flex-col items-center justify-center min-h-[100px]">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{t('bye', lang)}</div>
        <div className="font-semibold text-neutral-600 text-sm text-center">{getPlayerName(match.player1Id)}</div>
      </div>
    );
  }

  return (
    <div className={`relative bg-white border border-neutral-200 rounded-2xl transition-all duration-200 ${
      isCompleted ? 'shadow-sm opacity-80' : 
      isPlayable ? 'shadow-sm hover:shadow-md hover:-translate-y-0.5' : 'opacity-50'
    }`}>
      {/* Court Info */}
      <div className="absolute -top-3 -right-2 bg-[#22c55e] text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm z-10 tracking-wide">
        {t('court', lang)} {courtNumber}
      </div>

      {isEditing ? (
        <div className="p-3 sm:p-4 pt-4 sm:pt-5 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-semibold text-[#171717] truncate flex-1">{getPlayerName(match.player1Id)}</span>
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <button 
                onClick={() => handleWinByBye(match.player1Id)}
                className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-1.5 sm:px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                title={lang === 'th' ? 'ชนะบาย' : 'Win by Bye'}
              >
                {lang === 'th' ? 'บาย' : 'BYE'}
              </button>
              <input 
                type="number" 
                value={score1} 
                onChange={e => setScore1(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 text-center dash-input !rounded-lg text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center justify-center my-1 relative">
            <div className="absolute inset-x-0 h-[1px] bg-neutral-100"></div>
            <span className="relative bg-white px-2 text-[10px] font-bold text-neutral-300 uppercase tracking-widest">{t('vs', lang)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-semibold text-[#171717] truncate flex-1">{getPlayerName(match.player2Id)}</span>
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <button 
                onClick={() => handleWinByBye(match.player2Id)}
                className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-1.5 sm:px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                title={lang === 'th' ? 'ชนะบาย' : 'Win by Bye'}
              >
                {lang === 'th' ? 'บาย' : 'BYE'}
              </button>
              <input 
                type="number" 
                value={score2} 
                onChange={e => setScore2(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 text-center dash-input !rounded-lg text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-2 border-t border-neutral-100">
            <button onClick={handleSave} className="flex-1 dash-button bg-[#22c55e] hover:bg-[#16a34a] py-2">
              <Check className="w-4 h-4" strokeWidth={2} />
            </button>
            <button onClick={() => setIsEditing(false)} className="flex-1 dash-button bg-neutral-100 hover:bg-neutral-200 text-neutral-600 py-2">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div 
          className={`p-3 sm:p-4 pt-4 sm:pt-5 cursor-pointer group ${!isPlayable ? 'cursor-not-allowed' : ''}`}
          onClick={() => {
            if (isPlayable) {
              setScore1(match.score1);
              setScore2(match.score2);
              setIsEditing(true);
            }
          }}
        >
          <div className={`flex justify-between items-center py-1.5 ${match.winnerId === match.player1Id ? 'text-[#22c55e]' : 'text-neutral-600'}`}>
            <span className={`text-xs sm:text-sm font-semibold truncate pr-2 ${match.winnerId === match.player1Id ? 'text-[#171717]' : ''}`}>{getPlayerName(match.player1Id)}</span>
            <span className={`text-sm sm:text-base font-bold min-w-[2rem] sm:min-w-[2.5rem] px-1.5 py-0.5 text-center rounded-lg ${match.score1 !== '' ? 'bg-neutral-50 text-[#171717]' : 'text-neutral-300'}`}>
              {match.score1 !== '' ? match.score1 : '-'}
            </span>
          </div>
          <div className="flex items-center justify-center my-1.5 relative">
            <div className="absolute inset-x-0 h-[1px] bg-neutral-100"></div>
            <span className="relative bg-white px-2 text-[10px] font-bold text-neutral-300 uppercase tracking-widest">{t('vs', lang)}</span>
          </div>
          <div className={`flex justify-between items-center py-1.5 ${match.winnerId === match.player2Id ? 'text-[#22c55e]' : 'text-neutral-600'}`}>
            <span className={`text-xs sm:text-sm font-semibold truncate pr-2 ${match.winnerId === match.player2Id ? 'text-[#171717]' : ''}`}>{getPlayerName(match.player2Id)}</span>
            <span className={`text-sm sm:text-base font-bold min-w-[2rem] sm:min-w-[2.5rem] px-1.5 py-0.5 text-center rounded-lg ${match.score2 !== '' ? 'bg-neutral-50 text-[#171717]' : 'text-neutral-300'}`}>
              {match.score2 !== '' ? match.score2 : '-'}
            </span>
          </div>
          
          {isPlayable && !isCompleted && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="bg-[#171717] text-white font-medium px-4 py-2 rounded-full text-sm shadow-md flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5" strokeWidth={2} /> {t('edit', lang)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
