export type GameMode = 'framing' | 'capturing' | 'playing' | 'won';

export interface Point2D {
  x: number; // Normalized 0-1
  y: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  isPinching: boolean;
  isFist: boolean;
  isPointing: boolean;
  pinchPoint: Point2D; // Normalized coordinates on screen (mirrored)
  indexTip: Point2D; // Index fingertip position on screen (mirrored)
}

export interface SelectionBox {
  x: number; // 0-1 normalized top-left X
  y: number; // 0-1 normalized top-left Y
  width: number; // 0-1 normalized width
  height: number; // 0-1 normalized height
}

export interface PuzzleTile {
  id: number; // Original index 0..8 (8 is blank by default)
  currentPos: number; // Current position index 0..8
  dataUrl: string; // Cutout image data URL
  isCorrect: boolean;
}

export interface GestureState {
  handsCount: number;
  hands: DetectedHand[];
  activeGesture: 'none' | 'framing' | 'pinching' | 'fist';
  fistHoldRatio: number; // 0..1 countdown for capture
}
