"use client";

import React, { useRef, useState, useEffect } from "react";

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
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
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
  }, [imageUrl]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
      <div className="flex gap-4 mb-4">
        <button onClick={undo} disabled={history.length <= 1} className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50">
          Undo
        </button>
        <button onClick={clear} disabled={history.length <= 1} className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50">
          Clear
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-700 text-white rounded-lg">
          Cancel
        </button>
        <button onClick={save} disabled={!imageLoaded} className="px-4 py-2 bg-purple-600 text-white rounded-lg">
          Save Edits
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
        className="border border-gray-700 rounded-lg cursor-crosshair shadow-2xl bg-gray-900 touch-none"
      />
      
      <p className="text-gray-400 mt-4 text-sm font-medium">Draw to highlight the issue</p>
    </div>
  );
}
