import React, { useState, useEffect, useRef } from 'react';
import { ProcessedQuestion, Player } from '../types'; // Kom ihåg att importera Player
import { useTVNavigation } from '../hooks/useTVNavigation';
import { InteractiveMap } from './InteractiveMap';

interface QuestionScreenProps {
  question: ProcessedQuestion;
  currentPlayer: Player; // Ny prop
  onAnswer: (scoreMultiplier: number) => void; 
  onBack?: () => void;
  playCorrect: () => void;
  playWrong: () => void;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({ 
  question, 
  currentPlayer,
  onAnswer, 
  onBack,
  playCorrect,
  playWrong 
}) => {
  const [mapFeedback, setMapFeedback] = useState<{ correct: boolean; clicked: string } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  
  const [isRevealed, setIsRevealed] = useState(false);
  
  const TIMER_DURATION = question.timerDuration || (question.mediaType === 'text' ? 20 : 15);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  
  const GUESS_LIMIT = 15;
  const [guessingTime, setGuessingTime] = useState(GUESS_LIMIT);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isMovieSoundtrack = question.categoryId === 'music_movies';
  const isMultipleChoice = question.type === 'multiple' || question.type === 'text';
  const isHonorSystem = question.type === 'honor-system' || question.type === 'music';
  
  const isImageSequence = question.mediaType === 'image_sequence';
  const isTextSequence = question.mediaType === 'text_sequence' || question.clubList !== undefined;

  const canUseHalfPoints = question.type === 'music' && !isMovieSoundtrack;

  // --- AUDIO CLEANUP ---
  useEffect(() => {
	  setMapFeedback(null);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [question.id]);

  // --- AUDIO MODE LOGIC ---
  useEffect(() => {
    if (question.mediaType === 'audio' && question.audioUrl) {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }

      const audio = new Audio(question.audioUrl);
      audio.volume = 1.0; 
      audioRef.current = audio;

      audio.onended = () => {
        setTimeLeft(0);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(e => console.warn("Audio preview blocked by browser policy:", e));
      }
      
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
      };
    }
  }, [question]);

