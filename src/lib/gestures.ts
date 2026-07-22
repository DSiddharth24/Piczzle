import { DetectedHand, HandLandmark, Point2D, SelectionBox } from '../types';

// Distance between two 2D/3D points
export function distance2D(p1: Point2D | HandLandmark, p2: Point2D | HandLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Lerp helper
export function lerp(start: number, end: number, amt: number): number {
  return start + (end - start) * amt;
}

// Smooth box coordinates to eliminate hand tremor jitter with soft interpolation
export function smoothBox(current: SelectionBox, target: SelectionBox, alpha = 0.18): SelectionBox {
  const nextX = lerp(current.x, target.x, alpha);
  const nextY = lerp(current.y, target.y, alpha);
  const nextW = lerp(current.width, target.width, alpha);
  const nextH = lerp(current.height, target.height, alpha);

  if (
    Math.abs(current.x - nextX) < 0.0001 &&
    Math.abs(current.y - nextY) < 0.0001 &&
    Math.abs(current.width - nextW) < 0.0001 &&
    Math.abs(current.height - nextH) < 0.0001
  ) {
    return current;
  }

  return {
    x: nextX,
    y: nextY,
    width: nextW,
    height: nextH,
  };
}

/**
 * Adaptive Exponential Moving Average (EMA) landmark filter.
 * Eliminates high-frequency camera jitter when hand is stationary (low alpha),
 * while providing immediate responsiveness with low latency during rapid motion (high alpha).
 */
export function smoothHandLandmarksEMA(
  rawLandmarks: HandLandmark[],
  prevSmoothed: HandLandmark[] | null
): HandLandmark[] {
  if (!prevSmoothed || prevSmoothed.length !== rawLandmarks.length) {
    return rawLandmarks.map(l => ({ ...l }));
  }

  return rawLandmarks.map((curr, i) => {
    const prev = prevSmoothed[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dynamic alpha based on landmark speed:
    // Low speed (< 0.003): strong smoothing (alpha = 0.22) to remove micro-tremors
    // High speed (> 0.025): high speed tracking (alpha = 0.80) to avoid lag
    const minAlpha = 0.22;
    const maxAlpha = 0.80;
    const minDist = 0.003;
    const maxDist = 0.025;

    let alpha = minAlpha;
    if (dist > maxDist) {
      alpha = maxAlpha;
    } else if (dist > minDist) {
      alpha = minAlpha + ((dist - minDist) / (maxDist - minDist)) * (maxAlpha - minAlpha);
    }

    return {
      x: prev.x + alpha * (curr.x - prev.x),
      y: prev.y + alpha * (curr.y - prev.y),
      z: curr.z !== undefined && prev.z !== undefined
        ? prev.z + alpha * (curr.z - prev.z)
        : curr.z,
    };
  });
}

/**
 * Analyzes raw MediaPipe landmarks for one hand.
 * Converts to screen coordinates (handling mirrored webcam mode) and computes gestures.
 */
export function processHandLandmarks(
  landmarks: HandLandmark[],
  handednessLabel: string,
  prevPinching = false
): DetectedHand {
  // Hand scale reference (Wrist 0 to Middle MCP 9)
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const handScale = Math.max(0.05, distance2D(wrist, middleMcp));

  // Landmarks in mirrored space (screen position)
  const thumbTip = { x: 1 - landmarks[4].x, y: landmarks[4].y };
  const indexTip = { x: 1 - landmarks[8].x, y: landmarks[8].y };
  const middleTip = { x: 1 - landmarks[12].x, y: landmarks[12].y };
  const ringTip = { x: 1 - landmarks[16].x, y: landmarks[16].y };
  const pinkyTip = { x: 1 - landmarks[20].x, y: landmarks[20].y };

  const indexMcp = { x: 1 - landmarks[5].x, y: landmarks[5].y };
  const ringMcp = { x: 1 - landmarks[13].x, y: landmarks[13].y };
  const pinkyMcp = { x: 1 - landmarks[17].x, y: landmarks[17].y };
  const wristMirrored = { x: 1 - wrist.x, y: wrist.y };

  // Pinch calculation (thumb tip to index tip)
  const pinchDist = distance2D(thumbTip, indexTip);
  const pinchRatio = pinchDist / handScale;

  // Hysteresis threshold for pinch stability
  const pinchThresholdOn = 0.32;
  const pinchThresholdOff = 0.45;
  const isPinching = prevPinching
    ? pinchRatio < pinchThresholdOff
    : pinchRatio < pinchThresholdOn;

  // Midpoint between thumb and index as pinch point
  const pinchPoint: Point2D = {
    x: (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2,
  };

  // Fist calculation
  const indexCurled = distance2D(indexTip, wristMirrored) < 1.25 * distance2D(indexMcp, wristMirrored);
  const middleCurled = distance2D(middleTip, wristMirrored) < 1.25 * distance2D({ x: 1 - middleMcp.x, y: middleMcp.y }, wristMirrored);
  const ringCurled = distance2D(ringTip, wristMirrored) < 1.25 * distance2D(ringMcp, wristMirrored);
  const pinkyCurled = distance2D(pinkyTip, wristMirrored) < 1.25 * distance2D(pinkyMcp, wristMirrored);

  const isFist = indexCurled && middleCurled && ringCurled && pinkyCurled;

  // Pointing gesture: Index finger extended, middle/ring/pinky curled, not pinching
  const indexExtended = distance2D(indexTip, wristMirrored) > 1.30 * distance2D(indexMcp, wristMirrored);
  const isPointing = indexExtended && middleCurled && ringCurled && pinkyCurled && !isPinching;

  return {
    landmarks: landmarks.map(l => ({ x: 1 - l.x, y: l.y, z: l.z })), // mirrored
    handedness: handednessLabel === 'Left' ? 'Left' : 'Right',
    isPinching,
    isFist,
    isPointing,
    pinchPoint,
    indexTip,
  };
}

/**
 * Enforces a strict 1:1 pixel square aspect ratio on normalized box coordinates
 * while preserving box width and constraining position to screen bounds.
 */
export function enforceSquareBox(box: SelectionBox, aspect: number): SelectionBox {
  // Clamp width to safe limits [0.12, 0.88]
  const maxWAllowed = Math.min(0.85, 0.90 / Math.max(0.5, aspect));
  const normW = Math.min(maxWAllowed, Math.max(0.12, box.width));
  const normH = normW * aspect;

  const maxX = Math.max(0.01, 0.99 - normW);
  const maxY = Math.max(0.01, 0.99 - normH);

  const x = Math.max(0.01, Math.min(maxX, box.x));
  const y = Math.max(0.01, Math.min(maxY, box.y));

  return { x, y, width: normW, height: normH };
}

/**
 * Calculates a 1:1 pixel square selection box given two hand landmark points
 */
export function calculateTwoHandBox(p1: Point2D, p2: Point2D, aspect = 16 / 9): SelectionBox {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const pixelW = maxX - minX;
  const pixelH = (maxY - minY) / aspect;

  // Make square based on finger distance (bounded between 18% and max allowed screen width)
  const maxWAllowed = Math.min(0.82, 0.88 / Math.max(0.5, aspect));
  const sideNormW = Math.min(maxWAllowed, Math.max(0.18, Math.max(pixelW, pixelH)));
  const sideNormH = sideNormW * aspect;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let x = centerX - sideNormW / 2;
  let y = centerY - sideNormH / 2;

  // Clamp to bounds
  x = Math.max(0.01, Math.min(0.99 - sideNormW, x));
  y = Math.max(0.01, Math.min(0.99 - sideNormH, y));

  return { x, y, width: sideNormW, height: sideNormH };
}
