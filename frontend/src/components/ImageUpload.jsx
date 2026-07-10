import React, { useRef, useState } from "react";
import { UploadCloud, X, RefreshCw, Camera, AlertCircle } from "lucide-react";

export function ImageUpload({
  label,
  description,
  selectedImage,
  onImageSelected,
  onImageRemoved,
  allowWebcam = false,
  onWebcamTrigger
}) {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFile = (file) => {
    setErrorMessage("");
    if (!file) return;

    // Validate size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage("File exceeds 5MB limit. Please compress it first.");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Invalid format. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onImageSelected(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = () => {
    setIsDragActive(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full animate-fade-in">
      <div className="flex justify-between items-center">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
        {selectedImage && (
          <div className="flex items-center gap-2">
            {allowWebcam ? (
              <>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                  title="Replace from Gallery"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Gallery
                </button>
                <span className="text-slate-350 dark:text-slate-650">|</span>
                <button
                  type="button"
                  onClick={onWebcamTrigger}
                  className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                  title="Replace from Webcam"
                >
                  <Camera className="w-3.5 h-3.5" /> Webcam
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={triggerFileInput}
                className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                title="Replace Image"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Replace
              </button>
            )}
            <span className="text-slate-350 dark:text-slate-650">|</span>
            <button
              type="button"
              onClick={onImageRemoved}
              className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFile(e.target.files?.[0])}
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
      />

      {selectedImage ? (
        // Preview State
        <div className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-[4/5] flex items-center justify-center shadow-inner">
          <img
            src={selectedImage}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <span className="text-xs text-white/90 font-medium">Hovering preview</span>
          </div>
        </div>
      ) : (
        // Upload/Drop Zone State
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={triggerFileInput}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl aspect-[4/5] p-6 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? "border-primary-500 bg-primary-50/10 dark:bg-primary-950/10"
              : "border-slate-200 dark:border-slate-800 hover:border-primary-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-900"
          }`}
        >
          <div className="p-3 rounded-full bg-primary-50 dark:bg-primary-950/20 text-primary-500 mb-4 shadow-sm">
            <UploadCloud className="w-8 h-8 stroke-[1.5]" />
          </div>

          <p className="font-medium text-sm text-slate-800 dark:text-slate-200 mb-1">
            Drag & drop here, or <span className="text-primary-500 hover:underline">browse</span>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px] mb-4">
            {description || "JPG, PNG or WEBP, max 5MB"}
          </p>

          {allowWebcam && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Avoid triggering parent click file picker
                onWebcamTrigger();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm transform active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-primary-500" />
              Use Webcam Capture
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-1 font-medium bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
export default ImageUpload;
