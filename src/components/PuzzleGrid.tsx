import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, RotateCcw, Sparkles, Camera } from 'lucide-react';
import { PuzzleTile, DetectedHand, SelectionBox } from '../types';
import { BLANK_TILE_ID, GRID_SIZE, TOTAL_TILES, isAdjacent, calculateSolvedCount } from '../lib/puzzle';
import { soundFx } from '../lib/audio';

interface PuzzleGridProps {
  tiles: PuzzleTile[];
  setTiles: React.Dispatch<React.SetStateAction<PuzzleTile[]>>;
  selectionBox: SelectionBox;
  hands: DetectedHand[];
  onSolved: () => void;
  onResetToFraming: () => void;
  moveCount: number;
  setMoveCount: React.Dispatch<React.SetStateAction<number>>;
  startTime: number | null;
}

export const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  tiles,
  setTiles,
  selectionBox,
  hands,
  onSolved,
  onResetToFraming,
  moveCount,
  setMoveCount,
  startTime,
}) => {
  const solvedCount = calculateSolvedCount(tiles);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const lastSlideTimeRef = useRef<number>(0);

  // Find blank tile current position
  const blankTile = tiles.find(t => t.id === BLANK_TILE_ID);
  const blankPos = blankTile ? blankTile.currentPos : 8;

  // Move tile at given position into blank space if valid
  const trySlideTileAtPosition = (clickedPos: number) => {
    if (clickedPos === blankPos) return;

    if (isAdjacent(clickedPos, blankPos)) {
      const now = Date.now();
      if (now - lastSlideTimeRef.current < 220) return; // Debounce rapid moves
      lastSlideTimeRef.current = now;

      soundFx.playSlide();

      setTiles(prevTiles => {
        const nextTiles = prevTiles.map(t => {
          if (t.currentPos === clickedPos) {
            return { ...t, currentPos: blankPos, isCorrect: t.id === blankPos };
          }
          if (t.currentPos === blankPos) {
            return { ...t, currentPos: clickedPos, isCorrect: t.id === clickedPos };
          }
          return t;
        });

        // Check if now solved
        const newSolvedCount = calculateSolvedCount(nextTiles);
        if (newSolvedCount === 8) {
          setTimeout(() => {
            soundFx.playWin();
            onSolved();
          }, 300);
        }

        return nextTiles;
      });

      setMoveCount(m => m + 1);
    }
  };

  // Hand finger gesture interaction mapped directly to grid
  useEffect(() => {
    if (hands.length === 0) {
      setHoveredPos(prev => (prev !== null ? null : prev));
      return;
    }

    let detectedHover: number | null = null;
    let shouldSlidePos: number | null = null;

    for (const hand of hands) {
      // Use index tip or pinch point to target tiles
      const pt = hand.isPinching ? hand.pinchPoint : hand.indexTip;
      const relX = (pt.x - selectionBox.x) / selectionBox.width;
      const relY = (pt.y - selectionBox.y) / selectionBox.height;

      if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
        const col = Math.floor(relX * GRID_SIZE);
        const row = Math.floor(relY * GRID_SIZE);
        const gridPos = Math.min(8, Math.max(0, row * GRID_SIZE + col));

        detectedHover = gridPos;

        // Slide tile if finger or pinch is over an adjacent tile to the blank space
        if (isAdjacent(gridPos, blankPos)) {
          shouldSlidePos = gridPos;
        }
        break;
      }
    }

    setHoveredPos(prev => (prev !== detectedHover ? detectedHover : prev));

    if (shouldSlidePos !== null) {
      trySlideTileAtPosition(shouldSlidePos);
    }
  }, [hands, selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height, blankPos]);

  // Elapsed time display
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className="absolute pointer-events-auto grid grid-cols-3 grid-rows-3 gap-[1px] bg-black/30 z-20 transition-all overflow-hidden border border-white/20 shadow-2xl"
      style={{
        left: `${selectionBox.x * 100}%`,
        top: `${selectionBox.y * 100}%`,
        width: `${selectionBox.width * 100}%`,
        height: `${selectionBox.height * 100}%`,
      }}
    >
      {Array.from({ length: TOTAL_TILES }).map((_, gridPos) => {
        const tile = tiles.find(t => t.currentPos === gridPos);
        const isBlank = tile?.id === BLANK_TILE_ID;
        const isMovable = isAdjacent(gridPos, blankPos);
        const isPinchHovered = hoveredPos === gridPos;

        if (!tile) return null;

        return (
          <motion.div
            key={tile.id}
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            onClick={() => trySlideTileAtPosition(gridPos)}
            className={`relative w-full h-full overflow-hidden cursor-pointer transition-all select-none ${
              isBlank
                ? 'bg-black/90'
                : 'border border-white/10 hover:border-white/40'
            } ${isPinchHovered && !isBlank ? 'scale-[0.95] ring-2 ring-emerald-400 z-10' : ''}`}
          >
            {!isBlank && (
              <img
                src={tile.dataUrl}
                alt={`Tile ${tile.id}`}
                className="w-full h-full object-cover pointer-events-none"
              />
            )}

            {/* Blank space text */}
            {isBlank && (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 font-bold text-[10px] tracking-wider uppercase text-center p-1">
                <span>SLIDE</span>
                <span>HERE</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

