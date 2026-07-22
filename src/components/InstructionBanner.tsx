import React from 'react';
import { Hand, Grab, Sparkles, CheckCircle2 } from 'lucide-react';
import { GameMode, DetectedHand } from '../types';

interface InstructionBannerProps {
  mode: GameMode;
  hands: DetectedHand[];
}

export const InstructionBanner: React.FC<InstructionBannerProps> = ({ mode, hands }) => {
  const isPinching = hands.some(h => h.isPinching);

  if (mode === 'framing' || mode === 'capturing') {
    const isPointing = hands.some(h => h.isPointing);

    return (
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none w-full max-w-md px-4">
        <div className="bg-black/75 border border-purple-500/30 rounded-2xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shrink-0">
            {isPointing ? (
              <Sparkles className="w-5 h-5 text-pink-400 animate-pulse" />
            ) : isPinching ? (
              <Grab className="w-5 h-5 animate-pulse" />
            ) : (
              <Hand className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">
              {hands.length >= 2
                ? '2 hands detected: Move fingertips apart/together to resize frame'
                : '1 hand detected: Move index finger to reposition frame'}
            </h4>
            <p className="text-[11px] text-zinc-300 mt-0.5">
              1 finger = Move • 2 fingers = Resize
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'playing') {
    return (
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none w-full max-w-md px-4">
        <div className="bg-black/75 border border-emerald-500/30 rounded-2xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
            <Grab className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">
              Move finger / pinch over pieces to slide them
            </h4>
            <p className="text-[11px] text-zinc-300 mt-0.5">
              Swipe your finger over any adjacent tile to slide it into the empty space
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
