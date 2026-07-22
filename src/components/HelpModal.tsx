import React from 'react';
import { X, Hand, Grab, Sparkles, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-purple-400" /> Hand Gesture Guide
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Piczzle uses MediaPipe Hand Landmarker. Control everything purely with your hands!
        </p>

        <div className="space-y-4">
          {/* Guide Item 1 */}
          <div className="flex gap-4 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl items-start">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl shrink-0">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">1. Point Index Finger to Frame</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Point your index finger to move the square frame smoothly. Point with both hands to size opposite corners of the square crop!
              </p>
            </div>
          </div>

          {/* Guide Item 2 */}
          <div className="flex gap-4 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl items-start">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Grab className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">2. Pinch to Slide Puzzle Tiles</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bring your <strong>Thumb</strong> and <strong>Index finger</strong> tips close together (~1cm apart) over any tile next to the blank space to slide it into place!
              </p>
            </div>
          </div>

          {/* Guide Item 3 */}
          <div className="flex gap-4 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl items-start">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">3. Tap Button for 3s Countdown</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tap <strong>"Create Puzzle from Selection"</strong>. A 3-second countdown will start so you can pose before the picture is captured!
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition"
        >
          Got it, let's play!
        </button>
      </div>
    </div>
  );
};
