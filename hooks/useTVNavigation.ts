import { useEffect, useCallback } from 'react';
import { RemoteKey, TV_KEY_CODES } from '../types';

interface NavigationHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
  onRed?: () => void;
  onGreen?: () => void;
  onYellow?: () => void;
  onBlue?: () => void;
}

export const useTVNavigation = (handlers: NavigationHandlers, dependencies: any[] = []) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    let key = event.key;
    const code = event.keyCode;

    // Map WebOS keycodes
    if (TV_KEY_CODES[code]) {
      // Map enum value to simple string if needed, or just logic
      const mapped = TV_KEY_CODES[code];
      switch(mapped) {
        case RemoteKey.RED: key = 'Red'; break;
        case RemoteKey.GREEN: key = 'Green'; break;
        case RemoteKey.YELLOW: key = 'Yellow'; break;
        case RemoteKey.BLUE: key = 'Blue'; break;
        case RemoteKey.BACK: key = 'Backspace'; break;
      }
    }

    // Dev Simulator mappings
    if (key === 'r' || key === '1') key = 'Red';
    if (key === 'g' || key === '2') key = 'Green';
    if (key === 'y' || key === '3') key = 'Yellow';
    if (key === 'b' || key === '4') key = 'Blue';
    if (key === 'Escape') key = 'Backspace';

    // Prevent default scrolling for arrows
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
    }

    switch (key) {
      case 'ArrowUp': handlers.onUp && handlers.onUp(); break;
      case 'ArrowDown': handlers.onDown && handlers.onDown(); break;
      case 'ArrowLeft': handlers.onLeft && handlers.onLeft(); break;
      case 'ArrowRight': handlers.onRight && handlers.onRight(); break;
      case 'Enter': handlers.onEnter && handlers.onEnter(); break;
      case 'Backspace': handlers.onBack && handlers.onBack(); break;
      case 'Red': handlers.onRed && handlers.onRed(); break;
      case 'Green': handlers.onGreen && handlers.onGreen(); break;
      case 'Yellow': handlers.onYellow && handlers.onYellow(); break;
      case 'Blue': handlers.onBlue && handlers.onBlue(); break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, ...dependencies]);
};
