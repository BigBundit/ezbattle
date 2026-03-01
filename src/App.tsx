import React, { useState, useEffect, useRef } from 'react';
import { Participant, Match, TournamentState, TournamentFormat, TournamentConfig, Category, AppState } from './types';
import Registration from './components/Registration';
import Bracket from './components/Bracket';
import Report from './components/Report';
import { Trophy, RefreshCw, Languages, Download, Upload, Plus, Trash2 } from 'lucide-react';
import { Language, t } from './i18n';

const defaultCategory = (): Category => ({
  id: crypto.randomUUID(),
  name: 'Main Event',
  players: [],
  matches: [],
  tournamentState: 'registration',
  format: 'round_robin',
  totalRounds: 1
});

export default function App() {
  const [config, setConfig] = useState<TournamentConfig>({
    name: 'EzBattle',
    numberOfCourts: 1,
    matchDuration: 30
  });
  const [categories, setCategories] = useState<Category[]>([defaultCategory()]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [lang, setLang] = useState<Language>('th');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [tempCategoryName, setTempCategoryName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tournamentData_ezbattle_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.categories && parsed.categories.length > 0) {
          setCategories(parsed.categories);
          setActiveCategoryId(parsed.activeCategoryId || parsed.categories[0].id);
        } else {
          const def = defaultCategory();
          setCategories([def]);
          setActiveCategoryId(def.id);
        }
        if (parsed.lang) setLang(parsed.lang);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    } else {
      // Migrate from old version
      const oldSaved = localStorage.getItem('tournamentData_ezbattle');
      if (oldSaved) {
        const parsed = JSON.parse(oldSaved);
        const migratedCategory: Category = {
          id: crypto.randomUUID(),
          name: 'Main Event',
          players: parsed.players || [],
          matches: parsed.matches || [],
          tournamentState: parsed.tournamentState || 'registration',
          format: parsed.format || 'round_robin',
          totalRounds: parsed.totalRounds || 1
        };
        setCategories([migratedCategory]);
        setActiveCategoryId(migratedCategory.id);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.lang) setLang(parsed.lang);
      } else {
        setActiveCategoryId(categories[0].id);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (activeCategoryId) {
      localStorage.setItem('tournamentData_ezbattle_v2', JSON.stringify({ config, categories, activeCategoryId, lang }));
    }
  }, [config, categories, activeCategoryId, lang]);

  const activeCategory = categories.find(c => c.id === activeCategoryId) || categories[0];

  const updateActiveCategory = (updates: Partial<Category>) => {
    setCategories(cats => cats.map(c => c.id === activeCategoryId ? { ...c, ...updates } : c));
  };

  const handleStartTournament = (generatedMatches: Match[], selectedFormat: TournamentFormat, rounds: number, newConfig: TournamentConfig) => {
    updateActiveCategory({
      matches: generatedMatches,
      format: selectedFormat,
      totalRounds: rounds,
      tournamentState: 'active'
    });
    setConfig(newConfig);
  };

  const handleAddMatches = (newMatches: Match[]) => {
    updateActiveCategory({
      matches: [...activeCategory.matches, ...newMatches]
    });
  };

  const handleUpdateMatch = (updatedMatch: Match) => {
    let newMatches = activeCategory.matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    
    if (activeCategory.format === 'knockout') {
      // Propagate winner
      let matchesToPropagate = [updatedMatch];
      while (matchesToPropagate.length > 0) {
        const currentMatch = matchesToPropagate.shift()!;
        if (currentMatch.winnerId && currentMatch.nextMatchId) {
          newMatches = newMatches.map(m => {
            if (m.id === currentMatch.nextMatchId) {
              const isPlayer1 = currentMatch.nextMatchSlot ? currentMatch.nextMatchSlot === 1 : currentMatch.matchOrder % 2 === 0;
              const updatedNextMatch = {
                ...m,
                player1Id: isPlayer1 ? currentMatch.winnerId : m.player1Id,
                player2Id: !isPlayer1 ? currentMatch.winnerId : m.player2Id,
              };
              // If the next match is a bye, it automatically wins
              if (updatedNextMatch.isBye && updatedNextMatch.player1Id) {
                updatedNextMatch.winnerId = updatedNextMatch.player1Id;
                matchesToPropagate.push(updatedNextMatch);
              }
              return updatedNextMatch;
            }
            return m;
          });
        }
      }
      
      let newState = activeCategory.tournamentState;
      const finalMatch = newMatches.find(m => m.nextMatchId === null);
      if (finalMatch && finalMatch.winnerId) {
        newState = 'completed';
      }
      
      updateActiveCategory({ matches: newMatches, tournamentState: newState });
    } else {
      let newState = activeCategory.tournamentState;
      const currentMaxRound = Math.max(...newMatches.map(m => m.round));
      const allCompleted = newMatches.every(m => m.isBye || (m.score1 !== '' && m.score2 !== ''));
      if (allCompleted && newMatches.length > 0 && currentMaxRound >= activeCategory.totalRounds) {
        newState = 'completed';
      }
      updateActiveCategory({ matches: newMatches, tournamentState: newState });
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    updateActiveCategory({
      players: [],
      matches: [],
      tournamentState: 'registration',
      totalRounds: 1
    });
    setShowResetConfirm(false);
  };

  const handleExport = () => {
    const data = JSON.stringify({ config, categories, activeCategoryId, lang }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ezbattle-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.categories) {
          setConfig(parsed.config || config);
          setCategories(parsed.categories);
          setActiveCategoryId(parsed.activeCategoryId || parsed.categories[0].id);
          if (parsed.lang) setLang(parsed.lang);
        }
      } catch (err) {
        console.error('Failed to parse file.', err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddCategory = () => {
    setShowAddCategoryModal(true);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      const newCat = defaultCategory();
      newCat.name = newCategoryName.trim();
      setCategories([...categories, newCat]);
      setActiveCategoryId(newCat.id);
      setNewCategoryName('');
      setShowAddCategoryModal(false);
    }
  };

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (categories.length === 1) {
      return;
    }
    setCategoryToDelete(id);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      const newCats = categories.filter(c => c.id !== categoryToDelete);
      setCategories(newCats);
      if (activeCategoryId === categoryToDelete) {
        setActiveCategoryId(newCats[0].id);
      }
      setCategoryToDelete(null);
    }
  };

  if (!activeCategory) return null;

  return (
    <div className="min-h-screen font-sans pb-12 bg-green-50 flex flex-col">
      <header className="bg-white cartoon-border border-x-0 border-t-0 sticky top-0 z-50 shadow-[0_4px_0px_#0f172a]">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-400 p-2 rounded-xl cartoon-border shadow-[2px_2px_0px_#0f172a] transform -rotate-6">
              <Trophy className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl cartoon-title text-slate-900 drop-shadow-[2px_2px_0px_#4ade80]">{config.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleExport} className="cartoon-button bg-yellow-100 hover:bg-yellow-200 text-sm py-2 px-3 shadow-[2px_2px_0px_#0f172a]" title="Export">
              <Download className="w-4 h-4" strokeWidth={3} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="cartoon-button bg-yellow-100 hover:bg-yellow-200 text-sm py-2 px-3 shadow-[2px_2px_0px_#0f172a]" title="Import">
              <Upload className="w-4 h-4" strokeWidth={3} />
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
            
            <button 
              onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
              className="cartoon-button bg-blue-100 hover:bg-blue-200 text-sm py-2 px-3 shadow-[2px_2px_0px_#0f172a]"
            >
              <Languages className="w-4 h-4" strokeWidth={3} />
              {lang === 'en' ? 'TH' : 'EN'}
            </button>
            {activeCategory.tournamentState !== 'registration' && (
              <button 
                onClick={handleReset}
                className="cartoon-button cartoon-button-pink text-sm py-2 px-4 shadow-[2px_2px_0px_#0f172a]"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={3} />
                {t('startOver', lang)}
              </button>
            )}
          </div>
        </div>
        
        {/* Categories Tab Bar */}
        <div className="bg-slate-100 border-t-2 border-slate-900 px-6 pt-3 flex items-center gap-2 overflow-x-auto">
          {categories.map(cat => (
            <div 
              key={cat.id} 
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-2 border-b-0 border-slate-900 cursor-pointer transition-colors ${activeCategoryId === cat.id ? 'bg-white font-bold text-slate-900' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`} 
              onClick={() => {
                if (activeCategoryId !== cat.id) {
                  setActiveCategoryId(cat.id);
                  setEditingCategoryId(null);
                }
              }}
            >
              {editingCategoryId === cat.id ? (
                <input
                  type="text"
                  autoFocus
                  value={tempCategoryName}
                  onChange={(e) => setTempCategoryName(e.target.value)}
                  onBlur={() => {
                    if (tempCategoryName.trim()) {
                      updateActiveCategory({ name: tempCategoryName.trim() });
                    }
                    setEditingCategoryId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (tempCategoryName.trim()) {
                        updateActiveCategory({ name: tempCategoryName.trim() });
                      }
                      setEditingCategoryId(null);
                    } else if (e.key === 'Escape') {
                      setEditingCategoryId(null);
                    }
                  }}
                  className="bg-white border-2 border-blue-500 rounded px-2 py-0.5 text-sm outline-none w-32 font-bold text-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span 
                  onClick={(e) => {
                    if (activeCategoryId === cat.id) {
                      e.stopPropagation();
                      setTempCategoryName(cat.name);
                      setEditingCategoryId(cat.id);
                    }
                  }}
                  title={lang === 'th' ? 'คลิกเพื่อแก้ไขชื่อ' : 'Click to edit name'}
                >
                  {cat.name}
                </span>
              )}
              {categories.length > 1 && (
                <button onClick={(e) => handleDeleteCategory(cat.id, e)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button onClick={handleAddCategory} className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
            <Plus className="w-4 h-4" strokeWidth={3} /> {lang === 'th' ? 'เพิ่มประเภท' : 'Add Category'}
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6 flex-1">
        <main className="flex-1 w-full lg:w-[75%]">
          {/* Stepper */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center gap-4 bg-white p-3 rounded-2xl cartoon-border shadow-[4px_4px_0px_#0f172a]">
              <Step 
                number="1"
                label={t('signUp', lang)} 
                active={activeCategory.tournamentState === 'registration'} 
                completed={activeCategory.tournamentState !== 'registration'} 
              />
              <div className="w-8 h-1 bg-slate-900 rounded-full"></div>
              <Step 
                number="2"
                label={t('play', lang)} 
                active={activeCategory.tournamentState === 'active'} 
                completed={activeCategory.tournamentState === 'completed'} 
              />
              <div className="w-8 h-1 bg-slate-900 rounded-full"></div>
              <Step 
                number="3"
                label={t('winners', lang)} 
                active={activeCategory.tournamentState === 'completed'} 
                completed={false} 
              />
            </div>
          </div>

          {activeCategory.tournamentState === 'registration' && (
            <Registration 
              players={activeCategory.players} 
              setPlayers={(players) => updateActiveCategory({ players })} 
              onStart={handleStartTournament} 
              lang={lang}
              config={config}
            />
          )}
          
          {activeCategory.tournamentState === 'active' && (
            <Bracket 
              players={activeCategory.players} 
              matches={activeCategory.matches} 
              format={activeCategory.format}
              totalRounds={activeCategory.totalRounds}
              onUpdateMatch={handleUpdateMatch} 
              onAddMatches={handleAddMatches}
              lang={lang}
              config={config}
            />
          )}

          {activeCategory.tournamentState === 'completed' && (
            <Report 
              players={activeCategory.players} 
              matches={activeCategory.matches} 
              format={activeCategory.format}
              lang={lang}
              config={config}
            />
          )}
        </main>

        {/* Advertisement Space */}
        <aside className="w-full lg:w-[25%] flex flex-col gap-4 sticky top-40 h-fit">
          <AdSlider 
            ads={[
              { src: "/ads01.png", href: "https://line.me/ti/p/OsbSG1pr0g", alt: "Advertisement 1" },
              { src: "/ads02.png", href: "https://line.me/ti/p/OsbSG1pr0g", alt: "Advertisement 2" },
              { src: "/ads03.png", alt: "Advertisement 3" }
            ]} 
          />
          <AdSlot src="/ads04.png" alt="Advertisement 4" />
          <AdSlot src="/ads05.png" alt="Advertisement 5" />
          <AdSlot src="/ads06.png" alt="Advertisement 6" />
          
          <div className="text-center mt-2 bg-white p-4 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a]">
            <p className="text-sm font-bold text-slate-700">พื้นที่สำหรับโฆษณา</p>
            <p className="text-sm font-bold text-blue-600 mt-1">ติดต่อ bigbundit@gmail.com</p>
          </div>
        </aside>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full cartoon-border shadow-[8px_8px_0px_#0f172a]">
            <h2 className="text-xl cartoon-title mb-4 text-slate-900">
              {lang === 'th' ? 'เพิ่มประเภทการแข่งขัน' : 'Add Category'}
            </h2>
            <form onSubmit={handleAddCategorySubmit}>
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น ชายเดี่ยว, หญิงคู่' : 'e.g., Men Singles'}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all mb-6"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="cartoon-button bg-blue-500 text-white px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lang === 'th' ? 'เพิ่ม' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full cartoon-border shadow-[8px_8px_0px_#0f172a]">
            <h2 className="text-xl cartoon-title mb-4 text-slate-900">
              {lang === 'th' ? 'ลบประเภทการแข่งขัน' : 'Delete Category'}
            </h2>
            <p className="text-slate-600 mb-6">
              {lang === 'th' ? 'คุณแน่ใจหรือไม่ที่จะลบประเภทการแข่งขันนี้? ข้อมูลทั้งหมดในประเภทนี้จะถูกลบ' : 'Are you sure you want to delete this category? All data in this category will be lost.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="cartoon-button bg-red-500 text-white px-6 py-2"
              >
                {lang === 'th' ? 'ลบ' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full cartoon-border shadow-[8px_8px_0px_#0f172a]">
            <h2 className="text-xl cartoon-title mb-4 text-slate-900">
              {lang === 'th' ? 'เริ่มใหม่' : 'Start Over'}
            </h2>
            <p className="text-slate-600 mb-6">
              {t('confirmReset', lang)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={confirmReset}
                className="cartoon-button bg-red-500 text-white px-6 py-2"
              >
                {lang === 'th' ? 'ตกลง' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ number, label, active, completed }: { number: string, label: string, active: boolean, completed: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 ${
      active ? 'bg-blue-500 text-white cartoon-border shadow-[2px_2px_0px_#0f172a]' : 
      completed ? 'bg-green-400 text-slate-900 cartoon-border shadow-[2px_2px_0px_#0f172a]' : 'bg-slate-100 text-slate-400'
    }`}>
      <span className="cartoon-title text-lg">{number}</span>
      <span className="font-bold text-sm uppercase tracking-wider">{label}</span>
    </div>
  );
}

function AdSlider({ ads }: { ads: { src: string, href?: string, alt: string }[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000); // Change slide every 5 seconds
    return () => clearInterval(timer);
  }, [ads.length]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] bg-white">
      <div 
        className="flex transition-transform duration-500 ease-in-out w-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {ads.map((ad, index) => (
          <div key={index} className="w-full flex-shrink-0 flex flex-col items-center justify-center">
            <AdSlot src={ad.src} href={ad.href} alt={ad.alt} isSliderItem={true} />
          </div>
        ))}
      </div>
      
      {/* Dots indicator */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-10">
        {ads.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex 
                ? 'bg-blue-500 w-4' 
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}

function AdSlot({ src, href, alt, isSliderItem = false }: { src: string, href?: string, alt: string, isSliderItem?: boolean }) {
  const [error, setError] = useState(false);

  const content = (
    <>
      {!error ? (
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-auto object-cover" 
          onError={() => setError(true)} 
        />
      ) : (
        <div className="bg-slate-200/50 p-8 flex flex-col items-center justify-center text-slate-400 min-h-[150px] w-full">
          <span className="font-bold uppercase tracking-widest text-sm mb-2 text-center">Advertisement</span>
          <p className="text-sm text-center">พื้นที่โฆษณา</p>
        </div>
      )}
    </>
  );

  const containerClasses = `w-full transition-all flex flex-col items-center justify-center ${
    isSliderItem ? '' : 'rounded-2xl overflow-hidden'
  } ${
    !error 
      ? (isSliderItem ? '' : 'border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#0f172a]')
      : (isSliderItem ? 'bg-slate-100' : 'border-2 border-dashed border-slate-300 rounded-2xl')
  }`;

  if (href && !error) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={containerClasses}>
        {content}
      </a>
    );
  }

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
}
