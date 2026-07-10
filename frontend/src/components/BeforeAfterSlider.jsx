import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChevronsLeftRight } from "lucide-react";

export function BeforeAfterSlider({ beforeImage, afterImage }) {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 to 100 %
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  const onMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove]
  );

  const onTouchMove = useCallback(
    (e) => {
      if (!isDragging) return;
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    },
    [isDragging, handleMove]
  );

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up global mouse/touch event listeners during drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [isDragging, onMouseMove, onTouchMove, onMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden select-none border border-slate-200 dark:border-slate-800 shadow-lg cursor-ew-resize bg-slate-100 dark:bg-slate-900"
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
    >
      {/* Before Image (Left / Background) */}
      <img
        src={beforeImage}
        alt="Original Person"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* After Image (Right / Foreground clipped) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
      >
        <img
          src={afterImage}
          alt="Virtual Try-On Result"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* Split Divider Handle */}
      <div
        className="absolute inset-y-0 w-1 bg-white cursor-ew-resize flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute w-8 h-8 rounded-full bg-white text-slate-800 shadow-lg border border-slate-200 flex items-center justify-center transform -translate-y-1/2 top-1/2 focus:outline-none hover:scale-105 active:scale-95 transition-transform">
          <ChevronsLeftRight className="w-4 h-4 text-primary-500" />
        </div>
      </div>

      {/* Badges */}
      <span className="absolute bottom-4 left-4 px-3 py-1 text-[10px] font-bold text-white bg-black/60 rounded-full backdrop-blur-sm pointer-events-none uppercase tracking-wider">
        Original
      </span>
      <span className="absolute bottom-4 right-4 px-3 py-1 text-[10px] font-bold text-white bg-primary-500/80 rounded-full backdrop-blur-sm pointer-events-none uppercase tracking-wider">
        Try-On Result
      </span>
    </div>
  );
}
export default BeforeAfterSlider;
