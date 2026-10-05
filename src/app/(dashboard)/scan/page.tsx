"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, AlertTriangle, ArrowLeft, Upload, Image as ImageIcon } from "lucide-react";
import { useCamera } from "@/hooks/use-camera";
import { extractFrame } from "@/lib/cv/frame";
import { processImage } from "@/lib/cv/process";
import { getLocalCalibration, loadCalibration } from "@/lib/calibration";
import { useScanStore } from "@/store/scan";
import type { ScanResult } from "@/lib/cv/types";
import { createClient } from "@/lib/supabase/client";

const STATION_ID    = "station-1";
const FALLBACK_PXMM = 2.4;

function CameraView({
  pxPerMmRef,
  isCalibrated,
  onBack,
}: {
  pxPerMmRef: React.MutableRefObject<number>;
  isCalibrated: boolean | null;
  onBack: () => void;
}) {
  const router = useRouter();
  const { videoRef, status: camStatus, error: camError } = useCamera();
  const { setCaptured, config } = useScanStore();

  const [processing, setProcessing] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || camStatus !== "ready" || processing) return;

    setProcessing(true);
    setErrMsg(null);

    const frame = extractFrame(video, 1);
    if (!frame) {
      setErrMsg("Could not capture frame from camera.");
      setProcessing(false);
      return;
    }

    const toleranceMm = config?.toleranceMm ?? 2.0;
    const outcome = await processImage(frame, pxPerMmRef.current, video, toleranceMm);

    if (!outcome.ok) {
      setErrMsg(outcome.message);
      setProcessing(false);
      return;
    }

    const r: ScanResult = outcome.result;
    setCaptured({
      blob:             new Blob(),
      dataUrl:          r.annotatedDataUrl,
      annotatedDataUrl: r.annotatedDataUrl,
      leftHeightMm:     r.leftMm,
      rightHeightMm:    r.rightMm,
      leftWidthMm:      0,
      rightWidthMm:     0,
      heightDiffMm:     r.diffMm,
      passed:           r.passed,
      rejectionReason:  r.rejectionReason,
    });

    setProcessing(false);
    router.push("/scan/result");
  }, [videoRef, camStatus, processing, pxPerMmRef, config, setCaptured, router]);

  return (
    <>
      <video ref={videoRef} className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} playsInline muted autoPlay />

      {camStatus === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#06b6d4" }} />
          <p className="text-sm font-medium" style={{ color: "#555" }}>Starting camera…</p>
        </div>
      )}

      {camStatus === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-black">
          <div className="text-center max-w-xs">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: "#f59e0b" }} />
            <p className="text-white font-bold mb-2">Camera unavailable</p>
            <p className="text-sm" style={{ color: "#666" }}>{camError}</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="pointer-events-auto flex items-center gap-3 px-4" style={{ paddingTop: "env(safe-area-inset-top, 12px)", paddingBottom: "12px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)" }}>
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "#fff" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk',sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Shoe Pair Inspection</p>
            <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.55)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>Position both shoes, then tap Capture</p>
          </div>
        </div>

        {isCalibrated === false && (
          <div className="pointer-events-auto mx-4 mt-1 rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.45)", backdropFilter: "blur(8px)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#f59e0b" }} />
            <p className="text-xs flex-1" style={{ color: "#fcd34d" }}>Station not calibrated — mm values may be inaccurate.</p>
            <button onClick={() => router.push("/admin/calibrate")} className="text-xs font-bold flex-shrink-0" style={{ color: "#f59e0b" }}>Fix</button>
          </div>
        )}

        {camStatus === "ready" && !processing && (
          <>
            {([
              { pos: { top: "52%", left: "4%" }, t: true, l: true, r: false, b: false },
              { pos: { top: "52%", right: "4%" }, t: true, l: false, r: true, b: false },
              { pos: { bottom: "14%", left: "4%" }, t: false, l: true, r: false, b: true },
              { pos: { bottom: "14%", right: "4%" }, t: false, l: false, r: true, b: true },
            ]).map(({ pos, t, l, r, b }, i) => (
              <div key={i} className="absolute w-8 h-8" style={{ ...pos, borderTopWidth: t ? "2px" : 0, borderLeftWidth: l ? "2px" : 0, borderRightWidth: r ? "2px" : 0, borderBottomWidth: b ? "2px" : 0, borderStyle: "solid", borderColor: "rgba(6,182,212,0.8)", borderRadius: "2px" }} />
            ))}
            <div className="absolute" style={{ left: "50%", top: "52%", bottom: "14%", width: "1px", transform: "translateX(-0.5px)", background: "repeating-linear-gradient(to bottom, rgba(6,182,212,0.5) 0px, rgba(6,182,212,0.5) 6px, transparent 6px, transparent 12px)" }} />
            <div className="absolute inset-x-0 flex justify-center" style={{ top: "calc(52% - 36px)" }}>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.1)" }}>Align both shoe heels inside the brackets</span>
            </div>
          </>
        )}

        <AnimatePresence>
          {processing && (
            <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-auto" style={{ background: "rgba(0,0,0,0.72)" }}>
              <Loader2 className="w-14 h-14 animate-spin" style={{ color: "#06b6d4" }} />
              <p className="text-white font-semibold">Analysing…</p>
              <p className="text-xs" style={{ color: "#555" }}>This takes 1–2 seconds</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {errMsg && (
            <motion.div key="err" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="absolute inset-x-4 rounded-2xl px-4 py-3 flex items-start gap-3 pointer-events-auto" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", backdropFilter: "blur(8px)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
              <p className="text-sm" style={{ color: "#fca5a5" }}>{errMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 flex flex-col items-center gap-3 pointer-events-auto" style={{ bottom: "calc(env(safe-area-inset-bottom, 16px) + 24px)", background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)", paddingTop: "40px", paddingBottom: "8px" }}>
          <button onClick={handleCapture} disabled={camStatus !== "ready" || processing} aria-label="Capture" className="disabled:opacity-40 active:scale-95 transition-transform" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: 80, height: 80, border: "3px solid rgba(255,255,255,0.85)", padding: 4 }}>
              <span className="flex items-center justify-center rounded-full" style={{ width: "100%", height: "100%", background: processing ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)", boxShadow: "0 0 20px rgba(255,255,255,0.3)" }}>
                {!processing && <Camera className="w-7 h-7" style={{ color: "#111" }} />}
              </span>
            </span>
          </button>
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>Tap to capture</p>
        </div>
      </div>
    </>
  );
}

