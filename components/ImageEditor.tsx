"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Undo2 } from "lucide-react";
import { useOverlay } from "@/hooks/useOverlay";

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Setup canvas dimensions to match image ratio
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.6;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      setHistory([ctx.getImageData(0, 0, width, height)]);
      setImageLoaded(true);
    };
    // Assign src only after onload is attached so a cached image can't be missed.
    img.src = imageUrl;
  }, [imageUrl]);

  // Focus trap, Escape to cancel, scroll lock and focus return.
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(true, panelRef, onCancel);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    // Fires on mouse-out too: only record a history step if a stroke happened.
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ef4444"; // red 500 for highlighting issues

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || history.length <= 1) return;

    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || history.length === 0) return;

    const initial = history[0];
    setHistory([initial]);
    ctx.putImageData(initial, 0, 0);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/jpeg", 0.9));
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-editor-title"
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex flex-col bg-[#0c0f15] outline-none animate-fade-in"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 id="image-editor-title" className="text-sm font-semibold text-white">
            Mark the problem
          </h2>
          <p className="text-xs text-white/60">Draw on the photo to point out what needs fixing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={history.length <= 1} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40">
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
          </button>
          <button type="button" onClick={clear} disabled={history.length <= 1} className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40">
            Clear
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!imageLoaded} className="inline-flex h-9 items-center rounded-md bg-[#2f62d6] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#3a6ee3] disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          aria-label="Photo drawing area"
          className="max-h-full max-w-full cursor-crosshair touch-none rounded-md bg-black"
        />
      </div>
    </div>,
    document.body
  );
}
