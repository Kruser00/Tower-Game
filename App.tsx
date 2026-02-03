import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './services/GameEngine';
import GameOverlay from './components/GameOverlay';
import { GameState } from './types';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [multiplier, setMultiplier] = useState(1);

  // Load High Score on mount
  useEffect(() => {
    const saved = localStorage.getItem('isfahan-stack-highscore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Initialize Game Engine
  useEffect(() => {
    if (!containerRef.current) return;

    if (engineRef.current) return;

    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;

    engine.onScoreUpdate = (newScore, newMultiplier) => {
      setScore(newScore);
      setMultiplier(newMultiplier);
    };
    
    engine.onGameOver = (finalScore) => {
      setScore(finalScore);
      setGameState(GameState.GAME_OVER);
      
      // Update High Score if needed
      setHighScore(prev => {
        if (finalScore > prev) {
          localStorage.setItem('isfahan-stack-highscore', finalScore.toString());
          return finalScore;
        }
        return prev;
      });
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startGame();
      setGameState(GameState.PLAYING);
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startGame();
      setGameState(GameState.PLAYING);
    }
  }, []);

  const handleRevive = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reviveGame();
      setGameState(GameState.PLAYING);
    }
  }, []);

  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent interaction if clicking on UI
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    if (gameState === GameState.PLAYING && engineRef.current) {
      engineRef.current.placeBlock();
    }
  }, [gameState]);

  // Dynamic Background Logic
  // Sunset: #ff9966 -> #ff5e62 (0-10)
  // Twilight: #662D8C -> #ED1E79 (10-25)
  // Night: #0F2027 -> #203A43 -> #2C5364 (25+)
  const getBackgroundStyle = () => {
    if (score < 10) {
      // Warm Sunset
      return `linear-gradient(to bottom, #ff9966, #ff5e62)`;
    } else if (score < 25) {
      // Twilight Gradient
      return `linear-gradient(to bottom, #662D8C, #ED1E79)`;
    } else {
      // Deep Night / Space
      return `linear-gradient(to bottom, #0F2027, #203A43, #2C5364)`;
    }
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden transition-all duration-[2000ms]"
      style={{ background: getBackgroundStyle() }}
    >
      {/* 3D Canvas Container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full cursor-pointer"
        onMouseDown={handleInteraction}
        onTouchStart={handleInteraction}
      />

      {/* UI Overlay */}
      <GameOverlay 
        score={score} 
        highScore={highScore}
        multiplier={multiplier}
        gameState={gameState} 
        onStart={handleStart}
        onRestart={handleRestart}
        onRevive={handleRevive}
      />
    </div>
  );
}

export default App;