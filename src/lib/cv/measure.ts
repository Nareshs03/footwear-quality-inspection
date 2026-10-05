import type { BBox, HeelMeasurement } from "./types";

const NOISE_SKIP = 2;

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function regionGray(frame: ImageData, bbox: BBox): Uint8Array {
  const { data, width: fw } = frame;
  const { x: bx, y: by, w: bw, h: bh } = bbox;
  const out = new Uint8Array(bw * bh);
  for (let ry = 0; ry < bh; ry++)
    for (let rx = 0; rx < bw; rx++) {
      const fi = ((by + ry) * fw + (bx + rx)) * 4;
      out[ry * bw + rx] = (data[fi] * 77 + data[fi + 1] * 150 + data[fi + 2] * 29) >> 8;
    }
  return out;
}

function otsu(gray: Uint8Array): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumB = 0, wB = 0, sum = 0, maxVar = 0, t = 128;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxVar) { maxVar = v; t = i; }
  }
  return t;
}

function smooth(arr: Int32Array, radius: number): Float64Array {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, n = 0;
    for (let d = -radius; d <= radius; d++) {
      const j = i + d;
      if (j >= 0 && j < arr.length) { s += arr[j]; n++; }
    }
    out[i] = s / n;
  }
  return out;
}

export function measureHeelVertical(
  frame:     ImageData,
  heelBbox:  BBox,
  blobMaxY:  number,
  pxPerMm:   number,
): HeelMeasurement | null {
  const { x: bx, y: by, w: bw, h: bh } = heelBbox;

  const gray  = regionGray(frame, heelBbox);
  const darkT = Math.min(otsu(gray), 160);

  // Define a central vertical core slice to avoid rounded sides
  // We examine the middle 50% of the rear 40% region
  const coreX = Math.floor(bw * 0.25);
  const coreW = Math.floor(bw * 0.50);

  // Build per-row fill profile for the CORE vertical slice ONLY
  const fillProfile = new Int32Array(bh);
  for (let ry = 0; ry < bh; ry++) {
    let count = 0;
    for (let rx = coreX; rx < coreX + coreW; rx++) {
      if (gray[ry * bw + rx] <= darkT) count++;
    }
    fillProfile[ry] = count;
  }
  const smoothedFill = smooth(fillProfile, 4);

  // --- TOP Y ---
  // Find highest reliable row belonging to the shoe structure
  // Requires at least 15% fill of the core slice width (or min 3 pixels), 
  // followed by 3 valid consecutive rows to ignore noise/laces.
  const topThresh = Math.max(3, Math.round(coreW * 0.15));
  let topRow = -1;
  for (let ry = NOISE_SKIP; ry < bh - NOISE_SKIP; ry++) {
    if (smoothedFill[ry] >= topThresh) {
      let consecutive = 0;
      for (let k = 1; k <= 4; k++) {
        if (ry + k < bh && smoothedFill[ry + k] >= topThresh) consecutive++;
      }
      if (consecutive >= 3) {
        topRow = ry;
        break;
      }
    }
  }

  if (topRow < 0) {
    for (let ry = NOISE_SKIP; ry < bh - NOISE_SKIP; ry++) {
      if (fillProfile[ry] >= 2) { topRow = ry; break; }
    }
  }
  if (topRow < 0) return null;
  const topY = by + topRow;

  // --- BOTTOM Y ---
  const scanBottomRow = Math.min(bh - 1 - NOISE_SKIP, blobMaxY - by);
  
  // Median fill of the core slice within the middle 40% of the bbox
  const midStart = Math.floor(bh * 0.20);
  const midEnd   = Math.floor(bh * 0.60);
  const midFills: number[] = [];
  for (let ry = midStart; ry <= midEnd; ry++) midFills.push(smoothedFill[ry]);
  const shoeBodyFill = median(midFills.map(Math.round));

  // Minimum threshold to count as outsole
  const soleThresh = Math.max(2, shoeBodyFill * 0.25);
  
  let soleRow = -1;
  for (let ry = scanBottomRow; ry >= NOISE_SKIP + 3; ry--) {
    if (smoothedFill[ry] >= soleThresh) {
      let consecutiveAbove = 0;
      for (let k = 1; k <= 4; k++) {
        if (ry - k >= 0 && smoothedFill[ry - k] >= soleThresh) consecutiveAbove++;
      }
      if (consecutiveAbove >= 3) { soleRow = ry; break; }
    }
  }

  if (soleRow < 0) {
    for (let ry = scanBottomRow; ry >= NOISE_SKIP; ry--) {
      if (fillProfile[ry] >= 2) { soleRow = ry; break; }
    }
  }
  if (soleRow < 0) return null;
  const bottomY = by + soleRow;

  const heightPx = bottomY - topY;
  if (heightPx <= 0) return null;

  const coreBbox: BBox = { x: bx + coreX, y: topY, w: coreW, h: heightPx };

  return {
    topY,
    bottomY,
    heightPx,
    heightMm: parseFloat((heightPx / pxPerMm).toFixed(1)),
    heelBbox,
    coreBbox
  };
}
