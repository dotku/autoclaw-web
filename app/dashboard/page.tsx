"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  agent_type?: string;
  created_at: string;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  plan: string;
  amount: number | null;
  interval: string;
  cancel_at_period_end: boolean;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: string | null) {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    open: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    void: "bg-red-100 text-red-700",
    uncollectible: "bg-red-100 text-red-700",
    past_due: "bg-red-100 text-red-700",
    canceled: "bg-gray-100 text-gray-600",
    trialing: "bg-blue-100 text-blue-700",
    paused: "bg-yellow-100 text-yellow-700",
  };
  const s = status || "unknown";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}
    >
      {s}
    </span>
  );
}

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState<"chat" | "billing">("chat");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Billing state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

  // Load chat history
  useEffect(() => {
    if (!user) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []));
  }, [user]);

  // Load billing when tab opens
  useEffect(() => {
    if (!user || activeTab !== "billing") return;
    setBillingLoading(true);
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data.invoices || []);
        setSubscriptions(data.subscriptions || []);
      })
      .finally(() => setBillingLoading(false));
  }, [user, activeTab]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const tempMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userMsg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: data.reply,
            agent_type: "autoclaw",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            Sign in to view your dashboard
          </h1>
          <a
            href="/auth/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Log In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-blue-600">Auto</span>Claw
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <a
              href="/auth/logout"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Log Out
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "chat"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Chat
            </button>
            <Link href="/dashboard/agents" className="px-4 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Agents
            </Link>
            <button
              onClick={() => setActiveTab("billing")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "billing"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Billing
            </button>
          </div>
        </div>

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">🤖</div>
                  <p className="text-lg font-medium text-gray-600 mb-2">Welcome to AutoClaw</p>
                  <p className="text-sm">Tell me about your business and I&apos;ll help you set up AI marketing agents.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-gray max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-400 rounded-lg px-4 py-3 text-sm">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendMessage} className="border-t border-gray-200 p-4 flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {billingLoading ? (
              <p className="text-gray-500">Loading billing info...</p>
            ) : (
              <>
                {/* Subscriptions */}
                <section className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">
                    Active Subscriptions
                  </h2>
                  {subscriptions.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                      <p className="text-gray-500 mb-4">No active subscriptions</p>
                      <Link
                        href="/#pricing"
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View Plans
                      </Link>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-white rounded-lg border border-gray-200 p-6"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold">
                                {sub.amount
                                  ? `${formatCurrency(sub.amount, "usd")}/${sub.interval}`
                                  : "Custom Plan"}
                              </h3>
                              {statusBadge(sub.status)}
                            </div>
                            {sub.cancel_at_period_end && (
                              <span className="text-xs text-red-500 font-medium">
                                Cancels at period end
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Current period: {formatDate(sub.current_period_start)} —{" "}
                            {formatDate(sub.current_period_end)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Invoices */}
                <section>
                  <h2 className="text-lg font-semibold mb-4">Invoices</h2>
                  {invoices.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                      <p className="text-gray-500">No invoices yet</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-4 py-3 font-medium text-gray-600">
                                Invoice
                              </th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">
                                Date
                              </th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">
                                Amount
                              </th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">
                                Status
                              </th>
                              <th className="text-right px-4 py-3 font-medium text-gray-600">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv) => (
                              <tr
                                key={inv.id}
                                className="border-b border-gray-100 last:border-0"
                              >
                                <td className="px-4 py-3">
                                  <p className="font-medium">
                                    {inv.number || inv.id.slice(0, 16)}
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    {inv.description}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {formatDate(inv.created)}
                                </td>
                                <td className="px-4 py-3 font-medium">
                                  {formatCurrency(inv.amount_due, inv.currency)}
                                </td>
                                <td className="px-4 py-3">
                                  {statusBadge(inv.status)}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                  {inv.hosted_invoice_url && (
                                    <a
                                      href={inv.hosted_invoice_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      View
                                    </a>
                                  )}
                                  {inv.invoice_pdf && (
                                    <a
                                      href={inv.invoice_pdf}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      PDF
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
