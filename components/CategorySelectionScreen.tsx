import React, { useState, useMemo } from 'react';
import { TriviaCategory } from '../types';
import { useTVNavigation } from '../hooks/useTVNavigation';
import { clearSpecificHistory } from '../services/triviaService';
import { shuffleArray } from '../utils/helpers';

interface CategorySelectionScreenProps {
  onStartGame: (selectedCategories: TriviaCategory[]) => void;
  onBack: () => void;
}

// Vi delar upp datat i tre tydliga grupper
const CAT_GROUPS = {
  OPENTDB: [
    { id: 'otdb_general', name: 'General', emoji: '🧠' },
    { id: 'otdb_videogames', name: 'Video Games', emoji: '🎮' },
    { id: 'otdb_film', name: 'Film', emoji: '🎬' },
    { id: 'otdb_computers', name: 'Computers', emoji: '💻' },
    { id: 'otdb_geography', name: 'Geography', emoji: '🌍' },
    { id: 'otdb_history', name: 'History', emoji: '📜' },
  ],
  TRIVIA_API: [
    { id: 'triv_general_knowledge', name: 'General', emoji: '💡' }, // NY!
    { id: 'triv_film_and_tv', name: 'Film & TV', emoji: '🍿' },
    { id: 'triv_music', name: 'Music (Text)', emoji: '🎼' },
    { id: 'triv_history', name: 'History', emoji: '🏺' }, // NY!
    { id: 'triv_geography', name: 'Geography', emoji: '🗺️' }, // NY!
    { id: 'triv_science', name: 'Science', emoji: '🔬' },
    { id: 'triv_arts_and_literature', name: 'Arts & Lit', emoji: '📚' },
    { id: 'triv_sport_and_leisure', name: 'Sports', emoji: '⚽' },
    { id: 'triv_society_and_culture', name: 'Society', emoji: '🏛️' },
    { id: 'triv_food_and_drink', name: 'Food/Drink', emoji: '🍔' },
  ],
  CUSTOM: [
    // --- VISUALS (Green) ---
    { id: 'geo_flags', name: 'Flags', emoji: '🏳️' },
    { id: 'geo_capitals', name: 'Capitals', emoji: '🏛️' },
    { id: 'geo_maps', name: 'World Map', emoji: '🗺️' },
    { id: 'mov_posters', name: 'Posters', emoji: '🖼️' },
    { id: 'football_career', name: 'Career Path', emoji: '⚽' },
    
    // --- MUSIC AUDIO (Purple/Fuchsia) ---
    { id: 'music_2010s', name: '2010s Hits', emoji: '🎧' },
    { id: 'music_2000s', name: '2000s Hits', emoji: '💿' },
    { id: 'music_90s', name: '90s Hits', emoji: '📼' },
    { id: 'music_80s', name: '80s Hits', emoji: '🕺' },
    { id: 'music_rock', name: 'Rock', emoji: '🎸' },
    { id: 'music_hiphop', name: 'Hip Hop', emoji: '🎤' },
    { id: 'music_movies', name: 'Soundtracks', emoji: '🍿' }
  ]
};

// Hjälpfunktion för att platta ut listan vid start av spel
const ALL_CATS = [...CAT_GROUPS.OPENTDB, ...CAT_GROUPS.TRIVIA_API, ...CAT_GROUPS.CUSTOM];

