import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, X, Video, Image as ImageIcon, Loader2, AlertTriangle } from "lucide-react";

export function WebcamCapture({ onCapture, onClose }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [permissionState, setPermissionState] = useState("loading"); // "loading" | "granted" | "denied"
  const [errorMessage, setErrorMessage] = useState("");

  // Enumerate cameras
  const handleDevices = useCallback(
    (mediaDevices) => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    },
    [selectedDeviceId]
  );

  // Request camera permission and then enumerate devices
  const requestCameraAccess = useCallback(() => {
    setPermissionState("loading");
    setErrorMessage("");
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        setPermissionState("granted");
        // Stop temporary track to release stream so react-webcam can claim it
        stream.getTracks().forEach((track) => track.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(handleDevices)
      .catch((err) => {
        console.error("Camera access permission denied or failed:", err);
        setPermissionState("denied");
        setErrorMessage("Camera permission denied. Please allow camera access in your browser settings to take a photo.");
      });
  }, [handleDevices]);

  useEffect(() => {
    requestCameraAccess();
  }, [requestCameraAccess]);

  // Convert base64 dataURI to JS File object
  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(","),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const captureSnapshot = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const file = dataURLtoFile(imageSrc, `webcam_${Date.now()}.jpg`);
        onCapture(file, imageSrc);
      }
    }
  }, [webcamRef, onCapture]);

  // Run 3-second countdown before taking shot
  const triggerCountdown = () => {
    if (countdown !== null) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      captureSnapshot();
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, captureSnapshot]);

  // Handle Gallery Upload from Webcam capture modal
  const triggerGalleryInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleGalleryUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File exceeds the 5MB limit. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onCapture(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Hidden File Input for Gallery */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleGalleryUpload}
          className="hidden"
        />

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-lg text-slate-850 dark:text-white">Capture Photo</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action/Video Area */}
        <div className="relative flex-grow bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
          {permissionState === "loading" && (
            <div className="text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              <p className="text-sm font-medium">Requesting camera access...</p>
            </div>
          )}

          {permissionState === "denied" && (
            <div className="p-6 text-slate-400 flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-white">Camera Access Denied</p>
                <p className="text-xs text-slate-400">{errorMessage}</p>
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={requestCameraAccess}
                  className="flex-1 py-2 px-3 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all"
                >
                  Try Camera Again
                </button>
                <button
                  onClick={triggerGalleryInput}
                  className="flex-1 py-2 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-250 rounded-lg transition-all flex items-center justify-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Choose Gallery
                </button>
              </div>
            </div>
          )}

          {permissionState === "granted" && selectedDeviceId ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ deviceId: selectedDeviceId }}
              className="w-full h-full object-cover"
            />
          ) : (
            permissionState === "granted" && (
              <div className="text-slate-500 flex flex-col items-center gap-2">
                <Video className="w-12 h-12 stroke-[1.5]" />
                <p>No video devices found.</p>
              </div>
            )
          )}

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm select-none">
              <span className="text-white text-8xl font-bold animate-ping">{countdown}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-5 flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Camera Selection */}
          {permissionState === "granted" && devices.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-455 dark:text-slate-400 uppercase">Select Camera:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="flex-grow text-sm py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center w-full">
            {/* Gallery Fallback in Controls Footer */}
            <button
              onClick={triggerGalleryInput}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-250 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm"
            >
              <ImageIcon className="w-4 h-4 text-primary-500" />
              Choose from Gallery
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              {permissionState === "granted" && (
                <button
                  onClick={triggerCountdown}
                  disabled={countdown !== null}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-xl shadow-md shadow-primary-500/10 hover:shadow-primary-600/25 active:scale-[0.98] transition-all"
                >
                  <Camera className="w-4 h-4" />
                  {countdown !== null ? "Snapping..." : "Take Snapshot"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default WebcamCapture;
