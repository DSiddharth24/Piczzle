import React from 'react';
import { Eye, EyeOff, Volume2, VolumeX, Sliders, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';
import { soundFx } from '../lib/audio';

interface ControlPanelProps {
  showLandmarks: boolean;
  setShowLandmarks: (show: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  applyGrainFilter: boolean;
  setApplyGrainFilter: (apply: boolean) => void;
  onOpenHelp: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  showLandmarks,
  setShowLandmarks,
  isMuted,
  setIsMuted,
  applyGrainFilter,
  setApplyGrainFilter,
  onOpenHelp,
}) => {
  const toggleMute = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-40 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 bg-black/70 border border-zinc-800/80 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none flex items-center gap-1.5">
            Piczzle
            <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-400 bg-purple-950/80 border border-purple-800/50 px-1.5 py-0.2 rounded-full">
              AI
            </span>
          </h1>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 bg-black/70 border border-zinc-800/80 backdrop-blur-md p-1.5 rounded-2xl shadow-xl pointer-events-auto">
        <button
          onClick={() => setShowLandmarks(!showLandmarks)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            showLandmarks
              ? 'bg-purple-950/80 border-purple-600/80 text-purple-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Hand Landmarks Debug Overlay"
        >
          {showLandmarks ? <Eye className="w-3.5 h-3.5 text-purple-300" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">Landmarks</span>
        </button>

        <button
          onClick={() => setApplyGrainFilter(!applyGrainFilter)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            applyGrainFilter
              ? 'bg-purple-950/80 border-purple-600/80 text-purple-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle B&W Film Grain Filter"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Grain Filter</span>
        </button>

        <button
          onClick={toggleMute}
          className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
          title={isMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
          title="Gesture Guide & Instructions"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
