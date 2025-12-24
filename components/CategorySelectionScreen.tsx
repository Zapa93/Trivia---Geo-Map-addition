import React, { useState } from 'react';
import { TriviaCategory } from '../types';
import { useTVNavigation } from '../hooks/useTVNavigation';
import { clearSpecificHistory } from '../services/triviaService';
import { shuffleArray } from '../utils/helpers';

interface CategorySelectionScreenProps {
  onStartGame: (selectedCategories: TriviaCategory[]) => void;
  onBack: () => void;
}

const AVAILABLE_CATEGORIES: TriviaCategory[] = [
  // --- OpenTDB Categories ---
  { id: 'otdb_general', name: 'General', emoji: '🧠' },
  { id: 'otdb_film', name: 'Film', emoji: '🎬' },
  { id: 'otdb_music', name: 'Music Trivia', emoji: '🎵' },
  { id: 'otdb_tv', name: 'TV', emoji: '📺' },
  { id: 'otdb_videogames', name: 'Video Games', emoji: '🎮' },
  { id: 'otdb_cartoons', name: 'Cartoons', emoji: '🦄' },
  { id: 'otdb_science', name: 'Science', emoji: '🔬' },
  { id: 'otdb_computers', name: 'Computers', emoji: '💻' },
  { id: 'otdb_math', name: 'Math', emoji: '➗' },
  { id: 'otdb_gadgets', name: 'Gadgets', emoji: '📱' },
  { id: 'otdb_mythology', name: 'Mythology', emoji: '⚡' },
  { id: 'otdb_sports', name: 'Sports', emoji: '⚽' },
  { id: 'otdb_geography', name: 'Geography', emoji: '🌍' },
  { id: 'otdb_history', name: 'History', emoji: '📜' },
  { id: 'otdb_politics', name: 'Politics', emoji: '⚖️' },
  { id: 'otdb_art', name: 'Art', emoji: '🎨' },
  { id: 'otdb_celebs', name: 'Celebrities', emoji: '🌟' },
  { id: 'otdb_animals', name: 'Animals', emoji: '🐾' },
  { id: 'otdb_vehicles', name: 'Vehicles', emoji: '🚗' },

  // --- Visual Categories ---
  { id: 'geo_flags', name: 'Flags', emoji: '🏳️' },
  { id: 'geo_capitals', name: 'Capitals', emoji: '🏛️' },
  { id: 'geo_maps', name: 'World Map', emoji: '🗺️' },
  { id: 'mov_posters', name: 'Posters', emoji: '🖼️' },
  { id: 'football_career', name: 'Career Path', emoji: '⚽' },

  // --- Music Categories ---
  { id: 'music_2010s', name: '2010s Hits', emoji: '🎧' },
  { id: 'music_2000s', name: '2000s Hits', emoji: '💿' },
  { id: 'music_90s', name: '90s Hits', emoji: '📼' },
  { id: 'music_80s', name: '80s Hits', emoji: '🕺' },
  { id: 'music_rock', name: 'Rock', emoji: '🎸' },
  { id: 'music_hiphop', name: 'Hip Hop & RnB', emoji: '🎤' },
  { id: 'music_movies', name: 'Soundtracks', emoji: '🍿' }
];

