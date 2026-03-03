import React from 'react';
import { Participant, Match, TournamentFormat, TournamentConfig } from '../types';
import { Trophy, Medal, Award, History, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Language, t } from '../i18n';

interface Props {
  players: Participant[];
  matches: Match[];
  format: TournamentFormat;
  lang: Language;
  config: TournamentConfig;
}

export default function Report({ players, matches, format, lang, config }: Props) {
  const getPlayerName = (id: string | null) => {
    if (!id) return 'Unknown';
    return players.find(p => p.id === id)?.name || 'Unknown';
  };

  const calculateStandings = () => {
    const standings = players.map(p => ({
      ...p,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0
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
          p1.played++; p2.played++;
          p1.gf += Number(m.score1); p1.ga += Number(m.score2);
          p2.gf += Number(m.score2); p2.ga += Number(m.score1);

          if (m.score1 > m.score2) { p1.won++; p1.points += 3; p2.lost++; }
          else if (m.score1 < m.score2) { p2.won++; p2.points += 3; p1.lost++; }
          else { p1.drawn++; p2.drawn++; p1.points += 1; p2.points += 1; }
        }
      }
    });

    standings.forEach(s => s.gd = s.gf - s.ga);
    return standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  };

  let championId: string | null = null;
  let runnerUpId: string | null = null;
  let thirdPlaceCandidates: string[] = [];

  if (format === 'knockout') {
    const finalMatch = matches.find(m => m.nextMatchId === null);
    championId = finalMatch?.winnerId || null;
    runnerUpId = finalMatch?.winnerId === finalMatch?.player1Id ? finalMatch?.player2Id : finalMatch?.player1Id;

    const totalRounds = Math.max(...matches.map(m => m.round));
    const semiFinalMatches = matches.filter(m => m.round === totalRounds - 1);
    thirdPlaceCandidates = semiFinalMatches.map(m => 
      m.winnerId === m.player1Id ? m.player2Id : m.player1Id
    ).filter(Boolean) as string[];
  } else {
    const standings = calculateStandings();
    if (standings.length > 0) championId = standings[0].id;
    if (standings.length > 1) runnerUpId = standings[1].id;
    if (standings.length > 2) thirdPlaceCandidates = [standings[2].id];
  }

  const playedMatches = matches.filter(m => !m.isBye && m.score1 !== '' && m.score2 !== '');
  const totalRounds = Math.max(...matches.map(m => m.round));

  const handleExportReport = async () => {
    const element = document.getElementById('tournament-report');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#f8fafc', // slate-50
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `tournament-report.png`;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('Failed to export image. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex justify-end mb-4">
        <button 
          onClick={handleExportReport}
          className="dash-button bg-[#171717] hover:bg-[#22c55e] flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto"
        >
          <Download className="w-5 h-5" strokeWidth={2} />
          {t('viewFinalReport', lang)}
        </button>
      </div>
      
      <div id="tournament-report" className="space-y-6 sm:space-y-12 p-3 sm:p-8 bg-white rounded-3xl border border-neutral-200">
        <div className="dash-card p-6 sm:p-12 text-center bg-gradient-to-br from-[#22c55e] to-[#16a34a] relative overflow-hidden border-none shadow-lg">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full shadow-md mb-6 transform -rotate-3">
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" strokeWidth={2} />
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 drop-shadow-sm">{config.name} {t('winners', lang)}!</h2>
            <p className="text-green-50 font-medium mb-8 sm:mb-12 text-lg">{t('tournamentCompleted', lang)}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Runner Up */}
              <div className="order-2 md:order-1 flex flex-col items-center p-4 sm:p-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm transform md:rotate-1 border border-white/20">
                <Medal className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-400 mb-3" strokeWidth={2} />
                <div className="text-xs sm:text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">{t('runnerUp', lang)}</div>
                <div className="text-lg sm:text-xl font-bold text-[#171717]">{getPlayerName(runnerUpId)}</div>
              </div>

              {/* Champion */}
              <div className="order-1 md:order-2 flex flex-col items-center p-6 sm:p-8 bg-white rounded-2xl shadow-xl transform md:-translate-y-4 md:scale-105 z-10 border-2 border-yellow-400/20">
                <Trophy className="w-12 h-12 sm:w-14 sm:h-14 text-yellow-500 mb-3" strokeWidth={2} />
                <div className="text-xs sm:text-sm font-bold text-yellow-500 uppercase tracking-widest mb-2">{t('champion', lang)}</div>
                <div className="text-2xl sm:text-3xl font-black text-[#171717]">{getPlayerName(championId)}</div>
              </div>

              {/* Third Place */}
              <div className="order-3 flex flex-col items-center p-4 sm:p-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm transform md:-rotate-1 border border-white/20">
                <Award className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600 mb-3" strokeWidth={2} />
                <div className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-widest mb-2">{t('thirdPlace', lang)}</div>
                <div className="text-lg sm:text-xl font-bold text-[#171717]">{thirdPlaceCandidates.length > 0 ? thirdPlaceCandidates.map(id => getPlayerName(id)).join(' & ') : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

      <div className="dash-card p-4 sm:p-8 bg-white">
        <div className="flex items-center gap-3 mb-6 sm:mb-8 border-b border-neutral-100 pb-4">
          <History className="w-5 h-5 sm:w-6 sm:h-6 text-[#171717]" strokeWidth={2} />
          <h3 className="font-bold text-xl sm:text-2xl text-[#171717]">Match History</h3>
        </div>

        <div className="space-y-4">
          {playedMatches.length === 0 ? (
            <p className="text-neutral-400 font-medium text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">No matches played yet!</p>
          ) : (
            playedMatches.sort((a, b) => b.round - a.round).map(match => {
              const isP1Winner = match.score1 > match.score2;
              const isP2Winner = match.score2 > match.score1;

              return (
                <div key={match.id} className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 bg-white border border-neutral-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all gap-4 sm:gap-0">
                  <div className="w-full sm:flex-1 text-center sm:text-right">
                    <span className={`font-semibold text-base sm:text-lg ${isP1Winner ? 'text-[#22c55e]' : 'text-neutral-600'}`}>
                      {getPlayerName(match.player1Id)}
                    </span>
                  </div>
                  
                  <div className="px-4 sm:px-8 flex items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <span className={`text-lg sm:text-xl font-bold min-w-[3rem] px-3 py-1.5 text-center rounded-xl ${isP1Winner ? 'bg-[#22c55e]/10 text-[#16a34a]' : 'bg-neutral-50 text-neutral-600'}`}>
                      {match.score1}
                    </span>
                    <span className="text-neutral-300 font-bold text-xs sm:text-sm uppercase tracking-widest">{t('vs', lang)}</span>
                    <span className={`text-lg sm:text-xl font-bold min-w-[3rem] px-3 py-1.5 text-center rounded-xl ${isP2Winner ? 'bg-[#22c55e]/10 text-[#16a34a]' : 'bg-neutral-50 text-neutral-600'}`}>
                      {match.score2}
                    </span>
                  </div>

                  <div className="w-full sm:flex-1 text-center sm:text-left">
                    <span className={`font-semibold text-base sm:text-lg ${isP2Winner ? 'text-[#22c55e]' : 'text-neutral-600'}`}>
                      {getPlayerName(match.player2Id)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
