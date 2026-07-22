import { PuzzleTile, SelectionBox } from '../types';

export const GRID_SIZE = 3; // 3x3 puzzle
export const TOTAL_TILES = GRID_SIZE * GRID_SIZE; // 9
export const BLANK_TILE_ID = 8; // 8th tile is blank (0-indexed)

/**
 * Gets row and column from 0..8 index
 */
export function getRowCol(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / GRID_SIZE),
    col: index % GRID_SIZE,
  };
}

/**
 * Checks if two grid positions are adjacent (up, down, left, right)
 */
export function isAdjacent(pos1: number, pos2: number): boolean {
  const p1 = getRowCol(pos1);
  const p2 = getRowCol(pos2);
  const dRow = Math.abs(p1.row - p2.row);
  const dCol = Math.abs(p1.col - p2.col);
  return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1);
}

/**
 * Gets valid adjacent position indices for a given position
 */
export function getAdjacentPositions(pos: number): number[] {
  const neighbors: number[] = [];
  const { row, col } = getRowCol(pos);

  if (row > 0) neighbors.push((row - 1) * GRID_SIZE + col);
  if (row < GRID_SIZE - 1) neighbors.push((row + 1) * GRID_SIZE + col);
  if (col > 0) neighbors.push(row * GRID_SIZE + (col - 1));
  if (col < GRID_SIZE - 1) neighbors.push(row * GRID_SIZE + (col + 1));

  return neighbors;
}

/**
 * Crop video stream according to selection box, apply grayscale + grain filter,
 * and slice into 3x3 tile Data URLs.
 */
export function processAndSliceImage(
  videoEl: HTMLVideoElement,
  box: SelectionBox,
  applyGrayscaleAndGrain = false
): { tiles: PuzzleTile[]; fullImageUri: string } {
  const videoW = videoEl.videoWidth || 640;
  const videoH = videoEl.videoHeight || 480;

  // Calculate pixel bounds from normalized selection box (note: video is mirrored horizontally)
  // Box x in normalized mirrored screen space [0..1]
  // In raw video coordinates: rawX = (1 - (box.x + box.width)) * videoW
  const cropW = Math.floor(box.width * videoW);
  const cropH = Math.floor(box.height * videoH);
  const cropX = Math.floor((1 - box.x - box.width) * videoW);
  const cropY = Math.floor(box.y * videoH);

  // Main canvas for full crop
  const fullCanvas = document.createElement('canvas');
  const renderSize = 600; // High quality square canvas
  fullCanvas.width = renderSize;
  fullCanvas.height = renderSize;
  const ctx = fullCanvas.getContext('2d', { willReadFrequently: true });

  if (ctx) {
    // Draw mirrored video crop onto square canvas
    ctx.save();
    ctx.translate(renderSize, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      videoEl,
      Math.max(0, cropX),
      Math.max(0, cropY),
      Math.min(videoW - cropX, cropW),
      Math.min(videoH - cropY, cropH),
      0,
      0,
      renderSize,
      renderSize
    );
    ctx.restore();

    // Apply Grayscale + Grain filter if enabled
    if (applyGrayscaleAndGrain) {
      const imgData = ctx.getImageData(0, 0, renderSize, renderSize);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Film grain noise (-12 to +12)
        const noise = (Math.random() - 0.5) * 24;
        const v = Math.min(255, Math.max(0, gray + noise));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  const fullImageUri = fullCanvas.toDataURL('image/jpeg', 0.92);

  // Slice into 3x3 tiles
  const tileSize = renderSize / GRID_SIZE;
  const tiles: PuzzleTile[] = [];

  for (let i = 0; i < TOTAL_TILES; i++) {
    const { row, col } = getRowCol(i);
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext('2d');

    if (tileCtx) {
      tileCtx.drawImage(
        fullCanvas,
        col * tileSize,
        row * tileSize,
        tileSize,
        tileSize,
        0,
        0,
        tileSize,
        tileSize
      );
    }

    tiles.push({
      id: i,
      currentPos: i,
      dataUrl: tileCanvas.toDataURL('image/jpeg', 0.90),
      isCorrect: true,
    });
  }

  return { tiles, fullImageUri };
}

/**
 * Shuffles tiles starting from solved state with valid sliding moves
 * to strictly guarantee solvability!
 */
export function generateSolvableShuffle(tiles: PuzzleTile[], moveCount = 80): PuzzleTile[] {
  const resultTiles = tiles.map(t => ({ ...t }));
  let currentBlankPos = BLANK_TILE_ID;

  for (let m = 0; m < moveCount; m++) {
    const neighbors = getAdjacentPositions(currentBlankPos);
    // Pick random neighbor to swap with blank
    const randomNeighborPos = neighbors[Math.floor(Math.random() * neighbors.length)];

    // Find tile at randomNeighborPos and move it to currentBlankPos
    const tileToMoveIndex = resultTiles.findIndex(t => t.currentPos === randomNeighborPos);
    const blankTileIndex = resultTiles.findIndex(t => t.currentPos === currentBlankPos);

    if (tileToMoveIndex !== -1 && blankTileIndex !== -1) {
      resultTiles[tileToMoveIndex].currentPos = currentBlankPos;
      resultTiles[blankTileIndex].currentPos = randomNeighborPos;
      currentBlankPos = randomNeighborPos;
    }
  }

  // Update correctness flag for each tile (excluding blank tile)
  resultTiles.forEach(tile => {
    tile.isCorrect = tile.id === tile.currentPos;
  });

  return resultTiles;
}

/**
 * Count how many non-blank tiles are in their correct positions (out of 8)
 */
export function calculateSolvedCount(tiles: PuzzleTile[]): number {
  return tiles.filter(t => t.id !== BLANK_TILE_ID && t.id === t.currentPos).length;
}