export const CategorySelectionScreen: React.FC<CategorySelectionScreenProps> = ({ onStartGame, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

  // States för Clear History Menyn
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [clearMenuIndex, setClearMenuIndex] = useState(0);
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);

  const GRID_COLS = 6;
  const TOTAL_CATS = AVAILABLE_CATEGORIES.length;
  
  // Navigation Indices - Nu med en BACK-knapp först
  const BACK_BUTTON_INDEX = TOTAL_CATS;
  const START_BUTTON_INDEX = TOTAL_CATS + 1;
  const RANDOM_BUTTON_INDEX = TOTAL_CATS + 2;
  const RESET_BUTTON_INDEX = TOTAL_CATS + 3;

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(catId => catId !== id);
      } else {
        if (prev.length >= 6) return prev; 
        return [...prev, id];
      }
    });
  };

  const handleRandomize = () => {
    const shuffled = shuffleArray([...AVAILABLE_CATEGORIES]);
    const randomSix = shuffled.slice(0, 6).map(c => c.id);
    setSelectedIds(randomSix);
  };

  const executeClear = () => {
    const options: ('music' | 'geo' | 'visual' | 'otdb' | 'all')[] = ['music', 'geo', 'visual', 'otdb', 'all'];
    const type = options[clearMenuIndex];
    
    clearSpecificHistory(type);
    
    const labels = ["Music", "Geography", "Images/Visuals", "OpenTDB (Text)", "EVERYTHING"];
    setClearFeedback(`Cleared: ${labels[clearMenuIndex]}`);
    setTimeout(() => {
        setClearFeedback(null);
        setShowClearMenu(false);
    }, 1500);
  };

  const isValid = selectedIds.length >= 4 && selectedIds.length <= 6;

  useTVNavigation({
    onUp: () => {
      if (showClearMenu) {
         setClearMenuIndex(prev => Math.max(0, prev - 1));
      } else {
         if (focusIndex >= BACK_BUTTON_INDEX) {
           setFocusIndex(TOTAL_CATS - Math.floor(GRID_COLS / 2));
         } else if (focusIndex >= GRID_COLS) {
           setFocusIndex(prev => prev - GRID_COLS);
         }
      }
    },
    onDown: () => {
      if (showClearMenu) {
         setClearMenuIndex(prev => Math.min(4, prev + 1));
      } else {
         if (focusIndex < TOTAL_CATS - GRID_COLS) {
           setFocusIndex(prev => prev + GRID_COLS);
         } else if (focusIndex < TOTAL_CATS) {
           setFocusIndex(START_BUTTON_INDEX); 
         }
      }
    },
    onLeft: () => {
      if (showClearMenu) return;
      
      if (focusIndex === BACK_BUTTON_INDEX) return;
      
      if (focusIndex === START_BUTTON_INDEX) setFocusIndex(BACK_BUTTON_INDEX);
      if (focusIndex === RANDOM_BUTTON_INDEX) setFocusIndex(START_BUTTON_INDEX);
      if (focusIndex === RESET_BUTTON_INDEX) setFocusIndex(RANDOM_BUTTON_INDEX);
      
      if (focusIndex < TOTAL_CATS && focusIndex % GRID_COLS !== 0) {
        setFocusIndex(prev => prev - 1);
      }
    },
    onRight: () => {
      if (showClearMenu) return;

      if (focusIndex === BACK_BUTTON_INDEX) setFocusIndex(START_BUTTON_INDEX);
      if (focusIndex === START_BUTTON_INDEX) setFocusIndex(RANDOM_BUTTON_INDEX);
      if (focusIndex === RANDOM_BUTTON_INDEX) setFocusIndex(RESET_BUTTON_INDEX);
      
      if (focusIndex < TOTAL_CATS && (focusIndex + 1) % GRID_COLS !== 0) {
        setFocusIndex(prev => prev + 1);
      }
    },
    onEnter: () => {
      if (showClearMenu) {
         executeClear();
      } else {
         if (focusIndex === BACK_BUTTON_INDEX) {
           onBack(); 
         } else if (focusIndex === START_BUTTON_INDEX) {
           if (isValid) {
             const selectedCats = AVAILABLE_CATEGORIES.filter(c => selectedIds.includes(c.id));
             onStartGame(selectedCats);
           }
         } else if (focusIndex === RANDOM_BUTTON_INDEX) {
           handleRandomize();
         } else if (focusIndex === RESET_BUTTON_INDEX) {
           setShowClearMenu(true);
           setClearMenuIndex(0);
         } else if (focusIndex < TOTAL_CATS) {
           toggleSelection(AVAILABLE_CATEGORIES[focusIndex].id);
         }
      }
    },
    onGreen: () => {
       if (!showClearMenu && isValid) {
          const selectedCats = AVAILABLE_CATEGORIES.filter(c => selectedIds.includes(c.id));
          onStartGame(selectedCats);
       }
    },
    onBack: () => {
        if (showClearMenu) setShowClearMenu(false);
        else onBack();
    }
  }, [focusIndex, selectedIds, isValid, showClearMenu, clearMenuIndex]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden text-white z-10 bg-slate-950">
      
      {/* CLEAR HISTORY MODAL */}
      {showClearMenu && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border-4 border-slate-600 rounded-3xl p-12 w-[600px] shadow-2xl relative">
                <h2 className="text-4xl font-black text-white mb-8 text-center uppercase tracking-widest">
                    Clear History
                </h2>
                
                {clearFeedback ? (
                    <div className="text-3xl text-green-400 font-bold text-center py-10 animate-pulse">
                        {clearFeedback}
                    </div>
                ) : (
                    <div className="flex flex-col space-y-4">
                        {[
                            { label: "Clear Music History", desc: "Reset songs (80s, 90s, Rock...)" },
                            { label: "Clear Geography", desc: "Reset Maps, Flags & Capitals" },
                            { label: "Clear Visuals", desc: "Reset Movie Posters & Career Path" },
                            { label: "Clear OpenTDB", desc: "Reset Text Questions (General, Science...)" },
                            { label: "CLEAR EVERYTHING", desc: "Full Factory Reset (Warning!)" }
                        ].map((opt, idx) => (
                            <div 
                                key={idx}
                                className={`
                                   p-4 rounded-xl border-2 transition-all flex flex-col items-center
                                   ${clearMenuIndex === idx 
                                     ? 'bg-red-900 border-white scale-105 shadow-lg' 
                                     : 'bg-slate-800 border-slate-700 text-gray-400'}
                                `}
                            >
                                <span className={`text-xl font-bold ${clearMenuIndex === idx ? 'text-white' : 'text-gray-300'}`}>
                                    {opt.label}
                                </span>
                                {clearMenuIndex === idx && (
                                    <span className="text-xs text-red-200 mt-1 uppercase tracking-wide">{opt.desc}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-8 text-center text-gray-500 text-sm font-bold uppercase tracking-widest">
                    Press BACK to Cancel
                </div>
            </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex flex-col w-full h-full transition-opacity duration-300 ${showClearMenu ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
          
          {/* HEADER */}
          <div className="mt-4 mb-2 text-center shrink-0">
            <h2 className="text-4xl font-black tracking-tight mb-2 text-white">
              Choose Your Destiny
            </h2>
            <div className="flex items-center justify-center">
              <div className="glass-panel px-8 py-1 rounded-full flex items-center gap-3 border-slate-600 bg-slate-900/80">
                <span className={`text-xl font-mono font-bold ${isValid ? 'text-magic-cyan' : 'text-gray-400'}`}>
                  {selectedIds.length} / 6
                </span>
                <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Categories (Min 4)</span>
              </div>
            </div>
          </div>

          {/* GRID CONTAINER - STÖRRE RUTOR (h-48) */}
          <div className="grid grid-cols-6 gap-5 mb-4 px-8 w-full max-w-[98vw] flex-1 content-center">
            {AVAILABLE_CATEGORIES.map((cat, idx) => {
              const isSelected = selectedIds.includes(cat.id);
              const isFocused = focusIndex === idx;
              const isMusic = cat.id.startsWith('music_');
              const isVisual = cat.id.startsWith('geo_') || cat.id === 'mov_posters' || cat.id === 'football_career';
              const isOtdb = cat.id.startsWith('otdb_');

              let baseColor = 'bg-slate-800 border-slate-700'; 
              if (isMusic) baseColor = 'bg-slate-900 border-fuchsia-900/50';
              if (isVisual) baseColor = 'bg-slate-900 border-emerald-900/50';
              if (isOtdb) baseColor = 'bg-slate-900 border-indigo-900/50';

              if (isSelected) {
                if (isMusic) baseColor = 'bg-fuchsia-800 border-white text-white';
                else if (isVisual) baseColor = 'bg-emerald-800 border-white text-white';
                else if (isOtdb) baseColor = 'bg-indigo-800 border-white text-white';
                else baseColor = 'bg-blue-800 border-white text-white';
              }

              return (
                <div
                  key={cat.id}
                  className={`
                    h-48 flex flex-col items-center justify-center rounded-2xl border-4 relative overflow-hidden shadow-lg transition-transform duration-200
                    ${baseColor}
                    ${!isSelected && 'text-gray-400 opacity-90'}
                    ${isFocused ? 'tv-focus z-10 !opacity-100 scale-110 shadow-xl' : ''}
                  `}
                >
                  <span className="text-8xl mb-2 drop-shadow-md">{cat.emoji}</span>
                  <span className="text-xl font-black uppercase tracking-wide text-center px-1 leading-tight drop-shadow-md">
                    {cat.name}
                  </span>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-gray-300"></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ACTIONS CONTAINER */}
          <div className="flex items-center space-x-6 mb-8 justify-center shrink-0">
            
            {/* BACK BUTTON */}
            <div 
              className={`
                px-8 py-4 rounded-full border-4 flex items-center space-x-2
                ${focusIndex === BACK_BUTTON_INDEX ? 'tv-focus bg-slate-700 border-white text-white' : 'bg-slate-800 border-slate-600 text-gray-400'}
              `}
            >
              <span className="text-xl">⬅</span>
              <span className="font-bold tracking-widest uppercase text-lg">Players</span>
            </div>

            {/* START BUTTON */}
            <div 
              className={`
                px-14 py-4 rounded-full border-4 flex items-center space-x-5
                ${focusIndex === START_BUTTON_INDEX ? 'tv-focus scale-105' : ''}
                ${isValid 
                  ? 'bg-blue-600 text-white border-blue-400' 
                  : 'bg-gray-800 text-gray-500 border-gray-700'
                }
              `}
            >
              <span className="font-black tracking-[0.2em] uppercase text-2xl">BEGIN</span>
              {isValid && <span className="bg-white text-blue-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">OK</span>}
            </div>

            {/* RANDOM BUTTON */}
            <div 
              className={`
                px-10 py-4 rounded-full border-4 flex items-center space-x-3
                ${focusIndex === RANDOM_BUTTON_INDEX ? 'tv-focus bg-purple-600 border-white text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}
              `}
            >
              <span className="text-2xl">🎲</span>
              <span className="font-bold tracking-widest uppercase text-lg">Random</span>
            </div>

            {/* CLEAR BUTTON - Fixad syntax här */}
            <div 
              className={`px-8 py-4 rounded-full border-2 border-red-900/50 ${
                focusIndex === RESET_BUTTON_INDEX 
                  ? 'tv-focus bg-red-900 border-red-500 text-white' 
                  : 'text-red-400/70'
              }`}
            >
               <span className="text-sm font-bold uppercase tracking-widest">Clear History</span>
            </div>
          </div>
      </div>
    </div>
  );
};