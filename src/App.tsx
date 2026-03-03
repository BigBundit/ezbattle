import React, { useState, useEffect, useRef } from 'react';
import { Participant, Match, TournamentState, TournamentFormat, TournamentConfig, Category, AppState } from './types';
import Registration from './components/Registration';
import Bracket from './components/Bracket';
import Report from './components/Report';
import { Trophy, RefreshCw, Languages, Download, Upload, Plus, Trash2, Users, Menu, X, Settings, LayoutDashboard } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [tempCategoryName, setTempCategoryName] = useState<string>('');
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    // Visitor counter logic using external API
    const fetchVisitorCount = async () => {
      try {
        // We use countapi.xyz alternative (counterapi.dev) but we need to fetch it from the client
        // To avoid double counting on strict mode, we check session storage
        if (!sessionStorage.getItem('ezbattle_visited_api')) {
          const response = await fetch('https://api.counterapi.dev/v1/ezbattle_app_v2/visits/up');
          const data = await response.json();
          setVisitorCount(data.count + 12458); // Add base count
          sessionStorage.setItem('ezbattle_visited_api', 'true');
        } else {
          const response = await fetch('https://api.counterapi.dev/v1/ezbattle_app_v2/visits');
          const data = await response.json();
          setVisitorCount(data.count + 12458); // Add base count
        }
      } catch (error) {
        // Fallback to local storage if API fails
        const storedVisitors = localStorage.getItem('ezbattle_visitors');
        let currentVisitors = storedVisitors ? parseInt(storedVisitors, 10) : 12458;
        if (!sessionStorage.getItem('ezbattle_visited')) {
          currentVisitors += 1;
          localStorage.setItem('ezbattle_visitors', currentVisitors.toString());
          sessionStorage.setItem('ezbattle_visited', 'true');
        }
        setVisitorCount(currentVisitors);
      }
    };

    fetchVisitorCount();

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
    <div className="w-full max-w-[1600px] min-h-screen sm:min-h-[90vh] bg-[#f8faf9] sm:rounded-[2.5rem] shadow-none sm:shadow-2xl overflow-hidden flex flex-col relative sm:border border-white/60" style={{ backgroundImage: 'radial-gradient(circle at top left, #e6f2eb 0%, #f8faf9 100%)' }}>
      <header className="px-4 sm:px-10 py-4 sm:py-6 flex items-center justify-between z-50 relative">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-[#171717] shadow-sm border border-neutral-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-[#22c55e]" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">{config.name}</h1>
          </div>
        </div>
        
        {/* Desktop Actions - Pill Navigation Style */}
        <div className="hidden sm:flex items-center bg-white rounded-full p-1.5 shadow-sm border border-neutral-100">
          <div className="flex items-center gap-1 px-2">
            {categories.map(cat => (
              <div 
                key={cat.id} 
                className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all whitespace-nowrap text-sm font-medium ${activeCategoryId === cat.id ? 'bg-[#171717] text-white shadow-md' : 'bg-transparent text-neutral-600 hover:bg-neutral-50'}`} 
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
                    className="bg-white border border-[#22c55e] rounded-full px-3 py-0.5 text-sm outline-none w-24 sm:w-32 font-medium text-[#171717] focus:ring-2 focus:ring-[#22c55e]/20"
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
                    className="text-sm"
                  >
                    {cat.name}
                  </span>
                )}
                {categories.length > 1 && (
                  <button onClick={(e) => handleDeleteCategory(cat.id, e)} className={`${activeCategoryId === cat.id ? 'text-neutral-400 hover:text-red-400' : 'text-neutral-400 hover:text-red-500'} transition-colors ml-1 p-0.5`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={handleAddCategory} className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-[#22c55e] hover:bg-green-100 transition-colors ml-1" title={lang === 'th' ? 'เพิ่มประเภท' : 'Add Category'}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <div className="bg-white rounded-full p-1.5 shadow-sm border border-neutral-100 flex items-center">
            <button onClick={handleExport} className="p-2 text-neutral-600 hover:text-[#171717] hover:bg-neutral-50 rounded-full transition-colors" title="Export">
              <Download className="w-5 h-5" strokeWidth={2} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-neutral-600 hover:text-[#171717] hover:bg-neutral-50 rounded-full transition-colors" title="Import">
              <Upload className="w-5 h-5" strokeWidth={2} />
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
            <div className="w-[1px] h-5 bg-neutral-200 mx-1"></div>
            <button 
              onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
              className="p-2 text-neutral-600 hover:text-[#171717] hover:bg-neutral-50 rounded-full transition-colors flex items-center gap-1 font-medium text-sm"
            >
              <Languages className="w-4 h-4" strokeWidth={2} />
              {lang === 'en' ? 'TH' : 'EN'}
            </button>
          </div>
          
          {activeCategory.tournamentState !== 'registration' && (
            <button 
              onClick={handleReset}
              className="bg-white border border-red-100 text-red-500 hover:bg-red-50 p-2.5 rounded-full shadow-sm transition-colors"
              title={t('startOver', lang)}
            >
              <RefreshCw className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="sm:hidden p-2.5 bg-white text-neutral-600 shadow-sm border border-neutral-100 rounded-full transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden bg-white/95 backdrop-blur-md px-4 py-6 flex flex-col gap-4 absolute w-full left-0 top-full z-40 border-b border-neutral-100 shadow-lg">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{lang === 'th' ? 'ประเภทการแข่งขัน' : 'Categories'}</span>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <div 
                    key={cat.id} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all text-sm font-medium ${activeCategoryId === cat.id ? 'bg-[#171717] text-white shadow-md' : 'bg-neutral-50 text-neutral-600 border border-neutral-200'}`} 
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {cat.name}
                  </div>
                ))}
                <button onClick={() => { handleAddCategory(); setIsMobileMenuOpen(false); }} className="flex items-center justify-center px-4 py-2 rounded-full bg-green-50 text-[#22c55e] border border-green-100 text-sm font-medium">
                  <Plus className="w-4 h-4 mr-1" /> {lang === 'th' ? 'เพิ่ม' : 'Add'}
                </button>
              </div>
            </div>

            <div className="w-full h-[1px] bg-neutral-100 my-2"></div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{lang === 'th' ? 'จัดการข้อมูล' : 'Data Management'}</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { handleExport(); setIsMobileMenuOpen(false); }} className="dash-button dash-button-outline py-2.5" title="Export">
                  <Download className="w-4 h-4" strokeWidth={2} /> {lang === 'th' ? 'ส่งออก' : 'Export'}
                </button>
                <button onClick={() => { fileInputRef.current?.click(); setIsMobileMenuOpen(false); }} className="dash-button dash-button-outline py-2.5" title="Import">
                  <Upload className="w-4 h-4" strokeWidth={2} /> {lang === 'th' ? 'นำเข้า' : 'Import'}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{lang === 'th' ? 'ตั้งค่า' : 'Settings'}</span>
              <button 
                onClick={() => { setLang(lang === 'en' ? 'th' : 'en'); setIsMobileMenuOpen(false); }}
                className="dash-button dash-button-outline py-2.5 w-full"
              >
                <Languages className="w-4 h-4" strokeWidth={2} />
                {lang === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
              </button>
            </div>

            {activeCategory.tournamentState !== 'registration' && (
              <button 
                onClick={() => { handleReset(); setIsMobileMenuOpen(false); }}
                className="dash-button bg-red-50 hover:bg-red-100 text-red-600 w-full py-2.5 mt-2 border border-red-100"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={2} />
                <span>{t('startOver', lang)}</span>
              </button>
            )}
          </div>
        )}
      </header>

      <div className="px-4 sm:px-10 pb-10 flex flex-col lg:flex-row gap-6 sm:gap-8 flex-1 overflow-y-auto">
        <main className="flex-1 w-full lg:w-[75%] flex flex-col">
          {/* Welcome Header */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#171717] mb-1 sm:mb-2 tracking-tight">
              {activeCategory.tournamentState === 'registration' ? (lang === 'th' ? 'ยินดีต้อนรับสู่ EzBattle' : 'Welcome to EzBattle') : 
               activeCategory.tournamentState === 'active' ? (lang === 'th' ? 'กำลังแข่งขัน' : 'Tournament in Progress') :
               (lang === 'th' ? 'สรุปผลการแข่งขัน' : 'Tournament Results')}
            </h2>
            <p className="text-neutral-500 font-medium">
              {activeCategory.name} • {activeCategory.players.length} {lang === 'th' ? 'ผู้เล่น' : 'Players'}
            </p>
          </div>

          {/* Stepper */}
          <div className="flex mb-8 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 bg-white/60 p-1.5 rounded-full border border-white shadow-sm">
              <Step 
                number="1"
                label={t('signUp', lang)} 
                active={activeCategory.tournamentState === 'registration'} 
                completed={activeCategory.tournamentState !== 'registration'} 
              />
              <div className="w-4 sm:w-8 h-[2px] bg-neutral-200/60 rounded-full shrink-0"></div>
              <Step 
                number="2"
                label={t('play', lang)} 
                active={activeCategory.tournamentState === 'active'} 
                completed={activeCategory.tournamentState === 'completed'} 
              />
              <div className="w-4 sm:w-8 h-[2px] bg-neutral-200/60 rounded-full shrink-0"></div>
              <Step 
                number="3"
                label={t('winners', lang)} 
                active={activeCategory.tournamentState === 'completed'} 
                completed={false} 
              />
            </div>
          </div>

          <div className="flex-1">
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
          </div>
        </main>

        {/* Advertisement Space */}
        <aside className="w-full lg:w-[25%] flex flex-col gap-4">
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
          
          <div className="text-center mt-2 bg-white/60 p-5 rounded-3xl border border-white shadow-sm backdrop-blur-sm">
            <p className="text-sm font-medium text-neutral-500">พื้นที่สำหรับโฆษณา</p>
            <p className="text-sm font-semibold text-[#22c55e] mt-1">ติดต่อ bigbundit@gmail.com</p>
          </div>
        </aside>
      </div>

      {/* Footer / Visitor Counter */}
      <footer className="w-full py-4 mt-auto text-center text-neutral-400 text-sm flex flex-col items-center justify-center border-t border-white/40 bg-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <Users className="w-4 h-4" />
          <span className="font-medium">{t('visitors', lang)}: {visitorCount.toLocaleString()}</span>
        </div>
      </footer>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="dash-card p-6 sm:p-8 max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-[#171717] tracking-tight">
              {lang === 'th' ? 'เพิ่มประเภทการแข่งขัน' : 'Add Category'}
            </h2>
            <form onSubmit={handleAddCategorySubmit}>
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น ชายเดี่ยว, หญิงคู่' : 'e.g., Men Singles'}
                className="dash-input mb-6 sm:mb-8"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="dash-button dash-button-outline px-4 sm:px-6"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="dash-button px-6 sm:px-8"
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
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="dash-card p-6 sm:p-8 max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#171717] tracking-tight">
              {lang === 'th' ? 'ลบประเภทการแข่งขัน' : 'Delete Category'}
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed">
              {lang === 'th' ? 'คุณแน่ใจหรือไม่ที่จะลบประเภทการแข่งขันนี้? ข้อมูลทั้งหมดในประเภทนี้จะถูกลบ' : 'Are you sure you want to delete this category? All data in this category will be lost.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="dash-button dash-button-outline px-4 sm:px-6"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="dash-button bg-red-500 hover:bg-red-600 px-6 sm:px-8"
              >
                {lang === 'th' ? 'ลบ' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="dash-card p-6 sm:p-8 max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#171717] tracking-tight">
              {lang === 'th' ? 'เริ่มใหม่' : 'Start Over'}
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed">
              {t('confirmReset', lang)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="dash-button dash-button-outline px-4 sm:px-6"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={confirmReset}
                className="dash-button bg-red-500 hover:bg-red-600 px-6 sm:px-8"
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
    <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-300 ${
      active ? 'bg-[#171717] text-white shadow-md' : 
      completed ? 'bg-[#22c55e] text-white shadow-sm' : 'bg-neutral-50 text-neutral-400'
    }`}>
      <span className="font-bold text-sm sm:text-base">{number}</span>
      <span className="font-medium text-xs sm:text-sm tracking-wide whitespace-nowrap">{label}</span>
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
    <div className="relative w-full rounded-3xl overflow-hidden dash-card border-none">
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
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
        {ads.map((_, index) => (
          <button
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              index === currentIndex 
                ? 'bg-[#22c55e] w-4' 
                : 'bg-white/60 hover:bg-white'
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
        <div className="bg-neutral-50 p-8 flex flex-col items-center justify-center text-neutral-400 min-h-[150px] w-full">
          <span className="font-medium tracking-widest text-xs mb-2 text-center">ADVERTISEMENT</span>
          <p className="text-sm text-center">พื้นที่โฆษณา</p>
        </div>
      )}
    </>
  );

  const containerClasses = `w-full transition-all flex flex-col items-center justify-center ${
    isSliderItem ? '' : 'rounded-3xl overflow-hidden'
  } ${
    !error 
      ? (isSliderItem ? '' : 'dash-card border-none hover:-translate-y-1')
      : (isSliderItem ? 'bg-neutral-50' : 'border border-dashed border-neutral-200 rounded-3xl')
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
