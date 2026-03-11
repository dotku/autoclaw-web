"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDictionary, type Locale } from "@/lib/i18n";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function ChatWidget() {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const td = dict.dashboard;
  const tc = dict.common;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Hide on the chat page itself
  const isChatPage = pathname?.endsWith("/dashboard/chat");

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);
    const tempMsg: ChatMessage = { id: Date.now(), role: "user", content: userMsg, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempMsg]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: data.reply, created_at: new Date().toISOString() }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: td.errorMsg, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  if (isChatPage) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 cursor-pointer text-2xl"
          title={tc.chat}
        >
          🦞
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-red-700 text-white flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm">{tc.chat}</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && loaded && (
              <p className="text-xs text-gray-400 text-center mt-8">{td.typeMessage}</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-1.5`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-1 text-xs">🦞</div>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-red-600 text-white"
                      : "bg-gray-50 text-gray-800 border border-gray-200"
                  }`}
                >
                  <div className={`prose prose-sm max-w-none [&>p]:my-0.5 [&>ul]:my-0.5 [&>ol]:my-0.5 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs [&_pre]:text-xs [&_code]:text-xs ${msg.role === "user" ? "prose-invert" : "prose-gray"}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-lg text-sm">
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-3 py-3 border-t border-gray-200 flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={td.typeMessage}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-red-800 hover:bg-red-900 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {tc.send}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
