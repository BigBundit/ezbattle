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
          className="cartoon-button cartoon-button-blue flex items-center gap-2 px-6 py-3"
        >
          <Download className="w-5 h-5" strokeWidth={3} />
          {t('viewFinalReport', lang)}
        </button>
      </div>
      
      <div id="tournament-report" className="space-y-12 p-8 bg-slate-50 rounded-3xl">
        <div className="cartoon-card p-12 text-center bg-green-400 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-full border-4 border-slate-900 shadow-[4px_4px_0px_#0f172a] mb-6 transform -rotate-6">
            <Trophy className="w-12 h-12 text-yellow-400" strokeWidth={2.5} />
          </div>
          <h2 className="text-4xl cartoon-title text-slate-900 mb-2 drop-shadow-[2px_2px_0px_#fff]">{config.name} {t('winners', lang)}!</h2>
          <p className="text-slate-800 font-bold mb-12">{t('tournamentCompleted', lang)}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Runner Up */}
            <div className="order-2 md:order-1 flex flex-col items-center p-6 bg-white border-4 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a] transform rotate-2">
              <Medal className="w-10 h-10 text-slate-400 mb-2" strokeWidth={2.5} />
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{t('runnerUp', lang)}</div>
              <div className="text-xl cartoon-title text-slate-900">{getPlayerName(runnerUpId)}</div>
            </div>

            {/* Champion */}
            <div className="order-1 md:order-2 flex flex-col items-center p-8 bg-white border-4 border-slate-900 rounded-2xl shadow-[8px_8px_0px_#0f172a] transform md:-translate-y-6 scale-110 z-10">
              <Trophy className="w-14 h-14 text-yellow-400 mb-2" strokeWidth={2.5} />
              <div className="text-sm font-bold text-yellow-500 uppercase tracking-wider mb-2">{t('champion', lang)}</div>
              <div className="text-3xl cartoon-title text-slate-900">{getPlayerName(championId)}</div>
            </div>

            {/* Third Place */}
            <div className="order-3 flex flex-col items-center p-6 bg-white border-4 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#0f172a] transform -rotate-2">
              <Award className="w-10 h-10 text-amber-600 mb-2" strokeWidth={2.5} />
              <div className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2">{t('thirdPlace', lang)}</div>
              <div className="text-xl cartoon-title text-slate-900">{thirdPlaceCandidates.length > 0 ? thirdPlaceCandidates.map(id => getPlayerName(id)).join(' & ') : 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cartoon-card p-8 bg-white">
        <div className="flex items-center gap-3 mb-8 border-b-4 border-slate-900 pb-4">
          <History className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
          <h3 className="cartoon-title text-2xl text-slate-900">Match History</h3>
        </div>

        <div className="space-y-4">
          {playedMatches.length === 0 ? (
            <p className="text-slate-400 font-bold text-center py-8 bg-slate-100 rounded-xl border-4 border-dashed border-slate-300">No matches played yet!</p>
          ) : (
            playedMatches.sort((a, b) => b.round - a.round).map(match => {
              const isP1Winner = match.score1 > match.score2;
              const isP2Winner = match.score2 > match.score1;

              return (
                <div key={match.id} className="flex items-center justify-between p-4 bg-slate-50 border-4 border-slate-900 rounded-xl shadow-[4px_4px_0px_#0f172a] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a] transition-all">
                  <div className="flex-1 text-right">
                    <span className={`font-bold text-lg ${isP1Winner ? 'text-blue-600' : 'text-slate-500'}`}>
                      {getPlayerName(match.player1Id)}
                    </span>
                  </div>
                  
                  <div className="px-6 flex items-center gap-3">
                    <span className={`text-xl cartoon-title min-w-[3rem] px-2 py-1 text-center rounded-lg border-2 border-slate-900 ${isP1Winner ? 'bg-yellow-300 text-slate-900' : 'bg-white text-slate-600'}`}>
                      {match.score1}
                    </span>
                    <span className="text-slate-400 font-bold text-sm">{t('vs', lang)}</span>
                    <span className={`text-xl cartoon-title min-w-[3rem] px-2 py-1 text-center rounded-lg border-2 border-slate-900 ${isP2Winner ? 'bg-yellow-300 text-slate-900' : 'bg-white text-slate-600'}`}>
                      {match.score2}
                    </span>
                  </div>

                  <div className="flex-1 text-left">
                    <span className={`font-bold text-lg ${isP2Winner ? 'text-blue-600' : 'text-slate-500'}`}>
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
