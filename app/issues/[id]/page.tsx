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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-200 dark:border-white/10 shadow-lg transition-all duration-200 hover:shadow-xl flex flex-col gap-6">
            <div className="border-b border-gray-100 dark:border-white/5 pb-4">
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Issue Summary</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5">
                {issue.category}
              </span>
            </div>

            <div className="space-y-6">
              {/* Section: Title */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <label className="text-[10px] font-black uppercase tracking-widest">Title</label>
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{issue.title}</p>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              {/* Section: Description */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7"/></svg>
                  <label className="text-[10px] font-black uppercase tracking-widest">Description</label>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {issue.description}
                  </p>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              {/* Section: Location */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <label className="text-[10px] font-black uppercase tracking-widest">Location</label>
                </div>
                <p className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">{issue.location}</p>
              </div>

              {(issue.imageUrls?.length ? issue.imageUrls : issue.imageUrl ? [issue.imageUrl] : []).length > 0 && (
                <>
                  <div className="h-px bg-gray-100 dark:bg-white/5" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <label className="text-[10px] font-black uppercase tracking-widest">Attached Images</label>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 grid grid-cols-2 gap-4">
                      {(issue.imageUrls?.length ? issue.imageUrls : [issue.imageUrl as string]).map((url, i) => (
                        <div 
                          key={i} 
                          onClick={() => setSelectedImageUrl(url)}
                          className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-md aspect-square cursor-zoom-in"
                        >
                          <img src={url} alt={`Issue preview ${i+1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Live Chat Area */}
        <div className="lg:col-span-2 bg-slate-50/50 dark:bg-[#0F172A] flex flex-col rounded-[32px] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="px-8 py-5 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.02] backdrop-blur-md shrink-0 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-glow shadow-emerald-500/50" />
                Live Discussion
              </h2>
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase tracking-tight">Real-time issue resolution thread</p>
            </div>
          </div>

          {(() => {
            const activeRole = localStorage.getItem("role") || userProfile?.activeRole || userProfile?.role;
            const canChat = userProfile?.id === issue.createdBy || activeRole === "worker" || activeRole === "admin";
            
            if (!canChat) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <svg className="w-10 h-10 text-slate-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tight mb-2">Private Thread</h3>
                  <p className="text-sm font-medium max-w-sm mx-auto opacity-70">
                    Communication is limited to the author and assigned experts.
                  </p>
                </div>
              );
            }

            return (
              <>
                <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-slate-400">
                <div className="w-24 h-24 bg-white dark:bg-white/[0.02] rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                  <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-xs font-black uppercase tracking-widest opacity-40">No messages yet</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.authorId === userProfile?.id;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{isMe ? "You" : msg.authorName}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-tighter font-black shadow-sm ${
                        msg.authorRole === "worker" ? "bg-indigo-500 text-white" :
                        msg.authorRole === "admin" ? "bg-rose-500 text-white" :
                        "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-gray-300"
                      }`}>{msg.authorRole}</span>
                    </div>
                    <div className={`px-5 py-3.5 rounded-2xl text-sm font-medium leading-relaxed shadow-xl break-words ${
                      isMe 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none" 
                      : "bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 text-slate-800 dark:text-gray-100 rounded-tl-none"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          <form onSubmit={handleSend} className="p-6 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl shrink-0 flex gap-4">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-100 dark:bg-[#020617] border-2 border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3"
            >
              <span className="hidden sm:inline">Send</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </form>
            </>
          );
        })()}
        </div>
      </div>
      {/* Image Zoom Modal */}
      {selectedImageUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-10 transition-all duration-300 animate-in fade-in"
          onClick={() => setSelectedImageUrl(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"
            onClick={() => setSelectedImageUrl(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <img 
              src={selectedImageUrl} 
              alt="Zoomed issue preview" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
            />
          </div>
        </div>
      )}
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
