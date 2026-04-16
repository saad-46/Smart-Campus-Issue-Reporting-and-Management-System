"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { parseChatMessage } from "@/services/aiService";
import { Priority } from "@/types";

interface Message {
  id: string;
  role: "user" | "system";
  text: string;
  isTyping?: boolean;
}

interface ParsedIssue {
  title: string;
  description: string;
  location: string;
  category: string;
  priority: Priority;
}

interface ChatReporterProps {
  onIssueCreated?: () => void;
}

const WELCOME =
  "Hi! Describe your campus issue in plain English — e.g. \"There's a water leak near Block A\" — and I'll handle the rest.";

export default function ChatReporter({ onIssueCreated }: ChatReporterProps) {
  const { userProfile } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "system", text: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedIssue | null>(null);
  const [stage, setStage] = useState<"chat" | "confirm" | "done">("chat");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(role: "user" | "system", text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text },
    ]);
  }

  function addTyping() {
    const id = `typing-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id, role: "system", text: "", isTyping: true },
    ]);
    return id;
  }

  function removeTyping(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || stage !== "chat") return;
    setInput("");
    addMessage("user", text);

    const typingId = addTyping();
    try {
      const result = await parseChatMessage(text);
      removeTyping(typingId);
      setParsed(result);
      setStage("confirm");
      addMessage(
        "system",
        `Got it! Here's what I extracted:\n\n📌 **Title:** ${result.title}\n📍 **Location:** ${result.location}\n🏷️ **Category:** ${result.category}\n⚡ **Priority:** ${result.priority}\n\nShall I submit this issue?`
      );
    } catch {
      removeTyping(typingId);
      addMessage(
        "system",
        "Sorry, I couldn't parse that. Could you describe the issue with a bit more detail?"
      );
    }
  }

  async function handleConfirm(yes: boolean) {
    if (!yes) {
      setParsed(null);
      setStage("chat");
      addMessage("system", "No problem! Please describe the issue again.");
      return;
    }
    if (!parsed || !userProfile) return;
    setSubmitting(true);
    try {
      await createIssue(
        { title: parsed.title, description: parsed.description, location: parsed.location },
        userProfile.id,
        userProfile.name,
        parsed.category,
        parsed.priority
      );
      setStage("done");
      addMessage("system", "✅ Issue submitted successfully! You can view it in your dashboard.");
      onIssueCreated?.();
    } catch {
      addMessage("system", "❌ Failed to submit. Please try again.");
      setStage("chat");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setMessages([{ id: "welcome2", role: "system", text: WELCOME }]);
    setParsed(null);
    setStage("chat");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className="flex flex-col h-[520px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">AI Issue Reporter</p>
          <p className="text-xs text-white/70">Describe your issue naturally</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-white/70">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "system" && (
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
              }`}
            >
              {msg.isTyping ? (
                <span className="flex items-center gap-1 py-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Confirm buttons */}
      {stage === "confirm" && (
        <div className="px-4 pb-3 flex gap-2 shrink-0">
          <button
            onClick={() => handleConfirm(true)}
            disabled={submitting}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "✅ Yes, Submit"}
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={submitting}
            className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            ✏️ Edit
          </button>
        </div>
      )}

      {/* Done state */}
      {stage === "done" && (
        <div className="px-4 pb-3 shrink-0">
          <button
            onClick={handleReset}
            className="w-full py-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-xl hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
          >
            + Report Another Issue
          </button>
        </div>
      )}

      {/* Input */}
      {stage === "chat" && (
        <div className="px-4 pb-4 pt-2 flex gap-2 shrink-0 border-t border-gray-100 dark:border-white/10">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Describe the issue…"
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
