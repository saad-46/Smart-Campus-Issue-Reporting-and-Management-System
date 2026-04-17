"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import { subscribeToSingleIssue } from "@/lib/firestore";
import { subscribeToIssueChat, sendChatMessage } from "@/services/chatService";
import { Issue, ChatMessage } from "@/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";

function IssueDetailContent() {
  const { id } = useParams() as { id: string };
  const { userProfile } = useAuthContext();
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const unsubIssue = subscribeToSingleIssue(id, (fetched) => {
      setIssue(fetched);
      setLoading(false);
    });
    
    const unsubChat = subscribeToIssueChat(id, (fetchedMsgs) => {
      setMessages(fetchedMsgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => {
      unsubIssue();
      unsubChat();
    };
  }, [id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !userProfile || !issue) return;
    
    const text = chatInput.trim();
    setChatInput("");
    
    try {
      await sendChatMessage(id, text, userProfile.id, userProfile.name, userProfile.role);
    } catch {
      console.error("Failed to send message");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex-1 p-8 text-center text-gray-400">
        <h2 className="text-xl font-bold text-white mb-2">Issue Not Found</h2>
        <p>The issue you are looking for does not exist or was deleted.</p>
        <button onClick={() => router.back()} className="mt-4 text-indigo-400 hover:text-indigo-300">
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center glass rounded-xl hover:bg-gray-800/50 transition border border-gray-800">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{issue.title}</h1>
          <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
            <span>Reported by {issue.createdByName}</span>
            <span>•</span>
            <span>{issue.createdAt.toLocaleDateString()}</span>
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left Col: Details */}
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
          <div className="glass rounded-2xl p-6 border border-gray-800/60 shadow-xl flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 font-mono">
                {issue.category}
              </span>
            </div>

            {(issue.imageUrls?.length ? issue.imageUrls : issue.imageUrl ? [issue.imageUrl] : []).length > 0 && (
              <div className={`grid gap-2 ${(issue.imageUrls || []).length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {(issue.imageUrls?.length ? issue.imageUrls : [issue.imageUrl as string]).map((url, i) => (
                  <img key={i} src={url} alt={`Issue image ${i+1}`} className="w-full rounded-xl object-cover border border-gray-800 shadow-md max-h-64 cursor-pointer hover:opacity-90" />
                ))}
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm text-gray-300 leading-relaxed bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
                {issue.description}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Location
              </h3>
              <p className="text-sm font-medium text-gray-200">{issue.location}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Live Chat Area */}
        <div className="lg:col-span-2 glass flex flex-col rounded-2xl border border-gray-800/60 shadow-xl overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="px-6 py-4 border-b border-gray-800/80 bg-gray-900/40 shrink-0">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Discussion Thread
            </h2>
            <p className="text-xs text-gray-500 mt-1">Communicate directly regarding this issue.</p>
          </div>

          {(() => {
            const activeRole = localStorage.getItem("role") || userProfile?.activeRole || userProfile?.role;
            const canChat = userProfile?.id === issue.createdBy || activeRole === "worker" || activeRole === "admin";
            
            if (!canChat) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <h3 className="text-white font-medium mb-2">Restricted Access</h3>
                  <p className="text-sm max-w-sm">
                    Chat is strictly limited to the original author and assigned workers / admins to protect privacy.
                  </p>
                </div>
              );
            }

            return (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 custom-scrollbar bg-gray-950/20">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-gray-500">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.authorId === userProfile?.id;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-medium text-gray-300">{isMe ? "You" : msg.authorName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-widest font-bold ${
                        msg.authorRole === "worker" ? "bg-indigo-500/20 text-indigo-400" :
                        msg.authorRole === "admin" ? "bg-rose-500/20 text-rose-400" :
                        "bg-gray-800 text-gray-400"
                      }`}>{msg.authorRole}</span>
                    </div>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isMe 
                      ? "bg-indigo-600 text-white rounded-tr-sm" 
                      : "bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-gray-800/80 bg-gray-900/80 shrink-0 flex gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              Send
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                </button>
              </form>
            </>
          );
        })()}
        </div>
      </div>
    </div>
  );
}

export default function IssueDetailPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-950 flex">
        <Sidebar />
        <main className="flex-1 md:ml-64 transition-all duration-300">
          <IssueDetailContent />
        </main>
      </div>
    </ProtectedRoute>
  );
}
