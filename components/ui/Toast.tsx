"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Render Host */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-5
              ${toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : ""}
              ${toast.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : ""}
              ${toast.type === "info" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : ""}
            `}
          >
            {toast.type === "success" && <span>✅</span>}
            {toast.type === "error" && <span>❌</span>}
            {toast.type === "info" && <span>ℹ️</span>}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
