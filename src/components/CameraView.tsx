import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Camera, RefreshCw, AlertCircle, Sparkles, VideoOff, Timer, Maximize2, Move } from 'lucide-react';
import { DetectedHand, GameMode, SelectionBox, PuzzleTile, HandLandmark } from '../types';
import { processHandLandmarks, calculateTwoHandBox, smoothBox, enforceSquareBox, lerp, smoothHandLandmarksEMA } from '../lib/gestures';
import { calculateSolvedCount } from '../lib/puzzle';
import { soundFx } from '../lib/audio';
import { PuzzleGrid } from './PuzzleGrid';

interface CameraViewProps {
  mode: GameMode;
  selectionBox: SelectionBox;
  setSelectionBox: React.Dispatch<React.SetStateAction<SelectionBox>>;
  onHandsDetected: (hands: DetectedHand[]) => void;
  showLandmarks: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onManualCapture: () => void;
  hands: DetectedHand[];
  tiles: PuzzleTile[];
  setTiles: React.Dispatch<React.SetStateAction<PuzzleTile[]>>;
  moveCount: number;
  setMoveCount: React.Dispatch<React.SetStateAction<number>>;
  startTime: number | null;
  onSolved: () => void;
  onResetToFraming: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  mode,
  selectionBox,
  setSelectionBox,
  onHandsDetected,
  showLandmarks,
  videoRef,
  onManualCapture,
  hands,
  tiles,
  setTiles,
  moveCount,
  setMoveCount,
  startTime,
  onSolved,
  onResetToFraming,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isDraggingBox, setIsDraggingBox] = useState(false);
  const [isResizingBox, setIsResizingBox] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWidth: number } | null>(null);

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const prevPinchingRef = useRef<Record<number, boolean>>({});

  // Countdown Timer handler
  const handleStartCountdown = () => {
    if (countdown !== null) return;
    setCountdown(3);
    soundFx.playTick();
  };

  const onManualCaptureRef = useRef(onManualCapture);
  onManualCaptureRef.current = onManualCapture;

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        const next = countdown - 1;
        setCountdown(next);
        if (next > 0) {
          soundFx.playTick();
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      onManualCaptureRef.current();
    }
  }, [countdown]);

  // Initialize Camera & MediaPipe
  useEffect(() => {
    let isMounted = true;

    async function initMediaPipeAndCamera() {
      try {
        setIsInitializing(true);
        setInitError(null);

        // Load WASM fileset for vision tasks
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );

        if (!isMounted) return;

        // Initialize HandLandmarker model
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        handLandmarkerRef.current = landmarker;

        // Start Webcam
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
            audio: false,
          });

          if (videoRef.current && isMounted) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play();
                setCameraActive(true);
                setIsInitializing(false);
              }
            };
          }
        } else {
          throw new Error('Webcam mediaDevices API not supported on this browser.');
        }
      } catch (err: unknown) {
        console.error('Failed to initialize HandLandmarker or Camera:', err);
        if (isMounted) {
          setIsInitializing(false);
          const errorMsg = err instanceof Error ? err.message : 'Could not access webcam or load hand tracking models.';
          setInitError(errorMsg);
        }
      }
    }

    initMediaPipeAndCamera();

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef]);

  const lastHandsUpdateRef = useRef<number>(0);
  const lastBoxUpdateRef = useRef<number>(0);
  const lastInferenceTimeRef = useRef<number>(0);
  const prevHandsCountRef = useRef<number>(-1);
  const prevSmoothedLandmarksRef = useRef<Map<number, HandLandmark[]>>(new Map());

  // Sync state values to refs for smooth render loop without effect tear-downs
  const selectionBoxRef = useRef(selectionBox);
  selectionBoxRef.current = selectionBox;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  const onHandsDetectedRef = useRef(onHandsDetected);
  onHandsDetectedRef.current = onHandsDetected;

  const showLandmarksRef = useRef(showLandmarks);
  showLandmarksRef.current = showLandmarks;

  // Main Detection & Overlay Render Loop
  useEffect(() => {
    if (!cameraActive) return;

    let isFrameActive = true;

    const renderLoop = () => {
      if (!isFrameActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = handLandmarkerRef.current;

      if (video && video.readyState >= 2 && landmarker) {
        const nowMs = performance.now();
        if (lastVideoTimeRef.current !== video.currentTime && nowMs - lastInferenceTimeRef.current >= 30) {
          lastVideoTimeRef.current = video.currentTime;
          lastInferenceTimeRef.current = nowMs;
          const results = landmarker.detectForVideo(video, nowMs);

          const detectedHands: DetectedHand[] = [];

          if (results.landmarks && results.landmarks.length > 0) {
            const currentHandIndices = new Set<number>();

            results.landmarks.forEach((rawLandmarks, idx) => {
              currentHandIndices.add(idx);
              const prevSmoothed = prevSmoothedLandmarksRef.current.get(idx) || null;
              const smoothedLandmarks = smoothHandLandmarksEMA(rawLandmarks, prevSmoothed);
              prevSmoothedLandmarksRef.current.set(idx, smoothedLandmarks);

              const handedness = results.handednesses[idx]?.[0]?.categoryName || 'Right';
              const wasPinching = prevPinchingRef.current[idx] || false;

              const processed = processHandLandmarks(smoothedLandmarks, handedness, wasPinching);
              prevPinchingRef.current[idx] = processed.isPinching;

              detectedHands.push(processed);
            });

            // Clean up missing hands from smoothing cache
            for (const key of prevSmoothedLandmarksRef.current.keys()) {
              if (!currentHandIndices.has(key)) {
                prevSmoothedLandmarksRef.current.delete(key);
              }
            }
          } else {
            prevPinchingRef.current = {};
            prevSmoothedLandmarksRef.current.clear();
          }

          // Throttle parent hands state updates to ~20fps to prevent React re-render lag
          if (nowMs - lastHandsUpdateRef.current > 50) {
            lastHandsUpdateRef.current = nowMs;
            if (detectedHands.length === 0 && prevHandsCountRef.current === 0) {
              // Skip duplicate empty array state dispatch
            } else {
              prevHandsCountRef.current = detectedHands.length;
              onHandsDetectedRef.current(detectedHands);
            }
          }

          const targetWidth = video.clientWidth || 1280;
          const targetHeight = video.clientHeight || 720;
          const aspect = targetWidth / targetHeight;

          const currentMode = modeRef.current;
          const currentCountdown = countdownRef.current;
          const currentBox = selectionBoxRef.current;

          // Handle Framing Mode Box Updates (ONLY when NOT counting down)
          if ((currentMode === 'framing' || currentMode === 'capturing') && currentCountdown === null) {
            let nextBox = currentBox;
            if (detectedHands.length >= 2) {
              // Two hands in frame: index fingertips define sizing and position of square frame
              const p1 = detectedHands[0].indexTip;
              const p2 = detectedHands[1].indexTip;
              const targetBox = calculateTwoHandBox(p1, p2, aspect);
              nextBox = smoothBox(currentBox, targetBox, 0.22);
            } else if (detectedHands.length === 1) {
              // One hand in frame: index fingertip (or pinch point) moves the frame position WITHOUT changing width/height
              const hand = detectedHands[0];
              const point = hand.isPinching ? hand.pinchPoint : hand.indexTip;
              const targetBox = enforceSquareBox({
                x: point.x - currentBox.width / 2,
                y: point.y - (currentBox.width * aspect) / 2,
                width: currentBox.width,
                height: currentBox.width * aspect,
              }, aspect);
              nextBox = smoothBox(currentBox, targetBox, 0.22);
            }

            selectionBoxRef.current = nextBox;

            // Throttle React component state updates to ~25fps to avoid 60Hz React re-render lag
            if (nowMs - lastBoxUpdateRef.current > 40) {
              lastBoxUpdateRef.current = nowMs;
              setSelectionBox(nextBox);
            }
          }

          // Render Hand Overlay on Canvas
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Only adjust canvas width/height when size actually changes (prevents canvas reset lag!)
              if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
              }

              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Draw landmarks if enabled or for visual gesture feedback
              if (showLandmarksRef.current && detectedHands.length > 0) {
                detectedHands.forEach(hand => {
                  // Draw skeleton connections
                  ctx.strokeStyle = hand.isPointing ? '#EC4899' : hand.isPinching ? '#10B981' : '#8B5CF6';
                  ctx.lineWidth = 2;

                  hand.landmarks.forEach((pt, i) => {
                    const sx = pt.x * canvas.width;
                    const sy = pt.y * canvas.height;

                    ctx.beginPath();
                    ctx.arc(sx, sy, i === 8 ? 7 : i === 4 ? 6 : 3, 0, 2 * Math.PI);
                    ctx.fillStyle = i === 8 ? (hand.isPointing ? '#EC4899' : '#F472B6') : i === 4 ? (hand.isPinching ? '#10B981' : '#A78BFA') : 'white';
                    ctx.fill();
                  });
                });
              }

              // Draw Index Finger / Pinch Cursors
              detectedHands.forEach(hand => {
                const px = hand.pinchPoint.x * canvas.width;
                const py = hand.pinchPoint.y * canvas.height;
                const ix = hand.indexTip.x * canvas.width;
                const iy = hand.indexTip.y * canvas.height;

                // Index fingertip highlight marker when pointing
                if (hand.isPointing) {
                  ctx.beginPath();
                  ctx.arc(ix, iy, 12, 0, 2 * Math.PI);
                  ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
                  ctx.fill();
                  ctx.strokeStyle = 'white';
                  ctx.lineWidth = 2.5;
                  ctx.stroke();
                }

                if (hand.isPinching) {
                  ctx.beginPath();
                  ctx.arc(px, py, 16, 0, 2 * Math.PI);
                  ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
                  ctx.fill();
                  ctx.strokeStyle = '#10B981';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
              });

              // Draw Selection Box in framing phase (Strict Pixel Square)
              if (currentMode === 'framing' || currentMode === 'capturing') {
                const bx = currentBox.x * canvas.width;
                const by = currentBox.y * canvas.height;
                const bw = currentBox.width * canvas.width;
                const bh = bw; // Ensure 1:1 pixel square on screen!

                // Box background highlight
                ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
                ctx.fillRect(bx, by, bw, bh);

                // Box border with glow
                ctx.strokeStyle = currentMode === 'capturing' || currentCountdown !== null ? '#10B981' : '#A855F7';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#C084FC';
                ctx.shadowBlur = 10;
                ctx.strokeRect(bx, by, bw, bh);
                ctx.shadowBlur = 0; // Reset

                // Corner brackets
                const len = 20;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 4;

                // Top-left corner
                ctx.beginPath();
                ctx.moveTo(bx, by + len);
                ctx.lineTo(bx, by);
                ctx.lineTo(bx + len, by);
                ctx.stroke();

                // Top-right corner
                ctx.beginPath();
                ctx.moveTo(bx + bw - len, by);
                ctx.lineTo(bx + bw, by);
                ctx.lineTo(bx + bw, by + len);
                ctx.stroke();

                // Bottom-left corner
                ctx.beginPath();
                ctx.moveTo(bx, by + bh - len);
                ctx.lineTo(bx, by + bh);
                ctx.lineTo(bx + len, by + bh);
                ctx.stroke();

                // Bottom-right corner
                ctx.beginPath();
                ctx.moveTo(bx + bw - len, by + bh);
                ctx.lineTo(bx + bw, by + bh);
                ctx.lineTo(bx + bw, by + bh - len);
                ctx.stroke();

                // 3x3 Grid guidelines inside selection box
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);

                for (let i = 1; i < 3; i++) {
                  // Vertical line
                  ctx.beginPath();
                  ctx.moveTo(bx + (bw / 3) * i, by);
                  ctx.lineTo(bx + (bw / 3) * i, by + bh);
                  ctx.stroke();

                  // Horizontal line
                  ctx.beginPath();
                  ctx.moveTo(bx, by + (bh / 3) * i);
                  ctx.lineTo(bx + bw, by + (bh / 3) * i);
                  ctx.stroke();
                }
                ctx.setLineDash([]); // Reset dash
              }
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      isFrameActive = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [cameraActive, videoRef, setSelectionBox]);

  // Frame size adjustment helpers
  const handleSetFrameWidth = (newW: number) => {
    const video = videoRef.current;
    const aspect = video && video.clientHeight > 0 ? video.clientWidth / video.clientHeight : 16 / 9;
    const clampedW = Math.max(0.15, Math.min(0.75, newW));
    const newH = clampedW * aspect;

    setSelectionBox(prev => {
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      let x = centerX - clampedW / 2;
      let y = centerY - newH / 2;

      x = Math.max(0.01, Math.min(0.99 - clampedW, x));
      y = Math.max(0.01, Math.min(0.99 - newH, y));

      return { x, y, width: clampedW, height: newH };
    });
  };

  const handleCenterFrame = () => {
    const video = videoRef.current;
    const aspect = video && video.clientHeight > 0 ? video.clientWidth / video.clientHeight : 16 / 9;

    setSelectionBox(prev => {
      const normH = prev.width * aspect;
      const x = Math.max(0.01, (1 - prev.width) / 2);
      const y = Math.max(0.01, (1 - normH) / 2);
      return { ...prev, x, y, height: normH };
    });
  };

  // Drag Corner Handle Resize Handler
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (mode !== 'framing' && mode !== 'capturing') return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = (clientX - rect.left) / rect.width;

    setIsResizingBox(true);
    resizeStartRef.current = {
      mouseX,
      mouseY: (clientY - rect.top) / rect.height,
      startWidth: selectionBox.width,
    };
  };

  // Mouse/Touch drag & resize handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (mode !== 'framing' && mode !== 'capturing') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (clientX - rect.left) / rect.width;
    const mouseY = (clientY - rect.top) / rect.height;

    setIsDraggingBox(true);
    dragOffsetRef.current = {
      x: mouseX - selectionBox.x,
      y: mouseY - selectionBox.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (mode !== 'framing' && mode !== 'capturing') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (clientX - rect.left) / rect.width;
    const mouseY = (clientY - rect.top) / rect.height;

    const video = videoRef.current;
    const aspect = video && video.clientHeight > 0 ? video.clientWidth / video.clientHeight : 16 / 9;

    if (isResizingBox && resizeStartRef.current) {
      const deltaX = mouseX - resizeStartRef.current.mouseX;
      const newWidth = Math.max(0.15, Math.min(0.75, resizeStartRef.current.startWidth + deltaX));
      const newHeight = newWidth * aspect;

      setSelectionBox(prev => {
        const x = Math.max(0.01, Math.min(0.99 - newWidth, prev.x));
        const y = Math.max(0.01, Math.min(0.99 - newHeight, prev.y));
        return { x, y, width: newWidth, height: newHeight };
      });
      return;
    }

    if (isDraggingBox && dragOffsetRef.current) {
      const normH = selectionBox.width * aspect;
      const newX = Math.max(0.01, Math.min(0.99 - selectionBox.width, mouseX - dragOffsetRef.current.x));
      const newY = Math.max(0.01, Math.min(0.99 - normH, mouseY - dragOffsetRef.current.y));

      setSelectionBox(prev => ({ ...prev, x: newX, y: newY, height: normH }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingBox(false);
    setIsResizingBox(false);
    dragOffsetRef.current = null;
    resizeStartRef.current = null;
  };

  const currentVideoAspect = videoRef.current && videoRef.current.clientHeight > 0
    ? videoRef.current.clientWidth / videoRef.current.clientHeight
    : 16 / 9;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black cursor-crosshair select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      {/* Interactive Corner Resize Handle overlay when framing */}
      {cameraActive && (mode === 'framing' || mode === 'capturing') && (
        <div
          className="absolute pointer-events-auto z-20"
          style={{
            left: `${selectionBox.x * 100}%`,
            top: `${selectionBox.y * 100}%`,
            width: `${selectionBox.width * 100}%`,
            height: `${(selectionBox.width * currentVideoAspect) * 100}%`,
          }}
        >
          {/* Corner Handle Bottom-Right */}
          <div
            className="absolute -bottom-3 -right-3 w-7 h-7 bg-purple-600 hover:bg-purple-500 border-2 border-white rounded-full cursor-se-resize flex items-center justify-center shadow-lg hover:scale-125 transition-transform z-50"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            title="Click & drag to resize puzzle frame"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </div>
          {/* Move handle center badge */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-purple-500/40 text-[10px] text-purple-200 font-semibold flex items-center gap-1 pointer-events-none">
            <Move className="w-2.5 h-2.5 text-purple-400" />
            Drag frame or handle
          </div>
        </div>
      )}

      {/* 3x3 Puzzle Grid overlay when playing or won */}
      {(mode === 'playing' || mode === 'won') && (
        <PuzzleGrid
          tiles={tiles}
          setTiles={setTiles}
          selectionBox={selectionBox}
          hands={hands}
          onSolved={onSolved}
          onResetToFraming={onResetToFraming}
          moveCount={moveCount}
          setMoveCount={setMoveCount}
          startTime={startTime}
        />
      )}

      {/* Canvas overlay for hand landmarks - z-30 so hand landmarks sit over video & tiles! */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
      />

      {/* Floating top stats pill overlay in playing mode (matching reference photos) */}
      {(mode === 'playing' || mode === 'won') && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-purple-500/40 shadow-xl text-xs font-semibold text-purple-200">
          <span className="flex items-center gap-1.5 text-white font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {calculateSolvedCount(tiles)} / 8 pieces solved
          </span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300">{moveCount} moves</span>
          <span className="text-zinc-500">•</span>
          <button
            onClick={onResetToFraming}
            className="ml-1 flex items-center gap-1 text-purple-200 hover:text-white bg-purple-900/60 hover:bg-purple-800 px-2.5 py-0.5 rounded-full border border-purple-400/40 transition active:scale-95 text-[11px]"
          >
            <Camera className="w-3 h-3" />
            New Photo
          </button>
        </div>
      )}

      {/* Bottom-left overlay instruction pill matching photo 2 & 3 */}
      {(mode === 'playing' || mode === 'won') && (
        <div className="absolute bottom-4 left-4 z-40 max-w-xs bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-zinc-800 text-xs text-zinc-300 shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
          <p className="leading-tight">
            <strong className="text-white">Point finger / Pinch</strong> adjacent tile to slide into space
          </p>
        </div>
      )}

      {/* 3-Second Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-50 select-none animate-fade-in">
          <div className="relative flex items-center justify-center mb-3">
            <div className="w-28 h-28 rounded-full border-4 border-purple-500/30 border-t-purple-400 animate-spin"></div>
            <span className="absolute text-6xl font-extrabold text-white tracking-tighter drop-shadow-[0_4px_12px_rgba(168,85,247,0.9)]">
              {countdown}
            </span>
          </div>
          <p className="text-base font-bold text-purple-200 bg-purple-950/80 px-5 py-2 rounded-full border border-purple-500/40 shadow-xl">
            Hold still! Capturing in {countdown}...
          </p>
        </div>
      )}

      {/* Loading Spinner */}
      {isInitializing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-white p-6 z-50">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto text-purple-400 w-6 h-6 animate-pulse" />
          </div>
          <p className="font-semibold text-lg">Initializing Hand Landmarker & Camera...</p>
          <p className="text-zinc-400 text-sm mt-1">Please allow camera permissions if prompted</p>
        </div>
      )}

      {/* Init Error Screen */}
      {initError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white p-6 z-50 text-center">
          <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 mb-4">
            <VideoOff className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Webcam Access Error</h3>
          <p className="text-zinc-400 text-sm max-w-md mb-6">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}

      {/* Mode & Action Framing Controls Overlay */}
      {cameraActive && (mode === 'framing' || mode === 'capturing') && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-lg w-full px-4">
          {/* Size Controls Toolbar */}
          <div className="w-full bg-black/80 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-2.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-200">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                Frame Size:
              </span>
              <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                {[
                  { label: 'S (25%)', value: 0.25 },
                  { label: 'M (40%)', value: 0.40 },
                  { label: 'L (55%)', value: 0.55 },
                  { label: 'Max (70%)', value: 0.70 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => handleSetFrameWidth(preset.value)}
                    className={`px-2 py-1 rounded-lg font-medium text-[11px] transition ${
                      Math.abs(selectionBox.width - preset.value) < 0.05
                        ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <input
                type="range"
                min="15"
                max="75"
                value={Math.round(selectionBox.width * 100)}
                onChange={e => handleSetFrameWidth(parseInt(e.target.value, 10) / 100)}
                className="w-24 accent-purple-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                title="Adjust frame size"
              />
              <button
                onClick={handleCenterFrame}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/80 transition text-[11px] font-medium"
              >
                Center
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleStartCountdown}
            disabled={mode === 'capturing' || countdown !== null}
            className="w-full sm:w-auto group flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-2xl font-bold shadow-xl shadow-purple-900/40 backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 border border-purple-400/30 disabled:opacity-50 disabled:pointer-events-none"
            title="Start 3-second countdown to create puzzle from selection"
          >
            {countdown !== null ? (
              <Timer className="w-5 h-5 text-amber-300 animate-pulse" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-300 animate-spin-slow group-hover:scale-110 transition-transform" />
            )}
            <span>{countdown !== null ? `Capturing in ${countdown}s...` : 'Create Puzzle from Selection'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

