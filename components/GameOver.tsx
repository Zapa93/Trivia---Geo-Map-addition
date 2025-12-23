import React from 'react';
import { Player } from '../types';
import { useTVNavigation } from '../hooks/useTVNavigation';

interface GameOverProps {
  players: Player[];
  onRestart: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ players, onRestart }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  useTVNavigation({
    onEnter: onRestart,
    onBack: onRestart
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative z-20 bg-slate-950">
       <h1 className="text-8xl font-black text-yellow-400 mb-8">
         CHAMPION
       </h1>
       
       <div className="glass-panel-active rounded-[3rem] p-16 text-center mb-12 border-4 border-yellow-400 relative overflow-hidden bg-slate-900">
          <p className="text-yellow-300 uppercase tracking-[0.4em] mb-6 font-bold text-sm">The Grand Winner</p>
          <div className="text-8xl mb-4">{winner.avatar}</div>
          <div className="text-6xl font-black text-white mb-6">{winner.name}</div>
          <div className="inline-block bg-yellow-400/20 px-8 py-2 rounded-full border border-yellow-400/40">
            <div className="text-7xl font-mono text-yellow-300 font-bold">${winner.score}</div>
          </div>
       </div>

       <div className="w-full max-w-4xl grid grid-cols-1 gap-4">
         {sortedPlayers.slice(1).map((p, idx) => (
           <div key={idx} className="flex justify-between items-center glass-panel px-8 py-4 rounded-2xl border-l-4 border-gray-400/50">
              <div className="flex items-center space-x-4">
                 <span className="text-2xl text-gray-500 font-bold">#{idx + 2}</span>
                 <span className="text-3xl">{p.avatar}</span>
                 <span className="text-2xl text-gray-300 font-bold">{p.name}</span>
              </div>
              <span className="text-2xl font-mono text-white/80">${p.score}</span>
           </div>
         ))}
       </div>

       <div className="mt-16 bg-slate-800 px-10 py-4 rounded-full border border-slate-600">
         <span className="text-white uppercase tracking-widest font-bold text-base">Press <span className="text-magic-pink">OK</span> to Play Again</span>
       </div>
    </div>
  );
};