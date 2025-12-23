import { useRef, useEffect, useCallback, useState } from 'react';
import { AppState } from '../types';

export const useAudio = () => {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const correctRef = useRef<HTMLAudioElement | null>(null);
  const wrongRef = useRef<HTMLAudioElement | null>(null);
  
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [shouldPlayMusic, setShouldPlayMusic] = useState(false);

  useEffect(() => {
    // Randomize track 1-4 on mount
    const trackNum = Math.floor(Math.random() * 4) + 1;
    
    // Initialize Music with Relative Path
    const bgAudio = new Audio(`./sounds/bg-music${trackNum}.mp3`);
    bgAudio.loop = true;
    bgAudio.volume = 0.3;
    musicRef.current = bgAudio;

    // Initialize SFX with Relative Paths
    correctRef.current = new Audio('./sounds/correct.mp3');
    correctRef.current.volume = 1.0;
    
    wrongRef.current = new Audio('./sounds/wrong.mp3');
    wrongRef.current.volume = 1.0;

    return () => {
      bgAudio.pause();
      musicRef.current = null;
    };
  }, []);

  // Effect to handle playback based on policies and state
  useEffect(() => {
    if (musicRef.current) {
      if (audioEnabled && shouldPlayMusic) {
        const playPromise = musicRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("BG Music Autoplay blocked:", error);
            });
        }
      } else {
        musicRef.current.pause();
      }
    }
  }, [audioEnabled, shouldPlayMusic]);

  const enableAudio = useCallback(() => {
    if (!audioEnabled) {
      setAudioEnabled(true);
      // Try to start music immediately if state dictates
      if (musicRef.current && shouldPlayMusic) {
         musicRef.current.play().catch(e => console.warn("Audio unlock failed", e));
      }
    }
  }, [audioEnabled, shouldPlayMusic]);

  // Updated to receive AppState to enforce rules
  const manageMusicState = useCallback((state: AppState) => {
    if (state === AppState.SETUP || state === AppState.CATEGORY_SELECT) {
      setShouldPlayMusic(true);
    } else {
      setShouldPlayMusic(false); // Silence for Board/Question/Loading/GameOver
      if (musicRef.current) {
          musicRef.current.currentTime = 0; // Reset to start
      }
    }
  }, []);

  const playCorrect = useCallback(() => {
    if (correctRef.current && audioEnabled) {
      correctRef.current.currentTime = 0;
      correctRef.current.play().catch(e => console.warn("SFX blocked:", e));
    }
  }, [audioEnabled]);

  const playWrong = useCallback(() => {
    if (wrongRef.current && audioEnabled) {
      wrongRef.current.currentTime = 0;
      wrongRef.current.play().catch(e => console.warn("SFX blocked:", e));
    }
  }, [audioEnabled]);

  return { 
    enableAudio, 
    manageMusicState, 
    playCorrect, 
    playWrong 
  };
};