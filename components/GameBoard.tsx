import React, { useState } from 'react';
import { CategoryColumn, ProcessedQuestion, Player } from '../types';
import { useTVNavigation } from '../hooks/useTVNavigation';

interface GameBoardProps {
  categories: CategoryColumn[];
  players: Player[];
  currentPlayerIndex: number;
  onQuestionSelect: (question: ProcessedQuestion) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  categories, 
  players, 
  currentPlayerIndex, 
  onQuestionSelect 
}) => {
  const colCount = categories.length;

  // Initialize focus to the first unanswered question
  const [focus, setFocus] = useState<[number, number]>(() => {
    for (let c = 0; c < colCount; c++) {
      for (let r = 0; r < 5; r++) {
        if (!categories[c].questions[r].isAnswered) return [c, r];
      }
    }
    return [0, 0];
  });

  // Helper to find next valid (unanswered) cell in a direction
  const getNextFocus = (startC: number, startR: number, dC: number, dR: number): [number, number] => {
      let c = startC + dC;
      let r = startR + dR;
      
      // Loop while within bounds
      while (c >= 0 && c < colCount && r >= 0 && r < 5) {
          if (!categories[c].questions[r].isAnswered) {
              return [c, r];
          }
          // Continue searching in the same direction
          c += dC;
          r += dR;
      }
      // If no valid move found, stay on current cell
      return [startC, startR];
  };

  useTVNavigation({
    onUp: () => setFocus(([c, r]) => getNextFocus(c, r, 0, -1)),
    onDown: () => setFocus(([c, r]) => getNextFocus(c, r, 0, 1)),
    onLeft: () => setFocus(([c, r]) => getNextFocus(c, r, -1, 0)),
    onRight: () => setFocus(([c, r]) => getNextFocus(c, r, 1, 0)),
    onEnter: () => {
      const [c, r] = focus;
      const question = categories[c].questions[r];
      if (!question.isAnswered) {
        onQuestionSelect(question);
      }
    }
  }, [focus, categories]);

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="h-screen w-screen flex flex-col p-8 box-border z-10 bg-slate-950">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 px-4 h-16">
        <h1 className="text-4xl font-black italic tracking-tighter text-yellow-400">
          TRIVIA NIGHT
        </h1>
        
        {/* Current Player Badge */}
        <div className="px-8 py-2 rounded-xl border-2 border-yellow-400 bg-blue-950 flex items-center space-x-4">
           <span className="text-3xl">{currentPlayer.avatar}</span>
           <div className="flex flex-col items-start">
             <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Current Turn</span>
             <span className="text-xl font-black text-white">{currentPlayer.name}</span>
           </div>
        </div>
      </div>

      {/* Main Grid */}
      <div 
        className="flex-1 grid gap-4 lg:gap-6"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {categories.map((col, cIdx) => {
          // Detect Type based on first question
          const isMusic = col.questions[0]?.type === 'music';
          
          // Styles based on Type
          const headerBorder = isMusic ? 'border-fuchsia-600' : 'border-yellow-600';
          const headerText = isMusic ? 'text-fuchsia-300' : 'text-yellow-400';
          const headerBg = isMusic ? 'bg-fuchsia-950' : 'bg-blue-950';
          
          const cellColor = isMusic ? 'bg-fuchsia-900' : 'bg-blue-800';

          return (
            <div key={cIdx} className="flex flex-col gap-4 h-full">
              {/* Category Header Box */}
              <div className={`h-28 rounded-xl border-2 ${headerBorder} ${headerBg} flex items-center justify-center p-2 relative overflow-hidden`}>
                 <h3 className={`font-black text-sm lg:text-xl leading-tight uppercase ${headerText} text-center break-words w-full line-clamp-3`}>
                   {col.title}
                 </h3>
              </div>

              {/* Questions Column */}
              <div className="flex-1 flex flex-col gap-4">
                 {col.questions.map((q, rIdx) => {
                   const isFocused = focus[0] === cIdx && focus[1] === rIdx;
                   return (
                     <div 
                       key={q.id}
                       className={`
                         flex-1 rounded-xl flex items-center justify-center relative transition-transform duration-150
                         ${q.isAnswered
                           ? 'bg-slate-900 border-2 border-slate-800 opacity-40'
                           : cellColor
                         }
                         ${isFocused && !q.isAnswered
                            ? 'scale-105 z-20 border-4 border-white shadow-xl brightness-110'
                            : ''
                         }
                       `}
                     >
                       {!q.isAnswered && (
                         <span className={`font-black text-3xl lg:text-5xl text-white/90`}>
                           ${q.pointValue}
                         </span>
                       )}
                       {isMusic && !q.isAnswered && (
                          <span className="absolute bottom-2 text-xs uppercase font-bold text-white/50 tracking-widest">♪</span>
                       )}
                     </div>
                   )
                 })}
              </div>
            </div>
          )
        })}
      </div>

       {/* Scoreboard */}
       <div className="mt-6 flex justify-center space-x-6 items-end pb-2">
          {players.map((p, idx) => (
             <div 
               key={p.id}
               className={`
                 px-6 py-3 rounded-lg border-2 flex flex-col items-center min-w-[140px]
                 ${idx === currentPlayerIndex 
                   ? 'bg-blue-800 border-yellow-400 transform -translate-y-2' 
                   : 'bg-slate-900 border-slate-700 text-gray-400'}
               `}
             >
                <div className="flex items-center space-x-2 text-sm font-bold mb-1 opacity-90">
                  <span className="text-xl">{p.avatar}</span>
                  <span className="uppercase tracking-wider">{p.name}</span>
                </div>
                <span className={`text-3xl font-black ${p.score < 0 ? 'text-red-400' : 'text-white'}`}>
                  ${p.score}
                </span>
             </div>
          ))}
       </div>
    </div>
  );
};