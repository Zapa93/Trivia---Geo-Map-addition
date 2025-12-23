import React, { useState } from 'react';
import { useTVNavigation } from '../hooks/useTVNavigation';

interface SetupScreenProps {
  onNext: (playerCount: number) => void;
}

const ANIMAL_PREVIEWS = ['🦊', '🦁', '🐼', '🐨'];

export const SetupScreen: React.FC<SetupScreenProps> = ({ onNext }) => {
  const [playerCount, setPlayerCount] = useState(1);
  const [isFocused, setIsFocused] = useState(true);

  useTVNavigation({
    onLeft: () => setPlayerCount(prev => Math.max(1, prev - 1)),
    onRight: () => setPlayerCount(prev => Math.min(4, prev + 1)),
    onEnter: () => onNext(playerCount),
  }, [playerCount]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-950">
      
      {/* Title */}
      <div className="mb-16 text-center relative z-10">
        <h1 className="text-[100px] font-black tracking-tighter leading-none text-white drop-shadow-lg">
          TRIVIA
        </h1>
        <div className="text-2xl text-purple-200 font-bold tracking-[0.5em] uppercase mt-2">
          Magic Edition
        </div>
      </div>

      <div className="glass-panel p-14 rounded-[2rem] flex flex-col items-center space-y-12 w-full max-w-3xl z-10">
        <h2 className="text-xl text-cyan-200 uppercase tracking-[0.2em] font-bold">Select Contenders</h2>
        
        <div className="flex items-center space-x-16">
          <div className={`
             transition-transform duration-200 w-56 h-56 rounded-full border-4
             flex items-center justify-center relative
             ${isFocused ? 'border-magic-cyan bg-slate-800 scale-105' : 'border-slate-600 bg-slate-900'}
          `}>
             <span className="text-9xl font-black font-mono text-white">{playerCount}</span>
             
             {/* Arrows */}
             {isFocused && (
               <>
                <div className="absolute -left-20 text-5xl text-magic-cyan">◀</div>
                <div className="absolute -right-20 text-5xl text-magic-cyan">▶</div>
               </>
             )}
          </div>
        </div>

        {/* Player Indicators */}
        <div className="flex justify-center space-x-6">
          {[0, 1, 2, 3].map(idx => (
            <div 
              key={idx} 
              className={`
                h-16 w-16 rounded-2xl flex items-center justify-center text-3xl transition-opacity duration-200 border border-slate-600
                ${idx < playerCount 
                  ? 'bg-blue-600 opacity-100' 
                  : 'bg-slate-900 opacity-30'
                }
              `} 
            >
              {ANIMAL_PREVIEWS[idx]}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center bg-slate-800 px-8 py-3 rounded-full border border-slate-700">
          <p className="text-sm font-bold tracking-widest uppercase text-white">Press <span className="text-magic-pink mx-1">OK</span> to Start</p>
        </div>
      </div>
    </div>
  );
};