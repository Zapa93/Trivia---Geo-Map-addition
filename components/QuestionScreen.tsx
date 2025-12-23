import React, { useState, useEffect, useRef } from 'react';
import { ProcessedQuestion } from '../types';
import { useTVNavigation } from '../hooks/useTVNavigation';
import { InteractiveMap } from './InteractiveMap';

interface QuestionScreenProps {
  question: ProcessedQuestion;
  onAnswer: (scoreMultiplier: number) => void; 
  onBack?: () => void;
  playCorrect: () => void;
  playWrong: () => void;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({ 
  question, 
  onAnswer, 
  onBack,
  playCorrect,
  playWrong 
}) => {
  const [mapFeedback, setMapFeedback] = useState<{ correct: boolean; clicked: string } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  
  // Reveal Mode States (Used for Audio & Honor System)
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Timers
  const TIMER_DURATION = question.timerDuration || (question.mediaType === 'text' ? 20 : 15);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  
  // Secondary Timer (Audio Guessing Phase)
  const GUESS_LIMIT = 15;
  const [guessingTime, setGuessingTime] = useState(GUESS_LIMIT);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Checks
  const isMovieSoundtrack = question.categoryId === 'music_movies';
  const isMultipleChoice = question.type === 'multiple' || question.type === 'text';
  const isHonorSystem = question.type === 'honor-system' || question.type === 'music';
  
  const isImageSequence = question.mediaType === 'image_sequence';
  const isTextSequence = question.mediaType === 'text_sequence' || question.clubList !== undefined;

  // Rule: Only Music (excluding soundtracks) gets the 50% option
  const canUseHalfPoints = question.type === 'music' && !isMovieSoundtrack;

  // --- AUDIO CLEANUP (Bug Fix) ---
  // Forcefully stop any playing audio when the question ID changes or component unmounts.
  // This prevents music from "bleeding" into text questions.
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
    // Only attempt to play if it's explicitly an AUDIO question
    if (question.mediaType === 'audio' && question.audioUrl) {
      // Clean up previous instance just in case
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }

      const audio = new Audio(question.audioUrl);
      audio.volume = 1.0; // Enforce Max Volume
      audioRef.current = audio;

      audio.onended = () => {
        setTimeLeft(0);
      };

      // Ensure explicit play
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
      // STOP MUSIC HERE: Ensure music stops exactly when the first timer ends
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

  // --- MULTIPLE CHOICE TIMER (Text & Movie Posters) ---
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
      onAnswer(0); // Fail
    }, 3000);
  };

  const handleMapClick = (countryName: string) => {
    if (showResult) return;

    console.log("Klickade på:", countryName);
    
    // Kolla om det var rätt direkt (för feedbackens skull)
    const isCorrect = countryName === question.correct_answer;

    // 1. SPARA FEEDBACK (Så vi kan visa skylten)
    setMapFeedback({
      correct: isCorrect,
      clicked: countryName
    });

    // 2. HANTERA POÄNG & LJUD (Din gamla logik)
    const idx = question.all_answers.indexOf(countryName);
    
    if (idx !== -1) {
      // Det var ett av alternativen (Rätt eller "officiellt" fel)
      handleTextSelection(idx);
    } else {
      // Det var ett helt fel land (t.ex. Madagaskar)
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

  // Navigation Logic
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
      
      {/* Background with reduced complexity */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900 pointer-events-none"></div>

      {/* Correct Answer Flash (Multiple Choice) */}
      {showResult && selectedIdx === correctIndex && (
         <div className="absolute inset-0 bg-green-500/20 z-0 animate-pulse pointer-events-none"></div>
      )}

      {/* Header */}
      <div className="p-8 flex justify-between items-end border-b border-white/10 bg-black/40 z-10">
        <div className="flex flex-col">
          <span className="text-magic-cyan font-bold tracking-[0.2em] uppercase mb-1 text-xl">{question.category}</span>
          <span className="text-purple-200 text-sm uppercase tracking-wide font-semibold">{question.difficulty}</span>
        </div>
        <div className="text-7xl font-mono font-black text-white">
          ${question.pointValue}
        </div>
      </div>

      {/* ---------------- AUDIO MODE ---------------- */}
      {question.mediaType === 'audio' && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-12">
           
           <div className={`
              w-64 h-64 rounded-full border-8 border-slate-800 bg-black relative flex items-center justify-center mb-8
              ${!isRevealed && timeLeft > 0 ? 'animate-spin' : ''}
           `} style={{ animationDuration: '4s' }}>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-magic-pink to-purple-600 border-4 border-white/20 flex items-center justify-center">
                 <span className="text-2xl">🎵</span>
              </div>
           </div>

           {!isRevealed && timeLeft > 0 && (
             <div className="w-96 h-4 bg-gray-700 rounded-full mb-8 overflow-hidden border border-white/20">
                <div 
                   className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all duration-1000 ease-linear"
                   style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
                ></div>
             </div>
           )}

           {!isRevealed && timeLeft <= 0 && (
             <div className="w-96 h-4 bg-gray-700 rounded-full mb-8 overflow-hidden border border-white/20">
                <div 
                   className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000 ease-linear"
                   style={{ width: `${(guessingTime / GUESS_LIMIT) * 100}%` }}
                ></div>
             </div>
           )}

           {!isRevealed ? (
             <div className="text-center">
               <h2 className="text-4xl font-black text-white mb-4 tracking-widest">
                 {timeLeft > 0 ? "LISTENING..." : `GUESS NOW: ${guessingTime}s`}
               </h2>
               <p className="text-xl text-cyan-300">
                  {isMovieSoundtrack ? 'Guess the Movie/Show!' : 'Guess the Song & Artist'}
               </p>
               <div className="mt-8 bg-slate-800 px-8 py-3 rounded-full inline-block border border-white/20">
                 Press <span className="font-bold text-white">OK</span> to Reveal
               </div>
             </div>
           ) : (
             <div className="text-center">
               <div className="bg-slate-900 border-2 border-slate-700 p-8 rounded-2xl mb-8 min-w-[500px]">
                  {isMovieSoundtrack && (
                    <span className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Movie / Show</span>
                  )}
                  <h2 className="text-4xl font-black text-magic-cyan mb-2">
                    {question.answerReveal?.title}
                  </h2>
                  <h3 className="text-2xl font-semibold text-white/80">
                    {question.answerReveal?.artist}
                    {question.answerReveal?.year && (
                      <span className="ml-3 text-white/50 font-normal">({question.answerReveal.year})</span>
                    )}
                  </h3>
               </div>
               
               <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-6">Rate Your Answer</p>
               
               <div className="flex justify-center gap-6">
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-lg-red flex items-center justify-center text-2xl mb-2">❌</div>
                    <span className="font-bold text-red-400">0%</span>
                 </div>
                 
                 {canUseHalfPoints && (
                   <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-lg-yellow flex items-center justify-center text-2xl mb-2">⚖️</div>
                      <span className="font-bold text-yellow-400">50%</span>
                   </div>
                 )}

                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-lg-green flex items-center justify-center text-2xl mb-2">✅</div>
                    <span className="font-bold text-green-400">100%</span>
                 </div>
               </div>
             </div>
           )}
        </div>
      )}

      {/* ---------------- VISUAL LAYOUTS (Image / Sequence / Text Sequence) ---------------- */}
      {(question.mediaType === 'image' || isImageSequence || isTextSequence) && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-4">
           
           {/* TEXT SEQUENCE (Football Career Path) */}
           {isTextSequence && question.clubList && (
             <div className="w-full max-w-7xl mb-8 p-6 flex flex-wrap items-center justify-center gap-4 bg-slate-900 rounded-3xl border border-slate-700 mx-auto">
               {question.clubList.map((club, idx) => (
                 <React.Fragment key={idx}>
                   <div className="px-6 py-3 rounded-full bg-slate-800 border border-slate-600 font-bold text-xl md:text-2xl text-cyan-100 text-center">
                     {club}
                   </div>
                   {idx < question.clubList!.length - 1 && (
                     <div className="text-3xl text-yellow-400 opacity-80 font-bold">→</div>
                   )}
                 </React.Fragment>
               ))}
             </div>
           )}

			<div className="text-white text-xl bg-purple-600 p-2 m-2">
            KATEGORI ID ÄR: "{question.category}"
          </div>

           {/* VISUAL AREA: Karta eller Bild */}
            {/* KOLL: Är det en kartfråga? (Nu med rätt ID!) */}
          {/* KOLL: Är det en kartfråga? */}
          {question.category === 'World Map' ? (
            
            /* FULLSKÄRMS-LÄGE FÖR KARTA */
            /* "absolute inset-0" gör att den täcker hela sin förälder */
            /* z-50 gör att den hamnar ovanpå knappar och annat */
            <div className="absolute inset-0 z-50 bg-[#0B1120] flex flex-col">
               
               {/* Liten header så man ser frågan */}
               <div className="bg-black/80 p-4 text-center z-50">
                  <h2 className="text-3xl text-white font-bold">
                    Hitta: <span className="text-yellow-400">{question.correct_answer}</span>
                  </h2>
               </div>

               {/* Själva kartan fyller resten */}
               <div className="flex-1 w-full h-full">
                  <InteractiveMap onCountryClick={handleMapClick} />
				  {mapFeedback && (
                    <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                      
                      <div className={`
                        transform scale-110 p-12 rounded-3xl border-8 shadow-2xl text-center max-w-3xl
                        ${mapFeedback.correct 
                          ? 'bg-green-600 border-green-400 text-white' 
                          : 'bg-red-600 border-red-400 text-white'}
                      `}>
                        {/* Ikon / Rubrik */}
                        <div className="text-8xl mb-4 filter drop-shadow-lg">
                          {mapFeedback.correct ? '✅' : '❌'}
                        </div>
                        
                        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4 drop-shadow-md">
                          {mapFeedback.correct ? 'RÄTT!' : 'FEL!'}
                        </h1>

                        {/* Info text */}
                        <div className="text-2xl font-bold opacity-90 space-y-2">
                          <p>Du klickade på:</p>
                          <p className="text-4xl text-yellow-300 uppercase underline decoration-4 underline-offset-4">
                            {mapFeedback.clicked}
                          </p>
                          
                          {!mapFeedback.correct && (
                            <div className="mt-6 pt-6 border-t-2 border-white/20">
                              <p className="text-xl">Rätt svar var:</p>
                              <p className="text-3xl font-extrabold">{question.correct_answer}</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
               </div>

               {/* En "Avbryt/Tillbaka"-knapp om man ångrar sig (Valfritt) */}
               {/* <button className="absolute top-4 left-4 bg-red-600 text-white p-2 rounded">Avbryt</button> */}
            </div>

          ) : (
            
            /* ANNARS: Visa vanlig bild */
            question.imageUrl && (
              <img
                src={question.imageUrl}
                alt="Visual"
                className="max-h-[50vh] max-w-full object-contain rounded-xl shadow-2xl border-4 border-white/10 mx-auto"
              />
            )

          )}

           {/* Context Text */}
           {question.infoText && !isRevealed && !showResult && (
             <div className="mb-6 text-2xl font-bold text-yellow-400 bg-black/80 px-6 py-2 rounded-full border border-yellow-400/30">
               {question.infoText}
             </div>
           )}

           {/* Timer Bar */}
           {!isRevealed && !showResult && (
             <div className="w-96 h-3 bg-gray-700 rounded-full mb-6 overflow-hidden border border-white/20">
                <div 
                   className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-1000 ease-linear"
                   style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
                ></div>
             </div>
           )}

           {/* ---- HONOR SYSTEM REVEAL (Geo Flags/Capitals/Career) ---- */}
           {isHonorSystem && !isRevealed && (
             <div className="text-center">
               <h2 className="text-4xl font-black text-white mb-4 tracking-widest">
                 {question.question}
               </h2>
               <div className="mt-4 bg-slate-800 px-8 py-3 rounded-full inline-block border border-white/20">
                 Press <span className="font-bold text-white">OK</span> to Reveal
               </div>
             </div>
           )}

           {isHonorSystem && isRevealed && (
             <div className="text-center">
               <div className="bg-slate-900 border-2 border-emerald-500 p-6 rounded-2xl mb-6 min-w-[500px]">
                  {question.infoText && (
                    <div className="text-xl text-gray-300 mb-2">{question.infoText}</div>
                  )}
                  <h2 className="text-5xl font-black text-emerald-400 mb-2">
                    {question.answerReveal?.title}
                  </h2>
                  <h3 className="text-xl font-semibold text-white/60 uppercase tracking-widest">
                    {question.answerReveal?.artist}
                  </h3>
               </div>
               
               <div className="flex justify-center gap-6">
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-lg-red flex items-center justify-center text-2xl mb-2">❌</div>
                 </div>
                 
                 {canUseHalfPoints && (
                   <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-lg-yellow flex items-center justify-center text-2xl mb-2">⚖️</div>
                   </div>
                 )}

                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-lg-green flex items-center justify-center text-2xl mb-2">✅</div>
                 </div>
               </div>
             </div>
           )}

           {/* ---- MULTIPLE CHOICE (Movie Posters / Text) ---- */}
           {isMultipleChoice && (
              <>
                 <h2 className="text-3xl font-black text-white mb-6 drop-shadow-md">{question.question}</h2>
                 <div className="grid grid-cols-2 gap-6 w-full max-w-5xl px-8">
                    {question.all_answers.map((ans, idx) => {
                      const config = colors[idx];
                      let containerClass = "bg-slate-900/90 border-l-8 text-white/90";
                      let borderColor = config.border;
                      
                      if (showResult) {
                         if (idx === correctIndex) {
                           containerClass = "bg-green-700 text-white border-l-8 border-white";
                           borderColor = "border-white";
                         } else if (idx === selectedIdx) {
                           containerClass = "bg-red-700 text-white border-l-8 border-white opacity-90";
                         } else {
                           containerClass = "bg-black/40 opacity-30 border-gray-700 text-gray-500";
                         }
                      } else if (selectedIdx === idx) {
                         containerClass = "bg-white/20 border-white text-white";
                      } else {
                          containerClass += " hover:bg-white/10";
                      }

                      return (
                        <div key={idx} className={`relative h-20 rounded-r-2xl flex items-center px-6 transition-colors duration-200 ${containerClass} ${borderColor}`}>
                           <div className={`absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-white/20 shadow-xl flex items-center justify-center ${config.bg}`}>
                           </div>
                           <span className="text-2xl font-bold ml-4">{ans}</span>
                        </div>
                      );
                    })}
                 </div>
              </>
           )}
        </div>
      )}


      {/* ---------------- TEXT ONLY LAYOUT ---------------- */}
      {question.mediaType === 'text' && (
        <>
          {!showResult && (
             <div className="w-full h-2 bg-gray-800 fixed top-0 left-0 z-50">
               <div 
                 className="h-full bg-gradient-to-r from-red-500 to-yellow-400 transition-all duration-1000 ease-linear"
                 style={{ width: `${(timeLeft / TIMER_DURATION) * 100}%` }}
               ></div>
             </div>
          )}

          <div className="flex-1 flex items-center justify-center p-12 text-center z-10">
            <div className="bg-slate-900 p-12 rounded-[2rem] max-w-6xl border-2 border-slate-700 shadow-2xl">
              {showResult && timeLeft <= 0 && selectedIdx === null && (
                 <div className="text-red-500 font-black text-4xl mb-4">TIME'S UP!</div>
              )}
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-white drop-shadow-md">
                {question.question}
              </h2>
            </div>
          </div>

          <div className="p-8 pb-12 z-10">
            <div className="grid grid-cols-2 gap-8 max-w-7xl mx-auto">
              {question.all_answers.map((ans, idx) => {
                const config = colors[idx];
                let containerClass = "bg-slate-900 border-l-8 text-white/90";
                let borderColor = config.border;
                
                if (showResult) {
                   if (idx === correctIndex) {
                     containerClass = "bg-green-700 text-white border-l-8 border-white";
                     borderColor = "border-white";
                   } else if (idx === selectedIdx) {
                     containerClass = "bg-red-700 text-white border-l-8 border-white opacity-90";
                   } else {
                     containerClass = "bg-black/40 opacity-30 border-gray-700 text-gray-500";
                   }
                } else if (selectedIdx === idx) {
                   containerClass = "bg-white/20 border-white text-white";
                } else {
                    containerClass += " hover:bg-white/10";
                }

                return (
                  <div key={idx} className={`relative h-32 md:h-40 rounded-r-3xl flex items-center px-10 transition-colors duration-200 ${containerClass} ${borderColor}`}>
                    <div className={`absolute -left-7 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-4 border-white/20 shadow-xl flex items-center justify-center ${config.bg}`}></div>
                    <span className="text-2xl md:text-3xl font-bold ml-6 drop-shadow-md leading-snug">{ans}</span>
                  </div>
                );
              })}
            </div>
            
            {!showResult && (
              <div className="flex justify-center mt-12 space-x-12 text-white/60 text-sm uppercase tracking-[0.2em] font-bold">
                  <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-lg-red mr-3"></span> Select</div>
                  <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-lg-green mr-3"></span> Select</div>
                  <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-lg-yellow mr-3"></span> Select</div>
                  <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-lg-blue mr-3"></span> Select</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};