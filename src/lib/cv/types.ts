export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectedShoe {
  bbox:      BBox;    // expanded bbox (h extends to frame bottom for heel scan)
  blobMaxY:  number;  // actual bottom row of shoe blob from detection (pre-expandToSole)
  confidence: number;
}

export interface ShoeDetectionResult {
  found:  boolean;
  left:   DetectedShoe | null;
  right:  DetectedShoe | null;
  splitX: number; // X boundary separating left shoe from right shoe (full-frame coords after scaling)
}

export interface ShoeMeasurement {
  topY:      number;  
  bottomY:   number;  
  heightPx:  number;
  heightMm:  number;
  measureBbox:  BBox;
}

export interface ScanResult {
  leftMm:          number;
  rightMm:         number;
  diffMm:          number;
  passed:          boolean;
  rejectionReason: string | null;
  annotatedDataUrl: string;  // base64 jpeg with overlay drawn
}

// Stored in Supabase + localStorage. Set once by admin.
export interface CalibrationData {
  pxPerMm:      number;
  calibratedAt: string;
  stationId:    string;
}
