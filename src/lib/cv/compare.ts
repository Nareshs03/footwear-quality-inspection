import type { HeelMeasurement, ScanResult } from "./types";

export function compareHeels(
  left:  HeelMeasurement,
  right: HeelMeasurement,
  annotatedDataUrl: string,
  toleranceMm: number
): ScanResult {
  const diffMm = parseFloat(Math.abs(left.heightMm - right.heightMm).toFixed(2));
  const passed = diffMm <= toleranceMm;
  return {
    leftMm:           left.heightMm,
    rightMm:          right.heightMm,
    diffMm,
    passed,
    rejectionReason:  passed ? null : `Difference ${diffMm}mm exceeds ${toleranceMm}mm tolerance`,
    annotatedDataUrl,
  };
}