export const CategorySelectionScreen: React.FC<CategorySelectionScreenProps> = ({ onStartGame, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Koordinat-baserad navigering: [Row, Col]
  const [focusPos, setFocusPos] = useState<[number, number]>([0, 0]);

  // States för Clear History
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [clearMenuIndex, setClearMenuIndex] = useState(0);
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);

  // --- MAPPA KATEGORIER TILL RUTNÄTET ---
  const gridMap = useMemo(() => {
    const map: Record<string, TriviaCategory> = {};
    
    // OpenTDB: Top Left (2 rader, 3 kolumner) -> R0-1, C0-2
    CAT_GROUPS.OPENTDB.forEach((cat, idx) => {
        const r = Math.floor(idx / 3);
        const c = idx % 3;
        map[`${r},${c}`] = cat;
    });

    // Trivia API: Top Right (2 rader, 5 kolumner) -> R0-1, C3-7
    CAT_GROUPS.TRIVIA_API.forEach((cat, idx) => {
        const r = Math.floor(idx / 5); 
        const c = 3 + (idx % 5);       
        map[`${r},${c}`] = cat;
    });

    // Custom: Bottom (2 rader, 6 kolumner) -> R2-3, C0-5
    // Mix av Visuals (5st) och Musik (7st) = 12st totalt
    CAT_GROUPS.CUSTOM.forEach((cat, idx) => {
        const r = 2 + Math.floor(idx / 6);
        const c = idx % 6;
        map[`${r},${c}`] = cat;
    });

    return map;
  }, []);

  const isValid = selectedIds.length >= 4 && selectedIds.length <= 6;

  // --- NAVIGATION LOGIC ---
  const handleMove = (dRow: number, dCol: number) => {
    setFocusPos(([r, c]) => {
        let newR = r + dRow;
        let newC = c + dCol;

        // Specialfall: Hoppa till knappar (Rad 4)
        if (newR === 4) {
            if (newC < 1) newC = 1; 
            if (newC > 3) newC = 3; 
            return [4, newC];
        }

        if (gridMap[`${newR},${newC}`]) {
            return [newR, newC];
        }

        // Smart "Gap Jumping"
        if (newR !== r) { // Vertikal flytt
            // Om vi går ner från Trivia API (Col 7) till Custom (max Col 5)
            if (newC > 5) newC = 5;
            if (gridMap[`${newR},${newC}`]) return [newR, newC];
        }
        
        if (newC !== c) { // Horisontell flytt
             // Om vi går höger från OpenTDB (Col 2) till Trivia API (Col 3)
             if (newC === 3 && gridMap[`${newR},${newC}`]) return [newR, newC];
        }

        return [r, c];
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const handleRandomize = () => {
    const shuffled = shuffleArray(ALL_CATS);
    setSelectedIds(shuffled.slice(0, 6).map(c => c.id));
  };

  const executeClear = () => {
     const types: any[] = ['music', 'geo', 'visual', 'otdb', 'all'];
     clearSpecificHistory(types[clearMenuIndex]);
     const labels = ["Music", "Geo", "Visuals", "Text", "ALL"];
     setClearFeedback(`Cleared: ${labels[clearMenuIndex]}`);
     setTimeout(() => { setClearFeedback(null); setShowClearMenu(false); }, 1500);
  };

  useTVNavigation({
    onUp: () => showClearMenu ? setClearMenuIndex(i => Math.max(0, i-1)) : handleMove(-1, 0),
    onDown: () => showClearMenu ? setClearMenuIndex(i => Math.min(4, i+1)) : handleMove(1, 0),
    onLeft: () => showClearMenu ? null : handleMove(0, -1),
    onRight: () => showClearMenu ? null : handleMove(0, 1),
    onEnter: () => {
        if (showClearMenu) {
            executeClear();
            return;
        }
        const [r, c] = focusPos;
        
        if (r === 4) {
            if (c === 1) onBack(); 
            if (c === 2) { 
                if (isValid) onStartGame(ALL_CATS.filter(cat => selectedIds.includes(cat.id)));
            }
            if (c === 3) handleRandomize();
            if (c === 4) setShowClearMenu(true);
            return;
        }

        const cat = gridMap[`${r},${c}`];
        if (cat) toggleSelection(cat.id);
    },
    onGreen: () => {
        if (!showClearMenu && isValid) onStartGame(ALL_CATS.filter(cat => selectedIds.includes(cat.id)));
    },
    onRed: () => {
        if (!showClearMenu) {
            setShowClearMenu(true);
            setClearMenuIndex(0);
        }
    },
    onBack: () => showClearMenu ? setShowClearMenu(false) : onBack()
  }, [focusPos, selectedIds, showClearMenu, clearMenuIndex]);

  // --- RENDER HELPERS ---
  const renderCategoryGrid = (categories: TriviaCategory[], startRow: number, startCol: number, cols: number, borderColor: string) => {
    return (
        <div className={`grid gap-3 w-full h-full`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {categories.map((cat, idx) => {
                const r = startRow + Math.floor(idx / cols);
                const c = startCol + (idx % cols);
                const isFocused = focusPos[0] === r && focusPos[1] === c;
                const isSelected = selectedIds.includes(cat.id);

                // --- FÄRGHANTERING PER CELL ---
                let cellBorder = borderColor; // Standard för gruppen
                let textColor = 'text-gray-400';
                
                // Specifika färger för Custom-gruppen
                if (cat.id.startsWith('music_')) {
                    cellBorder = 'border-fuchsia-600';
                    textColor = isFocused ? 'text-fuchsia-300' : 'text-fuchsia-700';
                } else if (cat.id.startsWith('geo_') || cat.id === 'mov_posters' || cat.id === 'football_career') {
                    cellBorder = 'border-emerald-600';
                    textColor = isFocused ? 'text-emerald-300' : 'text-emerald-700';
                } else if (cat.id.startsWith('triv_')) {
                    // Orange för Trivia API
                    textColor = isFocused ? 'text-orange-300' : 'text-orange-700';
                } else {
                    // Indigo för OpenTDB
                    textColor = isFocused ? 'text-indigo-300' : 'text-indigo-700';
                }

                // Om vald, skriv över med vitt
                if (isSelected) {
                    textColor = 'text-slate-900';
                }

                return (
                    <div 
                        key={cat.id}
                        className={`
                            relative rounded-xl flex flex-col items-center justify-center
                            transition-all duration-75
                            ${isSelected 
                                ? 'bg-white border-4 border-white' 
                                : `bg-slate-900 ${cellBorder} border-2`
                            }
                            ${isFocused ? '!border-yellow-400 scale-105 z-10 shadow-xl bg-slate-800' : 'opacity-90'}
                        `}
                    >
                         {/* STÖRRE TEXT & EMOJI */}
                         <span className="text-5xl mb-1 filter drop-shadow-md">{cat.emoji}</span>
                         <span className={`text-sm font-black uppercase tracking-wide text-center leading-tight px-1 ${textColor}`}>
                            {cat.name}
                         </span>
                         
                         {isSelected && (
                             <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full shadow-sm border border-white"></div>
                         )}
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-slate-950 p-8 flex flex-col overflow-hidden text-white">
        
        {/* MODAL: CLEAR HISTORY */}
        {showClearMenu && (
             <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center">
                 <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-8 w-[500px] text-center">
                     <h2 className="text-3xl font-bold mb-6 text-red-400">Clear History</h2>
                     {clearFeedback ? <h3 className="text-green-400 text-2xl">{clearFeedback}</h3> : (
                         <div className="flex flex-col gap-2">
                             {["Music", "Geography", "Visuals", "Text Questions", "EVERYTHING"].map((l, i) => (
                                 <div key={i} className={`p-3 rounded border ${clearMenuIndex === i ? 'bg-red-900 border-white' : 'border-transparent text-gray-500'}`}>
                                     {l}
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 px-4 h-16 shrink-0">
            <h1 className="text-3xl font-black italic tracking-tighter text-yellow-400">TRIVIA SETUP</h1>
            <div className={`px-6 py-2 rounded-full border-2 ${isValid ? 'border-green-400 bg-green-900/30' : 'border-gray-600 bg-gray-800'}`}>
                <span className="font-bold text-lg">{selectedIds.length} / 6 Selected</span>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
            
            {/* TOP ROW: OPENTDB (Left) + TRIVIA API (Right) */}
            <div className="flex flex-row gap-4 h-[45%]">
                
                {/* ZONE: OpenTDB */}
                <div className="flex-[3] border-2 border-indigo-500/30 rounded-2xl p-4 relative bg-slate-900/30">
                    <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-indigo-400 font-bold text-xs tracking-widest uppercase">
                        OpenTDB (Classic)
                    </div>
                    {renderCategoryGrid(CAT_GROUPS.OPENTDB, 0, 0, 3, 'border-indigo-800')}
                </div>

                {/* ZONE: Trivia API */}
                <div className="flex-[5] border-2 border-orange-500/30 rounded-2xl p-4 relative bg-slate-900/30">
                    <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-orange-400 font-bold text-xs tracking-widest uppercase">
                        The Trivia API (Modern)
                    </div>
                    {renderCategoryGrid(CAT_GROUPS.TRIVIA_API, 0, 3, 5, 'border-orange-800')}
                </div>

            </div>

            {/* BOTTOM ROW: CUSTOM / VISUALS */}
            <div className="flex-1 border-2 border-emerald-500/30 rounded-2xl p-4 relative bg-slate-900/30">
                 <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-emerald-400 font-bold text-xs tracking-widest uppercase">
                        Interactive • Visuals • Music
                 </div>
                 {renderCategoryGrid(CAT_GROUPS.CUSTOM, 2, 0, 6, 'border-emerald-800')}
            </div>

        </div>

        {/* FOOTER BUTTONS */}
        <div className="h-20 shrink-0 flex items-center justify-center gap-8 mt-2">
            
            <button className={`
                px-8 py-3 rounded-full border-2 font-bold uppercase tracking-widest transition-all
                ${focusPos[0] === 4 && focusPos[1] === 1 ? 'bg-slate-700 border-white scale-110' : 'border-slate-700 text-gray-500'}
            `}>
                Back
            </button>

            <button className={`
                px-12 py-4 rounded-full border-4 font-black text-xl uppercase tracking-widest transition-all
                ${focusPos[0] === 4 && focusPos[1] === 2 ? 'scale-110 border-yellow-400' : ''}
                ${isValid ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-gray-600'}
            `}>
                Start Game
            </button>

            <button className={`
                px-8 py-3 rounded-full border-2 font-bold uppercase tracking-widest transition-all
                ${focusPos[0] === 4 && focusPos[1] === 3 ? 'bg-purple-700 border-white scale-110' : 'border-purple-900 text-purple-400'}
            `}>
                Random
            </button>

             <div className={`
                px-6 py-3 rounded-full border-2 font-bold uppercase tracking-widest transition-all
                ${focusPos[0] === 4 && focusPos[1] === 4 ? 'bg-red-900 border-white scale-110 text-white' : 'border-red-900/30 text-red-900/50'}
            `}>
                Clear History
            </div>

        </div>
    </div>
  );
};