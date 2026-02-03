import React, { useState } from 'react';
import { GameState } from '../types';

interface GameOverlayProps {
  score: number;
  highScore: number;
  multiplier: number;
  gameState: GameState;
  onStart: () => void;
  onRestart: () => void;
  onRevive: () => void;
}

const GameOverlay: React.FC<GameOverlayProps> = ({ score, highScore, multiplier, gameState, onStart, onRestart, onRevive }) => {
  const [hasRevived, setHasRevived] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  // Reset local state when returning to menu
  React.useEffect(() => {
    if (gameState === GameState.MENU) {
      setHasRevived(false);
      setIsWatchingAd(false);
    }
  }, [gameState]);

  const handleAdClick = () => {
    setIsWatchingAd(true);
    // Simulate a 2-second ad duration
    setTimeout(() => {
      setIsWatchingAd(false);
      setHasRevived(true);
      onRevive();
    }, 2000);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 z-10">
      
      {/* Score Display - Always Visible during play */}
      <div className={`transition-opacity duration-300 flex flex-col items-center ${gameState === GameState.MENU ? 'opacity-0' : 'opacity-100'}`}>
        <div className="text-6xl font-bold text-white drop-shadow-md tracking-wider">
          {score}
        </div>
        {multiplier > 1 && (
          <div className="mt-2 text-2xl font-black text-yellow-300 drop-shadow-lg animate-pulse" style={{fontFamily: 'Vazirmatn'}}>
            x{multiplier} Combo!
          </div>
        )}
      </div>

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 pointer-events-auto backdrop-blur-sm">
          <h1 className="text-6xl md:text-8xl font-black text-white mb-2 drop-shadow-lg text-center" style={{fontFamily: 'Vazirmatn'}}>
            Stack
          </h1>
          <p className="text-white/90 text-xl mb-6 font-medium">Build to the sky</p>
          
          {highScore > 0 && (
             <div className="mb-8 px-6 py-2 bg-white/20 rounded-lg backdrop-blur text-white font-bold">
               Best: {highScore}
             </div>
          )}

          <button
            onClick={onStart}
            className="px-12 py-4 bg-white text-orange-500 rounded-full text-2xl font-bold shadow-lg hover:scale-105 hover:bg-orange-50 transition-all active:scale-95 mb-4"
          >
            Start
          </button>

          {/* Simulated Donate Button */}
          <button className="text-sm text-white/80 hover:text-white underline mt-4" onClick={() => alert("Link to ZarinPal/IDPay would go here")}>
            Support Developer (ZarinPal)
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-auto backdrop-blur-md transition-all animate-in fade-in zoom-in duration-300">
          <h2 className="text-6xl font-black text-red-100 mb-2 drop-shadow-lg" style={{fontFamily: 'Vazirmatn'}}>
            Bakhti!
          </h2>
          <p className="text-white text-xl mb-6">Game Over</p>
          
          <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md mb-8 text-center border border-white/20 min-w-[200px]">
            <p className="text-white/80 text-sm uppercase tracking-widest mb-1">Final Score</p>
            <p className="text-5xl font-bold text-white mb-4">{score}</p>
            
            <div className="border-t border-white/20 pt-4">
               <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Best Score</p>
               <p className="text-2xl font-bold text-yellow-300">{Math.max(score, highScore)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs px-4">
             {/* Revive Button - Only if not revived yet */}
             {!hasRevived && (
               <button
                onClick={handleAdClick}
                disabled={isWatchingAd}
                className="w-full py-4 bg-purple-600 text-white rounded-xl text-lg font-bold shadow-lg hover:bg-purple-500 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isWatchingAd ? (
                  <span>Loading Ad...</span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                       <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    Watch Ad to Revive
                  </>
                )}
              </button>
             )}

            <button
              onClick={onRestart}
              className="w-full py-4 bg-white text-gray-800 rounded-xl text-lg font-bold shadow-lg hover:bg-gray-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
       {gameState === GameState.MENU && (
         <div className="text-white/60 text-sm font-light mt-auto">
           Tap to start
         </div>
       )}
    </div>
  );
};

export default GameOverlay;