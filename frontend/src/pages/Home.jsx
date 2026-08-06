import React, { useState } from "react";
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Shirt, 
  AlertTriangle,
  RotateCcw,
  Sliders
} from "lucide-react";
import ImageUpload from "../components/ImageUpload";
import WebcamCapture from "../components/WebcamCapture";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import { ThemeToggle } from "../components/ThemeToggle";
import { 
  uploadPersonImage, 
  uploadClothImage, 
  generateTryOn, 
  cleanupSession,
  getFullUrl 
} from "../services/api";

export function Home() {
  // Input states
  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState(null);
  const [clothFile, setClothFile] = useState(null);
  const [clothPreview, setClothPreview] = useState(null);
  const [category, setCategory] = useState("upper");
  const [preserveArms, setPreserveArms] = useState(true);

  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [webcamTarget, setWebcamTarget] = useState(null); // 'person' | 'cloth' | null

  // Result states
  const [resultId, setResultId] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  // Mode is always local system
  const mode = "system";
  const prompt = "";

  // Handle webcam capture
  const handleWebcamCapture = (file, previewUrl) => {
    if (webcamTarget === "person") {
      setPersonFile(file);
      setPersonPreview(previewUrl);
    } else if (webcamTarget === "cloth") {
      setClothFile(file);
      setClothPreview(previewUrl);
    }
    setWebcamTarget(null);
  };

  // Reset all fields
  const handleResetAll = async () => {
    if (resultId) {
      try {
        await cleanupSession(resultId);
      } catch (e) {
        console.warn("Session cleanup failed:", e);
      }
    }
    setPersonFile(null);
    setPersonPreview(null);
    setClothFile(null);
    setClothPreview(null);
    setPreserveArms(true);
    setResultId(null);
    setResultUrl(null);
    setError("");
  };

  // Keep images but reset try-on result to edit again
  const handleGenerateAnother = async () => {
    if (resultId) {
      try {
        await cleanupSession(resultId);
      } catch (e) {
        console.warn("Session cleanup failed:", e);
      }
    }
    setResultId(null);
    setResultUrl(null);
    setError("");
  };

  // Submit try-on request
  const handleGenerate = async () => {
    if (!personPreview || !personFile) {
      setError("Please upload or capture a person image first.");
      return;
    }
    if (!clothPreview || !clothFile) {
      setError("Please upload a clothing image first.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResultUrl(null);

    try {
      // Step 1: Upload Person Image
      setProgressText("Uploading person image to local server...");
      const personRes = await uploadPersonImage(personFile);
      const personId = personRes.id;

      // Step 2: Upload Clothing Image
      setProgressText("Uploading clothing image to local server...");
      const clothRes = await uploadClothImage(clothFile);
      const clothId = clothRes.id;

      // Step 3: Trigger virtual try-on/inpainting
      setProgressText("Loading PyTorch model & executing local pipeline. This may take up to 60s...");
      const generateRes = await generateTryOn({
        personId,
        clothId,
        category,
        prompt,
        height: 512,
        width: 512,
        mode,
        preserveArms
      });

      setResultId(generateRes.result_id);
      setResultUrl(getFullUrl(generateRes.url));
      
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Generation failed. Ensure the local server is running and has enough GPU/CPU memory."
      );
    } finally {
      setIsGenerating(false);
      setProgressText("");
    }
  };

  // Download resulting image
  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `tryon_result_${resultId || "output"}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary-500 rounded-xl text-white shadow-md shadow-primary-500/25">
            <Shirt className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-905 dark:text-white">Virtual Try-On</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Local AI Virtual Try-On Studio</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Studio Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Upload Controls */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary-500" />
                Try-On Setup
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Configure your model, upload assets, and prompt your styles.</p>
            </div>

            {/* Twin Image Uploader */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Person Card */}
              <ImageUpload
                label="Person Silhouette"
                description="Upload your picture or snap a live webphoto."
                selectedImage={personPreview}
                onImageSelected={(file, preview) => {
                  setPersonFile(file);
                  setPersonPreview(preview);
                }}
                onImageRemoved={() => {
                  setPersonFile(null);
                  setPersonPreview(null);
                }}
                allowWebcam={true}
                onWebcamTrigger={() => setWebcamTarget("person")}
              />

              {/* Garment Card */}
              <ImageUpload
                label="Target Garment"
                description="Upload the garment image to place on person."
                selectedImage={clothPreview}
                onImageSelected={(file, preview) => {
                  setClothFile(file);
                  setClothPreview(preview);
                }}
                onImageRemoved={() => {
                  setClothFile(null);
                  setClothPreview(null);
                }}
                allowWebcam={true}
                onWebcamTrigger={() => setWebcamTarget("cloth")}
              />
            </div>

            {/* Category / Area Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Garment Category Selection
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                {[
                  { id: "upper", name: "Upper Body" },
                  { id: "lower", name: "Lower Body" },
                  { id: "dress", name: "Full Body / Dress" }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      category === cat.id
                        ? "bg-white dark:bg-slate-800 text-primary-500 shadow-sm"
                        : "text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Preserve Arms Option */}
            {category !== "lower" && (
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 transition-all">
                <div className="flex flex-col gap-0.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none" htmlFor="preserve-arms-toggle">
                    Preserve Original Arms
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[280px]">
                    Keep your original arms visible. Uncheck if you want the garment's sleeves to cover your arms completely.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="preserve-arms-toggle"
                    type="checkbox"
                    checked={preserveArms}
                    onChange={(e) => setPreserveArms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-650 peer-checked:bg-primary-500"></div>
                </label>
              </div>
            )}





            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !personPreview || !clothPreview}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-primary-500/20 hover:shadow-primary-600/35 transition-all transform active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4 text-amber-250 animate-pulse" />
              {isGenerating ? "Processing Local AI Pipeline..." : "Generate Virtual Try-On"}
            </button>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/25 p-4 rounded-2xl text-xs text-rose-500 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Results Viewer */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col gap-6 h-full justify-between min-h-[480px]">
            
            {/* Conditional Render States */}
            {!isGenerating && !resultUrl && (
              // Empty/Preview State
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-4">
                  <Sparkles className="w-10 h-10 stroke-[1.2]" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Result Preview Studio</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[240px]">
                  Configure try-on settings on the left, click Generate, and watch the AI magic happen here.
                </p>
              </div>
            )}

            {isGenerating && (
              // Loading/In-Progress State
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 gap-6">
                {/* Modern progressive spinner */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full" />
                  <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
                
                <div className="flex flex-col gap-2 max-w-[280px]">
                  <h3 className="font-bold text-slate-800 dark:text-white animate-pulse">Running AI Pipeline...</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 transition-all duration-300">
                    {progressText}
                  </p>
                  <div className="w-full bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden mt-1.5 shadow-inner">
                    <div className="bg-primary-500 h-full rounded-full animate-[loading_15s_ease-out_infinite]" />
                  </div>
                </div>
              </div>
            )}

            {!isGenerating && resultUrl && (
              // Result Success State
              <div className="flex-grow flex flex-col gap-6 animate-fade-in">
                <BeforeAfterSlider 
                  beforeImage={personPreview} 
                  afterImage={resultUrl} 
                />
                
                {/* Result buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm shadow-md shadow-primary-500/10 hover:shadow-primary-600/30 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download Try-On Image
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleGenerateAnother}
                      className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Another Style
                    </button>
                    <button
                      onClick={handleResetAll}
                      className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Studio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hint alert box */}
            <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 px-4 py-3 rounded-2xl flex items-center justify-center text-center pointer-events-none">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                100% Local Inference • GPU Optimized (RTX 3050 4GB)
              </span>
            </div>

          </div>
        </section>

      </main>

      {/* Webcam modal */}
      {webcamTarget && (
        <WebcamCapture
          onCapture={handleWebcamCapture}
          onClose={() => setWebcamTarget(null)}
        />
      )}
    </div>
  );
}
export default Home;
