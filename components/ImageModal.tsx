"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOverlay } from "@/hooks/useOverlay";
import { usePortalReady } from "@/components/ui/Dialog";

interface ImageModalProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

/** Full-screen photo viewer. Escape, the close button or a click outside closes it. */
export default function ImageModal({ imageUrl, alt, onClose }: ImageModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = usePortalReady();
  useOverlay(true, ref, onClose);
  if (!ready) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 outline-none animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img src={imageUrl} alt={alt} className="max-h-[88dvh] max-w-full rounded-md object-contain animate-dialog-in" />
    </div>,
    document.body
  );
}
