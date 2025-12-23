import React, { useState, useEffect } from 'react';
import { AppState, CategoryColumn, Player, ProcessedQuestion, TriviaCategory } from './types';
import { fetchGameData } from './services/triviaService';
import { LoadingScreen } from './components/LoadingScreen';
import { SetupScreen } from './components/SetupScreen';
import { CategorySelectionScreen } from './components/CategorySelectionScreen';
import { GameBoard } from './components/GameBoard';
import { QuestionScreen } from './components/QuestionScreen';
import { GameOver } from './components/GameOver';
import { useAudio } from './hooks/useAudio';

const ANIMAL_PLAYERS = [
  { name: 'Fox', avatar: '🦊' },
  { name: 'Lion', avatar: '🦁' },
  { name: 'Panda', avatar: '🐼' },
  { name: 'Koala', avatar: '🐨' }
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [categories, setCategories] = useState<CategoryColumn[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [activeQuestion, setActiveQuestion] = useState<ProcessedQuestion | null>(null);

  // Audio System
  const { enableAudio, manageMusicState, playCorrect, playWrong } = useAudio();

  // Manage Background Music based on AppState
  useEffect(() => {
    manageMusicState(appState);
  }, [appState, manageMusicState]);

  const handlePlayerSetup = (playerCount: number) => {
    enableAudio(); // Unlock Context

    // Initialize Players
    const newPlayers: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      name: ANIMAL_PLAYERS[i].name,
      avatar: ANIMAL_PLAYERS[i].avatar,
      score: 0
    }));
    setPlayers(newPlayers);
    setAppState(AppState.CATEGORY_SELECT);
  };

  const handleCategorySelection = async (selectedCategories: TriviaCategory[]) => {
    setAppState(AppState.LOADING);
    
    const data = await fetchGameData(selectedCategories);
    if (data.length === 0) {
       console.error("Failed to load trivia.");
       setAppState(AppState.CATEGORY_SELECT);
       return;
    }
    
    setCategories(data);
    setCurrentTurn(0);
    setAppState(AppState.BOARD);
  };

  const handleQuestionSelect = (question: ProcessedQuestion) => {
    setActiveQuestion(question);
    setAppState(AppState.QUESTION);
  };

  const handleAnswer = (scoreMultiplier: number) => {
    if (!activeQuestion) return;

    // Update Player Score
    setPlayers(prev => prev.map((p, i) => {
      if (i === currentTurn) {
        // Multiplier determines points: 1 = full, 0.5 = half, 0 = loss
        // If wrong (0), subtract full value? Or just 0? Standard jeopardy subtracts.
        // Let's implement: 1.0 = +Value, 0.5 = +Half, 0.0 = -Value
        let change = 0;
        if (scoreMultiplier === 1) change = activeQuestion.pointValue;
        else if (scoreMultiplier === 0.5) change = Math.floor(activeQuestion.pointValue / 2);
        else change = -activeQuestion.pointValue;

        return { ...p, score: p.score + change };
      }
      return p;
    }));

    // Mark Question as Answered
    setCategories(prevCategories => {
      return prevCategories.map(col => {
        if (col.questions.some(q => q.id === activeQuestion.id)) {
           return {
             ...col,
             questions: col.questions.map(q => 
               q.id === activeQuestion.id ? { ...q, isAnswered: true } : q
             )
           };
        }
        return col;
      });
    });

    // Move Turn
    setCurrentTurn(prev => (prev + 1) % players.length);
    setActiveQuestion(null);
    setAppState(AppState.BOARD);
  };

  // Check Game Over
  useEffect(() => {
    if (appState === AppState.BOARD && categories.length > 0) {
      const allAnswered = categories.every(col => 
        col.questions.every(q => q.isAnswered)
      );
      
      if (allAnswered) {
        setAppState(AppState.GAME_OVER);
      }
    }
  }, [appState, categories]);

  const handleRestart = () => {
    setAppState(AppState.SETUP);
    setCategories([]);
    setPlayers([]);
  };

  return (
    <div className="font-sans antialiased text-white min-h-screen relative z-10">
      {appState === AppState.SETUP && <SetupScreen onNext={handlePlayerSetup} />}
      {appState === AppState.CATEGORY_SELECT && (
        <CategorySelectionScreen 
          onStartGame={handleCategorySelection} 
          onBack={() => setAppState(AppState.SETUP)}
        />
      )}
      {appState === AppState.LOADING && <LoadingScreen />}
      {appState === AppState.BOARD && (
        <GameBoard 
          categories={categories}
          players={players}
          currentPlayerIndex={currentTurn}
          onQuestionSelect={handleQuestionSelect}
        />
      )}
      {appState === AppState.QUESTION && activeQuestion && (
        <QuestionScreen 
          question={activeQuestion}
          onAnswer={handleAnswer}
          playCorrect={playCorrect}
          playWrong={playWrong}
        />
      )}
      {appState === AppState.GAME_OVER && (
        <GameOver players={players} onRestart={handleRestart} />
      )}
    </div>
  );
};

export default App;