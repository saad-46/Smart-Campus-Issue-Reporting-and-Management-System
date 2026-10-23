"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { describeCameraError } from "@/lib/camera";

/**
 * Live camera preview with a capture button. The camera is requested only
 * after the person opens this dialog, and every track is stopped when it
 * closes, when a photo is taken, or when the component goes away. The
 * captured frame is handed back as a normal image File, so it follows the
 * same validation, compression and upload path as a chosen file.
 */
export default function CameraCapture({
  open,
  onClose,
  onCapture,
  onUploadInstead,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Offered whenever the camera can't be used. */
  onUploadInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "failed">("starting");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");
    setError("");
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) {
          // Closed while the permission prompt was open: release it at once.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(describeCameraError(err).message);
        setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("The camera isn't ready yet. Wait a moment and try again.");
      return;
    }
    // Cap the long edge so a 4K webcam frame can't exhaust memory.
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Couldn't capture the photo. You can upload one instead.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          setError("Couldn't capture the photo. Please try again.");
          return;
        }
        stop();
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Take a photo"
      description="Your browser will ask for camera access. Nothing is recorded until you press Take photo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {status === "failed" ? (
            <Button
              onClick={() => {
                onClose();
                onUploadInstead();
              }}
            >
              Upload a photo instead
            </Button>
          ) : (
            <Button onClick={capture} disabled={status !== "ready"} icon={<Camera className="h-4 w-4" aria-hidden="true" />}>
              Take photo
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 px-5 py-4">
        {status !== "failed" && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} muted playsInline aria-label="Camera preview" className="h-full w-full object-cover" />
            {status === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting the camera…</p>}
          </div>
        )}
        {error && (
          <Notice tone={status === "failed" ? "danger" : "warning"} title={status === "failed" ? "Camera unavailable" : undefined}>
            {error}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
