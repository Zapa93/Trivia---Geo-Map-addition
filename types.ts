export enum AppState {
  SETUP,
  CATEGORY_SELECT,
  LOADING,
  BOARD,
  QUESTION,
  GAME_OVER
}

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

// The Trivia API Response Format
export interface ApiQuestion {
  id: string;
  category: string;
  difficulty: string;
  question: {
    text: string;
  };
  correctAnswer: string;
  incorrectAnswers: string[];
  tags: string[];
  type: string;
}

// iTunes API Response Format
export interface ItunesTrack {
  trackId: number;
  artistName: string;
  trackName: string;
  previewUrl: string;
  kind: string;
  releaseDate?: string;
  collectionName?: string;
}

export interface ProcessedQuestion {
  id: string;
  category: string; 
  categoryId: string; // Unique Identifier for logic checks (e.g. music_movies)
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  all_answers: string[]; 
  isAnswered: boolean;
  pointValue: number;
  // Multimedia extensions
  mediaType: 'text' | 'audio' | 'image' | 'image_sequence' | 'text_sequence';
  audioUrl?: string;
  imageUrl?: string;
  imageUrls?: string[]; // For sequences like Career Path (Images)
  clubList?: string[]; // For Career Path (Text)
  infoText?: string; // Extra context (e.g. Country Name for capital questions)
  timerDuration?: number;
  answerReveal?: {
    artist: string;
    title: string;
    year?: string;
  };
}

export interface CategoryColumn {
  title: string;
  questions: ProcessedQuestion[];
}

export interface Player {
  id: number;
  name: string;
  avatar: string;
  score: number;
}

export interface TriviaCategory {
  id: string; 
  name: string;
  emoji: string;
}

export enum RemoteKey {
  UP = 'ArrowUp',
  DOWN = 'ArrowDown',
  LEFT = 'ArrowLeft',
  RIGHT = 'ArrowRight',
  ENTER = 'Enter',
  BACK = 'Backspace',
  BACK_ALT = 'Escape',
  RED = 'Red',
  GREEN = 'Green',
  YELLOW = 'Yellow',
  BLUE = 'Blue'
}

export const TV_KEY_CODES: { [key: number]: RemoteKey } = {
  403: RemoteKey.RED,
  404: RemoteKey.GREEN,
  405: RemoteKey.YELLOW,
  406: RemoteKey.BLUE,
  461: RemoteKey.BACK,
  37: RemoteKey.LEFT,
  38: RemoteKey.UP,
  39: RemoteKey.RIGHT,
  40: RemoteKey.DOWN,
  13: RemoteKey.ENTER,
};