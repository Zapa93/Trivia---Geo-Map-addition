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

  // Hitta första lediga fråga vid start
  const [focus, setFocus] = useState<[number, number]>(() => {
    for (let c = 0; c < colCount; c++) {
      for (let r = 0; r < 5; r++) {
        if (!categories[c].questions[r].isAnswered) return [c, r];
      }
    }
    return [0, 0];
  });

  // --- NY SMART NAVIGERING ---
  const getSmartFocus = (startC: number, startR: number, direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): [number, number] => {
      
      // 1. Samla alla möjliga kandidater (frågor som inte är besvarade)
      const candidates: {c: number, r: number}[] = [];
      categories.forEach((col, cIdx) => {
          col.questions.forEach((q, rIdx) => {
              if (!q.isAnswered) {
                  // Filtrera bort oss själva
                  if (cIdx !== startC || rIdx !== startR) {
                      candidates.push({c: cIdx, r: rIdx});
                  }
              }
          });
      });

      // 2. Filtrera baserat på riktning (Kon-sökning)
      const validMoves = candidates.filter(pos => {
          if (direction === 'UP') return pos.r < startR; // Allt ovanför
          if (direction === 'DOWN') return pos.r > startR; // Allt nedanför
          if (direction === 'LEFT') return pos.c < startC; // Allt till vänster
          if (direction === 'RIGHT') return pos.c > startC; // Allt till höger
          return false;
      });

      // Om inga finns i riktningen, stanna kvar (eller wrappa om man vill, men stanna är säkrast)
      if (validMoves.length === 0) return [startC, startR];

      // 3. Sortera för att hitta den "bästa" kandidaten
      // Vi vill helst stanna på samma rad/kolumn (lågt straff), 
      // men måste vi byta så tar vi den närmaste (Euclidean distance-ish).
      
      validMoves.sort((a, b) => {
          const distC_A = Math.abs(a.c - startC);
          const distR_A = Math.abs(a.r - startR);
          const distC_B = Math.abs(b.c - startC);
          const distR_B = Math.abs(b.r - startR);

          let scoreA = 0;
          let scoreB = 0;

          // Straffa avvikelser i "fel" ledd hårt, så vi prioriterar raka linjer
          const PENALTY_WEIGHT = 5; 

          if (direction === 'LEFT' || direction === 'RIGHT') {
              // Primär ledd: Kolumn (litet värde bra). Sekundär: Rad (stort värde dåligt)
              scoreA = distC_A + (distR_A * PENALTY_WEIGHT);
              scoreB = distC_B + (distR_B * PENALTY_WEIGHT);
          } else {
              // Primär ledd: Rad. Sekundär: Kolumn
              scoreA = distR_A + (distC_A * PENALTY_WEIGHT);
              scoreB = distR_B + (distC_B * PENALTY_WEIGHT);
          }

          return scoreA - scoreB;
      });

      // Vinnaren är den med lägst score (närmast och rakast)
      const winner = validMoves[0];
      return [winner.c, winner.r];
  };

  useTVNavigation({
    onUp: () => setFocus(([c, r]) => getSmartFocus(c, r, 'UP')),
    onDown: () => setFocus(([c, r]) => getSmartFocus(c, r, 'DOWN')),
    onLeft: () => setFocus(([c, r]) => getSmartFocus(c, r, 'LEFT')),
    onRight: () => setFocus(([c, r]) => getSmartFocus(c, r, 'RIGHT')),
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
    <div className="h-screen w-screen flex flex-col p-4 box-border z-10 bg-slate-950 overflow-hidden">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-2 px-2 h-12 shrink-0">
        <h1 className="text-3xl font-black italic tracking-tighter text-yellow-400">
          TRIVIA NIGHT
        </h1>
        
        <div className="px-5 py-1 rounded-xl border-2 border-yellow-400 bg-blue-950 flex items-center space-x-3">
           <span className="text-2xl">{currentPlayer.avatar}</span>
           <div className="flex flex-col items-start">
             <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Turn</span>
             <span className="text-lg font-black text-white leading-none">{currentPlayer.name}</span>
           </div>
        </div>
      </div>

      {/* Main Grid */}
      <div 
        className="flex-1 grid gap-2 w-full min-h-0" 
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {categories.map((col, cIdx) => {
          const firstQ = col.questions[0];
          const catId = firstQ?.categoryId || "";

          // --- LOGIK FÖR FÄRGTEMAN ---
          const isMusic = catId.startsWith('music_');
          
          const isVisual = 
            catId.startsWith('geo_') || 
            catId === 'mov_posters' || 
            catId === 'football_career';

          let headerBorder = 'border-yellow-600';
          let headerText = 'text-yellow-400';
          let headerBg = 'bg-blue-950';
          let cellColor = 'bg-blue-800';

          if (isMusic) {
            headerBorder = 'border-fuchsia-600';
            headerText = 'text-fuchsia-300';
            headerBg = 'bg-fuchsia-950';
            cellColor = 'bg-fuchsia-900';
          } else if (isVisual) {
            headerBorder = 'border-emerald-600';
            headerText = 'text-emerald-300';
            headerBg = 'bg-emerald-950';
            cellColor = 'bg-emerald-900';
          }

          return (
            <div key={cIdx} className="flex flex-col gap-2 h-full">
              {/* Category Header */}
              <div className={`h-20 shrink-0 rounded-xl border-2 ${headerBorder} ${headerBg} flex items-center justify-center p-1 relative overflow-hidden`}>
                 <h3 className={`font-black text-base lg:text-xl leading-tight uppercase ${headerText} text-center break-words w-full line-clamp-3`}>
                    {col.title}
                 </h3>
              </div>

              {/* Questions Column */}
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                 {col.questions.map((q, rIdx) => {
                   const isFocused = focus[0] === cIdx && focus[1] === rIdx;
                   
                   // OPTIMERING: Inga 'scale' effekter. Endast ramfärg.
                   let borderClass = 'border-4 border-transparent'; 
                   let bgClass = cellColor;

                   if (q.isAnswered) {
                      bgClass = 'bg-slate-900 opacity-40';
                      borderClass = 'border-4 border-slate-800';
                   } else if (isFocused) {
                      // ENDAST FÄRG PÅ RAMEN ÄNDRAS - INGEN SKALNING
                      borderClass = 'border-4 border-yellow-400'; 
                   }

                   return (
                     <div 
                       key={q.id}
                       className={`
                         flex-1 rounded-xl flex items-center justify-center relative 
                         ${bgClass}
                         ${borderClass}
                       `}
                     >
                       {!q.isAnswered && (
                         <span className={`font-black text-4xl lg:text-6xl text-white/90 drop-shadow-md`}>
                           ${q.pointValue}
                         </span>
                       )}
                       {isMusic && !q.isAnswered && (
                          <span className="absolute bottom-1 right-2 text-[10px] uppercase font-bold text-white/40 tracking-widest">♪</span>
                       )}
                       {isVisual && !q.isAnswered && (
                          <span className="absolute bottom-1 right-2 text-[10px] uppercase font-bold text-white/40 tracking-widest">👁️</span>
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
       <div className="mt-2 flex justify-center space-x-4 items-end pb-1 shrink-0 h-16">
          {players.map((p, idx) => (
             <div 
               key={p.id}
               className={`
                 px-4 py-2 rounded-lg border-2 flex flex-col items-center min-w-[100px]
                 ${idx === currentPlayerIndex 
                   ? 'bg-blue-900 border-yellow-400' 
                   : 'bg-slate-900 border-slate-700 text-gray-500'}
               `}
             >
                <div className="flex items-center space-x-2 text-xs font-bold mb-0.5 opacity-90">
                  <span className="text-base">{p.avatar}</span>
                  <span className="uppercase tracking-wider">{p.name}</span>
                </div>
                <span className={`text-xl font-black ${p.score < 0 ? 'text-red-400' : 'text-white'}`}>
                  ${p.score}
                </span>
             </div>
          ))}
       </div>
    </div>
  );
};