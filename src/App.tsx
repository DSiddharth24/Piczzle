/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameMode, SelectionBox, DetectedHand, PuzzleTile } from './types';
import { processAndSliceImage, generateSolvableShuffle } from './lib/puzzle';
import { soundFx } from './lib/audio';
import { CameraView } from './components/CameraView';
import { PuzzleGrid } from './components/PuzzleGrid';
import { ControlPanel } from './components/ControlPanel';
import { InstructionBanner } from './components/InstructionBanner';
import { WinModal } from './components/WinModal';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [mode, setMode] = useState<GameMode>('framing');
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    x: 0.3,
    y: 0.25,
    width: 0.4,
    height: 0.4,
  });
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [applyGrainFilter, setApplyGrainFilter] = useState(false);
  const [hands, setHands] = useState<DetectedHand[]>([]);

  const [tiles, setTiles] = useState<PuzzleTile[]>([]);
  const [fullImageUri, setFullImageUri] = useState<string>('');
  const [moveCount, setMoveCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Perform Snapshot Capture
  const handleCaptureSnapshot = useCallback(() => {
    if (!videoRef.current) return;

    soundFx.playShutter();
    setMode('capturing');

    const { tiles: rawTiles, fullImageUri: imageUri } = processAndSliceImage(
      videoRef.current,
      selectionBox,
      applyGrainFilter
    );

    // Generate solvable shuffle
    const shuffledTiles = generateSolvableShuffle(rawTiles, 80);

    setFullImageUri(imageUri);
    setTiles(shuffledTiles);
    setMoveCount(0);
    setStartTime(Date.now());

    setTimeout(() => {
      setMode('playing');
    }, 250);
  }, [selectionBox, applyGrainFilter]);

  // Handle hand landmark updates
  const handleHandsDetected = useCallback((detectedHands: DetectedHand[]) => {
    setHands(detectedHands);
  }, []);

  const handleResetToFraming = useCallback(() => {
    setMode('framing');
    setTiles([]);
    setFullImageUri('');
    setMoveCount(0);
    setStartTime(null);
  }, []);

  const handleSolved = useCallback(() => {
    setMode('won');
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-zinc-100 font-sans select-none">
      {/* Top Floating Controls */}
      <ControlPanel
        showLandmarks={showLandmarks}
        setShowLandmarks={setShowLandmarks}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        applyGrainFilter={applyGrainFilter}
        setApplyGrainFilter={setApplyGrainFilter}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      {/* Floating Gesture Instructions */}
      <InstructionBanner mode={mode} hands={hands} />

      {/* Full-bleed Camera & Canvas Viewport */}
      <div className="w-full h-full absolute inset-0 z-0">
        <CameraView
          mode={mode}
          selectionBox={selectionBox}
          setSelectionBox={setSelectionBox}
          onHandsDetected={handleHandsDetected}
          showLandmarks={showLandmarks}
          videoRef={videoRef}
          onManualCapture={handleCaptureSnapshot}
          hands={hands}
          tiles={tiles}
          setTiles={setTiles}
          moveCount={moveCount}
          setMoveCount={setMoveCount}
          startTime={startTime}
          onSolved={handleSolved}
          onResetToFraming={handleResetToFraming}
        />
      </div>

      {/* Win Celebration Modal */}
      {mode === 'won' && (
        <WinModal
          fullImageUri={fullImageUri}
          moveCount={moveCount}
          elapsedSeconds={startTime ? Math.floor((Date.now() - startTime) / 1000) : 0}
          onPlayAgain={handleResetToFraming}
        />
      )}

      {/* Help Modal */}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}