  // Secondary Timer for Audio
  useEffect(() => {
    if (question.mediaType === 'audio' && timeLeft <= 0 && !isRevealed) {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const interval = setInterval(() => {
        setGuessingTime(prev => {
          if (prev <= 1) {
             clearInterval(interval);
             handleReveal(); 
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [question.mediaType, timeLeft, isRevealed]);

  // --- IMAGE / TEXT SEQUENCE / HONOR SYSTEM TIMER ---
  useEffect(() => {
    if ((question.mediaType === 'image' || isImageSequence || isTextSequence) && isHonorSystem && !isRevealed) {
       const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleReveal();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [question.mediaType, isRevealed, isHonorSystem, isImageSequence, isTextSequence]);

  // --- MULTIPLE CHOICE TIMER ---
  useEffect(() => {
    if (isMultipleChoice && !showResult) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTextTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isMultipleChoice, showResult]);


  const handleReveal = () => {
    setIsRevealed(true);
    if (audioRef.current) {
        audioRef.current.pause();
    }
  };

  const handleRevealScore = (multiplier: number) => {
     if (multiplier === 0) playWrong();
     else playCorrect();

     onAnswer(multiplier);
  };

  const correctIndex = question.all_answers.indexOf(question.correct_answer);

  const handleTextTimeout = () => {
    setShowResult(true);
    playWrong();
    setTimeout(() => {
      onAnswer(0); 
    }, 3000);
  };

  const handleMapClick = (countryName: string) => {
    if (showResult) return;
    
    const isCorrect = countryName === question.correct_answer;

    setMapFeedback({
      correct: isCorrect,
      clicked: countryName
    });

    const idx = question.all_answers.indexOf(countryName);
    
    if (idx !== -1) {
      handleTextSelection(idx);
    } else {
      playWrong();
      setShowResult(true);
      setTimeout(() => {
        onAnswer(0);
      }, 2500);
    }
  };

  const handleTextSelection = (idx: number) => {
    if (showResult) return;
    
    setSelectedIdx(idx);
    setShowResult(true);

    const isCorrect = idx === correctIndex;

    if (isCorrect) {
      playCorrect();
    } else {
      playWrong();
      setShakeIdx(idx);
    }
    
    setTimeout(() => {
      onAnswer(isCorrect ? 1 : 0);
    }, 2500);
  };

  useTVNavigation({
    onRed: () => {
      if (isMultipleChoice) handleTextSelection(0);
      else if (isRevealed) handleRevealScore(0); 
    },
    onGreen: () => {
      if (isMultipleChoice) handleTextSelection(1);
      else if (isRevealed) handleRevealScore(1); 
    },
    onYellow: () => {
      if (isMultipleChoice) handleTextSelection(2);
      else if (isRevealed && canUseHalfPoints) handleRevealScore(0.5); 
    },
    onBlue: () => {
      if (isMultipleChoice) handleTextSelection(3);
    },
    onEnter: () => {
      if (isHonorSystem && !isRevealed) handleReveal();
    }
  }, [showResult, isRevealed, question, isMultipleChoice, isHonorSystem, canUseHalfPoints]);

  // --- RENDER ---

  const colors = [
    { name: 'Red', bg: 'bg-lg-red', shadow: 'shadow-none', border: 'border-lg-red' },
    { name: 'Green', bg: 'bg-lg-green', shadow: 'shadow-none', border: 'border-lg-green' },
    { name: 'Yellow', bg: 'bg-lg-yellow', shadow: 'shadow-none', border: 'border-lg-yellow' },
    { name: 'Blue', bg: 'bg-lg-blue', shadow: 'shadow-none', border: 'border-lg-blue' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900 pointer-events-none"></div>

      {/* Correct Answer Flash */}
      {showResult && selectedIdx === correctIndex && (
         <div className="absolute inset-0 bg-green-500/20 z-0 animate-pulse pointer-events-none"></div>
      )}

      {/* --- HEADER: STÖRRE OCH BÄTTRE LAYOUT --- */}
      <div className="p-8 flex justify-between items-start bg-black/40 z-20 border-b border-white/10 h-32">
        
        {/* Vänster: Kategori & Poäng */}
        <div className="flex flex-col justify-center">
          <span className="text-magic-cyan font-black tracking-widest uppercase mb-1 text-3xl drop-shadow-md">
            {question.category}
          </span>
          <div className="flex items-center gap-4">
             <span className="text-purple-300 text-xl uppercase tracking-wide font-bold">{question.difficulty}</span>
             <span className="text-gray-500 text-xl">|</span>
             <span className="text-5xl font-mono font-black text-yellow-400">
               ${question.pointValue}
             </span>
          </div>
        </div>

        {/* Höger: CURRENT PLAYER (Nu mycket större) */}
        {currentPlayer && (
          <div className="flex items-center bg-blue-900/80 border-2 border-yellow-400 rounded-2xl px-6 py-3 shadow-lg transform scale-110 origin-top-right">
             <div className="text-5xl mr-4 filter drop-shadow-lg">{currentPlayer.avatar}</div>
             <div className="flex flex-col">
                <span className="text-xs text-yellow-300 uppercase font-bold tracking-widest">Current Turn</span>
                <span className="text-3xl font-black text-white uppercase tracking-wide">{currentPlayer.name}</span>
             </div>
          </div>
        )}
      </div>

      {/* ---------------- AUDIO MODE (STÖRRE TEXT) ---------------- */}
      {question.mediaType === 'audio' && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-12">
           
           <div className={`
              w-72 h-72 rounded-full border-8 border-slate-800 bg-black relative flex items-center justify-center mb-10
              ${!isRevealed && timeLeft > 0 ? 'animate-spin' : ''}
           `} style={{ animationDuration: '4s' }}>
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-magic-pink to-purple-600 border-4 border-white/20 flex items-center justify-center">
                 <span className="text-5xl">🎵</span>
              </div>
           </div>

           {/* Progress Bars */}
           {!isRevealed && timeLeft > 0 && (
             <div className="w-[600px] h-6 bg-gray-700 rounded-full mb-10 overflow-hidden border-2 border-white/20">
                <div 
                   className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all duration-1000 ease-linear"
                   style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
                ></div>
             </div>
           )}

           {!isRevealed && timeLeft <= 0 && (
             <div className="w-[600px] h-6 bg-gray-700 rounded-full mb-10 overflow-hidden border-2 border-white/20">
                <div 
                   className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000 ease-linear"
                   style={{ width: `${(guessingTime / GUESS_LIMIT) * 100}%` }}
                ></div>
             </div>
           )}

           {!isRevealed ? (
             <div className="text-center">
               <h2 className="text-6xl font-black text-white mb-6 tracking-widest drop-shadow-xl">
                 {timeLeft > 0 ? "LISTENING..." : `GUESS NOW: ${guessingTime}s`}
               </h2>
               <p className="text-3xl text-cyan-300 font-bold">
                  {isMovieSoundtrack ? 'Guess the Movie/Show!' : 'Guess the Song & Artist'}
               </p>
               <div className="mt-12 bg-slate-800 px-10 py-4 rounded-full inline-block border-2 border-white/20">
                 <span className="text-xl text-gray-300">Press <span className="font-bold text-white mx-1">OK</span> to Reveal</span>
               </div>
             </div>
           ) : (
             <div className="text-center w-full max-w-5xl">
               <div className="bg-slate-900 border-4 border-slate-700 p-10 rounded-3xl mb-10 shadow-2xl">
                  {isMovieSoundtrack && (
                    <span className="block text-xl uppercase tracking-widest text-gray-400 mb-2">Movie / Show</span>
                  )}
                  {/* ENORMT RESULTAT */}
                  <h2 className="text-7xl font-black text-magic-cyan mb-4 leading-tight">
                    {question.answerReveal?.title}
                  </h2>
                  <h3 className="text-5xl font-bold text-white/90">
                    {question.answerReveal?.artist}
                    {question.answerReveal?.year && (
                      <span className="ml-4 text-white/50 font-normal">({question.answerReveal.year})</span>
                    )}
                  </h3>
               </div>
               
               <p className="text-xl uppercase tracking-[0.3em] text-gray-400 mb-8 font-bold">Rate Your Answer</p>
               
               <div className="flex justify-center gap-12">
                 <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-lg-red flex items-center justify-center text-4xl mb-3 shadow-lg border-4 border-white/10">❌</div>
                    <span className="font-black text-2xl text-red-400">0%</span>
                 </div>
                 
                 {canUseHalfPoints && (
                   <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-lg-yellow flex items-center justify-center text-4xl mb-3 shadow-lg border-4 border-white/10">⚖️</div>
                      <span className="font-black text-2xl text-yellow-400">50%</span>
                   </div>
                 )}

                 <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-lg-green flex items-center justify-center text-4xl mb-3 shadow-lg border-4 border-white/10">✅</div>
                    <span className="font-black text-2xl text-green-400">100%</span>
                 </div>
               </div>
             </div>
           )}
        </div>
      )}

      {/* ---------------- VISUAL / TEXT SEQUENCE ---------------- */}
      {(question.mediaType === 'image' || isImageSequence || isTextSequence) && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-4 relative">
           
           {/* TEXT SEQUENCE (Career Path) */}
           {isTextSequence && question.clubList && (
             <div className="w-full max-w-[90vw] mb-12 p-8 flex flex-wrap items-center justify-center gap-6 bg-slate-900/90 rounded-[2rem] border-2 border-slate-600 shadow-2xl mx-auto">
               {question.clubList.map((club, idx) => (
                 <React.Fragment key={idx}>
                   <div className="px-8 py-4 rounded-full bg-slate-800 border-2 border-slate-500 font-bold text-3xl text-cyan-100 text-center shadow-md">
                     {club}
                   </div>
                   {idx < question.clubList!.length - 1 && (
                     <div className="text-4xl text-yellow-400 opacity-80 font-bold">→</div>
                   )}
                 </React.Fragment>
               ))}
             </div>
           )}

           {/* WORLD MAP */}
          {question.category === 'World Map' ? (
            <div className="absolute inset-0 z-50 bg-[#0B1120] flex flex-col">
               <div className="bg-black/90 p-6 text-center z-50 border-b-4 border-slate-800 flex justify-between items-center px-12">
                  <h2 className="text-4xl text-white font-bold">
                    Find: <span className="text-yellow-400 text-5xl ml-2">{question.correct_answer}</span>
                  </h2>
                  {currentPlayer && (
                    <div className="flex items-center space-x-4 opacity-80 scale-75 origin-right">
                       <span className="text-3xl">{currentPlayer.avatar}</span>
                       <span className="text-2xl font-bold">{currentPlayer.name}</span>
                    </div>
                  )}
               </div>

               <div className="flex-1 w-full h-full">
                  <InteractiveMap onCountryClick={handleMapClick} />
				  {mapFeedback && (
                    <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                      <div className={`
                        transform scale-125 p-16 rounded-[3rem] border-8 shadow-2xl text-center max-w-4xl
                        ${mapFeedback.correct 
                          ? 'bg-green-700 border-green-400 text-white' 
                          : 'bg-red-700 border-red-400 text-white'}
                      `}>
                        <div className="text-9xl mb-6 filter drop-shadow-lg">
                          {mapFeedback.correct ? '✅' : '❌'}
                        </div>
                        <h1 className="text-7xl font-black uppercase tracking-tighter mb-6 drop-shadow-md">
                          {mapFeedback.correct ? 'CORRECT!' : 'WRONG!'}
                        </h1>
                        <div className="text-3xl font-bold opacity-90 space-y-4">
                          <p>You clicked:</p>
                          <p className="text-5xl text-yellow-300 uppercase underline decoration-4 underline-offset-8">
                            {mapFeedback.clicked}
                          </p>
                          {!mapFeedback.correct && (
                            <div className="mt-8 pt-8 border-t-4 border-white/20">
                              <p className="text-2xl">Correct answer:</p>
                              <p className="text-4xl font-extrabold">{question.correct_answer}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
               </div>
            </div>

          ) : (
            question.imageUrl && (
              <img
                src={question.imageUrl}
                alt="Visual"
                className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-2xl border-4 border-white/10 mx-auto"
              />
            )
          )}

           {/* Timer Bar */}
           {!isRevealed && !showResult && (
             <div className="w-[600px] h-6 bg-gray-700 rounded-full mb-8 overflow-hidden border-2 border-white/20 mt-8">
                <div 
                   className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-1000 ease-linear"
                   style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
                ></div>
             </div>
           )}

           {/* HONOR SYSTEM REVEAL (Geo Flags/Capitals) */}
           {isHonorSystem && !isRevealed && (
             <div className="text-center mt-4">
               <h2 className="text-5xl font-black text-white mb-6 tracking-widest drop-shadow-lg">
                 {question.question}
               </h2>
               <div className="bg-slate-800 px-10 py-4 rounded-full inline-block border-2 border-white/20">
                 <span className="text-xl text-gray-300">Press <span className="font-bold text-white mx-1">OK</span> to Reveal</span>
               </div>
             </div>
           )}

           {isHonorSystem && isRevealed && (
             <div className="text-center w-full max-w-4xl">
               <div className="bg-slate-900 border-4 border-emerald-500 p-8 rounded-3xl mb-8 shadow-2xl">
                  {question.infoText && (
                    <div className="text-3xl text-gray-300 mb-3 font-bold">{question.infoText}</div>
                  )}
                  <h2 className="text-6xl font-black text-emerald-400 mb-3 leading-tight">
                    {question.answerReveal?.title}
                  </h2>
                  <h3 className="text-3xl font-bold text-white/70 uppercase tracking-widest">
                    {question.answerReveal?.artist}
                  </h3>
               </div>
               
               <div className="flex justify-center gap-12">
                 <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-lg-red flex items-center justify-center text-4xl mb-2 shadow-lg">❌</div>
                 </div>
                 {canUseHalfPoints && (
                   <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-lg-yellow flex items-center justify-center text-4xl mb-2 shadow-lg">⚖️</div>
                   </div>
                 )}
                 <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-lg-green flex items-center justify-center text-4xl mb-2 shadow-lg">✅</div>
                 </div>
               </div>
             </div>
           )}

           {/* MULTIPLE CHOICE (Movie Posters) */}
           {isMultipleChoice && (
              <div className="w-full max-w-6xl">
                 <h2 className="text-4xl font-black text-white mb-8 drop-shadow-md text-center">{question.question}</h2>
                 <div className="grid grid-cols-2 gap-8 px-4">
                    {question.all_answers.map((ans, idx) => {
                      const config = colors[idx];
                      let containerClass = "bg-slate-900/90 border-l-[12px] text-white";
                      let borderColor = config.border;
                      
                      if (showResult) {
                         if (idx === correctIndex) {
                           containerClass = "bg-green-700 text-white border-l-[12px] border-white";
                           borderColor = "border-white";
                         } else if (idx === selectedIdx) {
                           containerClass = "bg-red-700 text-white border-l-[12px] border-white opacity-90";
                         } else {
                           containerClass = "bg-black/60 opacity-30 border-gray-700 text-gray-500";
                         }
                      } else if (selectedIdx === idx) {
                         containerClass = "bg-white/20 border-white text-white";
                      }

                      return (
                        <div key={idx} className={`relative h-28 rounded-r-3xl flex items-center px-10 transition-colors duration-200 ${containerClass} ${borderColor}`}>
                           <div className={`absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-4 border-white/30 shadow-xl flex items-center justify-center ${config.bg}`}>
                           </div>
                           <span className="text-4xl font-black ml-6 tracking-wide">{ans}</span>
                        </div>
                      );
                    })}
                 </div>
              </div>
           )}
        </div>
      )}


      {/* ---------------- TEXT ONLY LAYOUT ---------------- */}
      {question.mediaType === 'text' && (
        <>
          {!showResult && (
             <div className="w-full h-3 bg-gray-800 fixed top-32 left-0 z-10">
               <div 
                 className="h-full bg-gradient-to-r from-red-500 to-yellow-400 transition-all duration-1000 ease-linear"
                 style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
               ></div>
             </div>
          )}

          <div className="flex-1 flex items-center justify-center p-8 text-center z-10">
            <div className="bg-slate-900 p-16 rounded-[3rem] max-w-7xl border-4 border-slate-700 shadow-2xl">
              {showResult && timeLeft <= 0 && selectedIdx === null && (
                 <div className="text-red-500 font-black text-5xl mb-6">TIME'S UP!</div>
              )}
              {/* ENORM FRÅGETEXT */}
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight text-white drop-shadow-xl">
                {question.question}
              </h2>
            </div>
          </div>

          <div className="p-8 pb-16 z-10">
            <div className="grid grid-cols-2 gap-10 max-w-[90vw] mx-auto">
              {question.all_answers.map((ans, idx) => {
                const config = colors[idx];
                let containerClass = "bg-slate-900 border-l-[16px] text-white";
                let borderColor = config.border;
                
                if (showResult) {
                   if (idx === correctIndex) {
                     containerClass = "bg-green-700 text-white border-l-[16px] border-white";
                     borderColor = "border-white";
                   } else if (idx === selectedIdx) {
                     containerClass = "bg-red-700 text-white border-l-[16px] border-white opacity-90";
                   } else {
                     containerClass = "bg-black/50 opacity-30 border-gray-700 text-gray-500";
                   }
                } else if (selectedIdx === idx) {
                   containerClass = "bg-white/20 border-white text-white";
                }

                return (
                  <div key={idx} className={`relative h-40 rounded-r-[2rem] flex items-center px-12 transition-colors duration-200 ${containerClass} ${borderColor}`}>
                    <div className={`absolute -left-8 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-4 border-white/30 shadow-xl flex items-center justify-center ${config.bg}`}></div>
                    <span className="text-3xl md:text-4xl font-bold ml-8 drop-shadow-md leading-snug">{ans}</span>
                  </div>
                );
              })}
            </div>
            
            {!showResult && (
              <div className="flex justify-center mt-12 space-x-16 text-white/60 text-lg uppercase tracking-[0.2em] font-bold">
                  <div className="flex items-center"><span className="w-5 h-5 rounded-full bg-lg-red mr-4"></span> Select</div>
                  <div className="flex items-center"><span className="w-5 h-5 rounded-full bg-lg-green mr-4"></span> Select</div>
                  <div className="flex items-center"><span className="w-5 h-5 rounded-full bg-lg-yellow mr-4"></span> Select</div>
                  <div className="flex items-center"><span className="w-5 h-5 rounded-full bg-lg-blue mr-4"></span> Select</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};