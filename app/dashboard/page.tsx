"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

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

interface AgentReport {
  id: string;
  agent: string;
  period: string;
  summary: string;
  metrics: Record<string, string | number>;
  status: string;
  project: string;
  last_run: string;
}

interface AgentAssignment {
  id: number;
  agent_type: string;
  status: string;
  project_name: string;
  project_id?: number;
  config?: {
    plan?: string;
    tasks?: { name: string; status: string }[];
    blockers?: string[];
  };
}

interface Project {
  id: number;
  name: string;
  website: string;
  description: string;
  created_at: string;
}

const AGENT_OPTIONS = [
  { type: "email_marketing", label: "Email Marketing" },
  { type: "seo_content", label: "SEO & Content" },
  { type: "lead_prospecting", label: "Lead Prospecting" },
  { type: "social_media", label: "Social Media" },
  { type: "product_manager", label: "Product Manager" },
  { type: "sales_followup", label: "Sales Follow-up" },
];

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
  const [activeTab, setActiveTab] = useState<"chat" | "agents" | "billing">("chat");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Agents state
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [agents, setAgents] = useState<AgentAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [planInfo, setPlanInfo] = useState({ plan: "starter", agentLimit: 2, totalAgents: 0 });
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", website: "", description: "" });
  const [actionLoading, setActionLoading] = useState(false);

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

  // Load agents/reports/projects when tab opens
  const loadAgentsData = () => {
    return Promise.all([
      fetch("/api/reports").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([reportData, projectData]) => {
      setReports(reportData.reports || []);
      setAgents(reportData.agents || []);
      setProjects(projectData.projects || []);
      setPlanInfo({
        plan: projectData.plan || "starter",
        agentLimit: projectData.agentLimit || 2,
        totalAgents: projectData.totalAgents || 0,
      });
    });
  };

  useEffect(() => {
    if (!user || activeTab !== "agents") return;
    setAgentsLoading(true);
    loadAgentsData().finally(() => setAgentsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_project", ...newProject }),
      });
      if (res.ok) {
        setNewProject({ name: "", website: "", description: "" });
        setShowCreateProject(false);
        await loadAgentsData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function activateAgent(projectId: number, agentType: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate_agent", project_id: projectId, agent_type: agentType }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      await loadAgentsData();
    } finally {
      setActionLoading(false);
    }
  }

  async function deactivateAgent(agentId: number) {
    if (!confirm("Remove this agent?")) return;
    setActionLoading(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate_agent", agent_id: agentId }),
      });
      await loadAgentsData();
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteProject(projectId: number) {
    if (!confirm("Delete this project and all its agents?")) return;
    setActionLoading(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_project", project_id: projectId }),
      });
      await loadAgentsData();
    } finally {
      setActionLoading(false);
    }
  }

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

  const tabs = [
    { key: "chat" as const, label: "Chat" },
    { key: "agents" as const, label: "Agents" },
    { key: "billing" as const, label: "Billing" },
  ];

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
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
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
                      <div className="prose prose-sm prose-gray max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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

        {/* Agents Tab */}
        {activeTab === "agents" && (
          <section className="flex-1 overflow-y-auto min-h-0">
            {agentsLoading ? (
              <p className="text-gray-500">Loading agents...</p>
            ) : (
              <>
                {/* Plan info & Actions bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700 capitalize">{planInfo.plan}</span> plan — {planInfo.totalAgents}/{planInfo.agentLimit === 999 ? "Unlimited" : planInfo.agentLimit} agents used
                  </div>
                  <button
                    onClick={() => setShowCreateProject(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    + New Project
                  </button>
                </div>

                {/* Create Project Form */}
                {showCreateProject && (
                  <form onSubmit={createProject} className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
                    <h3 className="font-semibold text-sm mb-3">Create Project</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Project name *"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Website URL (optional)"
                        value={newProject.website}
                        onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        placeholder="Brief description (optional)"
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={actionLoading || !newProject.name.trim()}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateProject(false)}
                          className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Projects with their agents */}
                {projects.length === 0 && agents.length === 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-gray-500 mb-2">No projects yet</p>
                    <p className="text-gray-400 text-sm">Create a project to get started with AI marketing agents.</p>
                  </div>
                )}

                {projects.map((project) => {
                  const projectAgents = agents.filter((a) => a.project_name === project.name);
                  const assignedTypes = projectAgents.map((a) => a.agent_type);
                  const availableToAdd = AGENT_OPTIONS.filter((a) => !assignedTypes.includes(a.type));

                  return (
                    <div key={project.id} className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="text-base font-semibold">{project.name}</h2>
                          {project.website && <p className="text-xs text-gray-400">{project.website}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {availableToAdd.length > 0 && planInfo.totalAgents < planInfo.agentLimit && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  activateAgent(project.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                              defaultValue=""
                            >
                              <option value="" disabled>+ Add Agent</option>
                              {availableToAdd.map((a) => (
                                <option key={a.type} value={a.type}>{a.label}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {projectAgents.length === 0 ? (
                        <p className="text-sm text-gray-400 bg-white rounded-lg border border-gray-200 p-4">No agents assigned. Use the dropdown above to add agents.</p>
                      ) : (
                        <div className="space-y-3">
                          {projectAgents.map((agent) => {
                      const config = agent.config || {};
                      const tasks = config.tasks || [];
                      const blockers = config.blockers || [];
                      const completedTasks = tasks.filter((t) => t.status === "completed").length;
                      const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
                      const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

                      return (
                        <div
                          key={agent.id}
                          className="bg-white rounded-lg border border-gray-200 p-5"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-sm">{agent.agent_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {statusBadge(agent.status)}
                              <button
                                onClick={() => deactivateAgent(agent.id)}
                                className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* Plan */}
                          {config.plan && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 mb-1">Plan</p>
                              <p className="text-sm text-gray-600">{config.plan}</p>
                            </div>
                          )}

                          {/* Progress Bar */}
                          {tasks.length > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span className="font-medium">Execution Progress</span>
                                <span>{completedTasks}/{tasks.length} tasks ({progress}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.max(progress, inProgressTasks > 0 ? 8 : 0)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Tasks */}
                          {tasks.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">Tasks</p>
                              <div className="space-y-1.5">
                                {tasks.map((task, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="mt-0.5 flex-shrink-0">
                                      {task.status === "completed" ? (
                                        <span className="text-green-500">&#10003;</span>
                                      ) : task.status === "in_progress" ? (
                                        <span className="text-blue-500">&#9679;</span>
                                      ) : (
                                        <span className="text-gray-300">&#9675;</span>
                                      )}
                                    </span>
                                    <span className={task.status === "completed" ? "text-gray-400 line-through" : task.status === "in_progress" ? "text-gray-700 font-medium" : "text-gray-500"}>
                                      {task.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Blockers */}
                          {blockers.length > 0 && (
                            <div className="bg-red-50 border border-red-100 rounded-md p-3">
                              <p className="text-xs font-medium text-red-600 mb-1">Blockers</p>
                              <ul className="text-xs text-red-500 space-y-1">
                                {blockers.map((b, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 flex-shrink-0">!</span>
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Reports */}
                <h2 className="text-lg font-semibold mb-3">Reports</h2>
                {reports.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-gray-500 mb-2">No agent reports yet</p>
                    <p className="text-gray-400 text-sm">
                      Reports will appear here once your AI agents start running.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className="bg-white rounded-lg border border-gray-200 p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">{report.agent}</h3>
                          {statusBadge(report.status)}
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{report.project}</p>
                        <p className="text-gray-600 text-sm mb-3">
                          {report.summary}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(report.metrics).map(([key, value]) => (
                            <div
                              key={key}
                              className="bg-gray-50 px-2.5 py-1.5 rounded text-xs"
                            >
                              <span className="text-gray-400">
                                {key.replace(/_/g, " ")}:
                              </span>{" "}
                              <span className="font-medium text-gray-700">
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-gray-400 text-xs mt-3">
                          {report.period} &middot; Last run:{" "}
                          {new Date(report.last_run).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
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
