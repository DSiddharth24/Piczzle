import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, Sparkles, Clock, MoveHorizontal } from 'lucide-react';

interface WinModalProps {
  fullImageUri: string;
  moveCount: number;
  elapsedSeconds: number;
  onPlayAgain: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  fullImageUri,
  moveCount,
  elapsedSeconds,
  onPlayAgain,
}) => {
  useEffect(() => {
    // Trigger festive confetti explosion
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center flex flex-col items-center">
        {/* Trophy Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>

        <h2 className="text-2xl font-extrabold text-white tracking-tight">Puzzle Complete!</h2>
        <p className="text-zinc-400 text-sm mt-1">You solved the webcam gesture puzzle successfully!</p>

        {/* Full Restored Image */}
        <div className="my-6 relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border-2 border-purple-500/50 shadow-xl group">
          <img
            src={fullImageUri}
            alt="Assembled Puzzle"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-center p-3">
            <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Fully Assembled
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 w-full mb-6">
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-purple-400" /> Total Moves
            </div>
            <div className="text-2xl font-bold text-white">{moveCount}</div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> Total Time
            </div>
            <div className="text-2xl font-bold text-white">{formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onPlayAgain}
          className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-purple-600/25 transition active:scale-98 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" /> Play Again with New Photo
        </button>
      </div>
    </div>
  );
};