function UploadView({
  pxPerMmRef,
  onBack
}: {
  pxPerMmRef: React.MutableRefObject<number>;
  onBack: () => void;
}) {
  const router = useRouter();
  const { setCaptured, config } = useScanStore();

  const [processing, setProcessing] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setErrMsg(null);
  };

  const handleUploadCapture = useCallback(async () => {
    if (!uploadFile || !uploadPreview) return;
    
    setProcessing(true);
    setErrMsg(null);

    try {
      const img = new Image();
      img.src = uploadPreview;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load image."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context.");
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const toleranceMm = config?.toleranceMm ?? 2.0;
      const outcome = await processImage(imageData, pxPerMmRef.current, null, toleranceMm);

      if (!outcome.ok) {
        setErrMsg(outcome.message);
        setProcessing(false);
        return;
      }

      const r: ScanResult = outcome.result;
      setCaptured({
        blob:             uploadFile,
        dataUrl:          r.annotatedDataUrl,
        annotatedDataUrl: r.annotatedDataUrl,
        leftHeightMm:     r.leftMm,
        rightHeightMm:    r.rightMm,
        leftWidthMm:      0,
        rightWidthMm:     0,
        heightDiffMm:     r.diffMm,
        passed:           r.passed,
        rejectionReason:  r.rejectionReason,
      });

      setProcessing(false);
      router.push("/scan/result");
    } catch (error) {
      setErrMsg(error instanceof Error ? error.message : "Failed to process uploaded image.");
      setProcessing(false);
    }
  }, [uploadFile, uploadPreview, pxPerMmRef, config, setCaptured, router]);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="pointer-events-auto flex items-center gap-3 px-4" style={{ paddingTop: "env(safe-area-inset-top, 12px)", paddingBottom: "12px", background: "rgba(9,9,11,1)" }}>
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "#fff" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk',sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Shoe Pair Inspection</p>
            <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.55)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>Upload an image to analyze</p>
          </div>
        </div>
      </div>
      
      <div className="absolute inset-0 flex flex-col items-center pt-24 px-6 pb-6 bg-zinc-950 overflow-y-auto pointer-events-auto">
        {!uploadPreview ? (
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-900 transition-colors bg-zinc-900/50 mt-12">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 mb-4 text-zinc-500" />
              <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold text-white">Click to upload</span></p>
              <p className="text-xs text-zinc-500">PNG, JPG or JPEG</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        ) : (
          <div className="w-full flex flex-col items-center mt-4">
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadPreview} alt="Upload preview" className="w-full h-auto object-contain max-h-[50vh]" />
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center max-w-sm w-full">
          <div className="text-xs text-zinc-400 mb-6 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-left flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <span className="font-bold text-amber-500 mb-1 block">Demo Mode Note</span>
              For reliable millimetre measurements, use an image captured with the calibrated inspection setup.
            </div>
          </div>
          
          {errMsg && (
            <div className="mb-4 rounded-xl px-4 py-3 flex items-start gap-3 bg-red-500/15 border border-red-500/40 text-left">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-300">{errMsg}</p>
            </div>
          )}
          
          {uploadPreview && (
            <button
              onClick={handleUploadCapture}
              disabled={processing}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl p-4 font-bold transition-colors shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
              Analyze Image
            </button>
          )}
          
          {uploadPreview && (
             <button 
                onClick={() => {
                  setUploadFile(null);
                  setUploadPreview(null);
                  setErrMsg(null);
                }}
                disabled={processing}
                className="w-full mt-3 text-zinc-400 hover:text-white p-3 text-sm font-medium transition-colors"
              >
                Choose Different Image
              </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function ScanPage() {
  const router = useRouter();
  const { setConfig } = useScanStore();
  
  const [mode, setMode] = useState<"select" | "camera" | "upload">("select");
  const [setupComplete, setSetupComplete] = useState(false);
  const [models, setModels] = useState<{id: string, name: string, tolerance_mm: number}[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isCalibrated, setIsCalibrated] = useState<boolean | null>(null);

  const calibLoadedRef = useRef(false);
  const pxPerMmRef     = useRef<number>(FALLBACK_PXMM);

  useEffect(() => {
    async function fetchModels() {
      const sb = createClient();
      const { data } = await sb.from("shoe_models").select("id, name, tolerance_mm").order("name");
      if (data) setModels(data);
    }
    fetchModels();
  }, []);

  const loadCal = useCallback(async () => {
    if (calibLoadedRef.current) return;
    calibLoadedRef.current = true;
    const local = getLocalCalibration();
    if (local) { pxPerMmRef.current = local.pxPerMm; setIsCalibrated(true); return; }
    const remote = await loadCalibration(STATION_ID);
    if (remote) { pxPerMmRef.current = remote.pxPerMm; setIsCalibrated(true); }
    else { setIsCalibrated(false); }
  }, []);

  useEffect(() => { loadCal(); }, [loadCal]);

  return (
    <div className="fixed inset-0 z-50" style={{ background: "#000", height: "100dvh" }}>
      {!setupComplete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.9)" }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl pointer-events-auto">
            <h2 className="text-xl font-bold text-white mb-6">Scan Setup</h2>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Select Shoe Model</label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Choose a model --</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Tol: {m.tolerance_mm}mm)</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                const model = models.find(m => m.id === selectedModelId);
                if (model) {
                  setConfig({ 
                    batchId: `BATCH-${Date.now()}`,
                    shoeModelId: model.id,
                    toleranceMm: model.tolerance_mm
                  });
                  setSetupComplete(true);
                }
              }}
              disabled={!selectedModelId}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl p-3.5 font-bold transition-colors"
            >
              Start Inspection
            </button>
            <button
              onClick={() => router.back()}
              className="w-full mt-3 text-zinc-400 hover:text-white p-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {setupComplete && mode === "select" && (
        <div className="absolute inset-0 flex flex-col bg-zinc-950 pointer-events-auto z-10 p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8" style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}>
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>New Inspection</h1>
          </div>
          
          <h2 className="text-zinc-400 text-sm font-medium mb-4 uppercase tracking-wider">Choose input method</h2>
          
          <div className="grid gap-4">
            <button 
              onClick={() => setMode("camera")}
              className="flex flex-col text-left bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800/80 rounded-2xl p-5 transition-all group"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-900 group-hover:text-cyan-300 transition-colors">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Live Camera</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Capture the shoe pair using the calibrated inspection camera.
              </p>
            </button>
            
            <button 
              onClick={() => setMode("upload")}
              className="flex flex-col text-left bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800/80 rounded-2xl p-5 transition-all group"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-900 group-hover:text-indigo-300 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Upload Image</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Select an existing footwear image from this device for inspection.
              </p>
            </button>
          </div>
        </div>
      )}

      {setupComplete && mode === "camera" && (
        <CameraView 
          pxPerMmRef={pxPerMmRef} 
          isCalibrated={isCalibrated} 
          onBack={() => setMode("select")} 
        />
      )}

      {setupComplete && mode === "upload" && (
        <UploadView 
          pxPerMmRef={pxPerMmRef} 
          onBack={() => setMode("select")} 
        />
      )}
    </div>
  );
}
