"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

interface ServerAgent {
  id: string;
  agent: string;
  description?: string;
  period: string;
  status: string;
  project: string;
  last_run: string;
  summary: string;
  metrics: Record<string, string | number>;
  enabled?: boolean;
}

function statusBadge(status: string | null) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    pending: "bg-blue-100 text-blue-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-red-100 text-red-700",
  };
  const s = status || "unknown";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}>
      {s}
    </span>
  );
}

export default function AgentsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const ta = dict.agentsPage;
  const tc = dict.common;

  const AGENT_OPTIONS = [
    { type: "email_marketing", label: ta.emailMarketing },
    { type: "seo_content", label: ta.seoContent },
    { type: "lead_prospecting", label: ta.leadProspecting },
    { type: "social_media", label: ta.socialMedia },
    { type: "product_manager", label: ta.productManager },
    { type: "sales_followup", label: ta.salesFollowup },
  ];

  const { user, isLoading: userLoading } = useUser();

  const [agents, setAgents] = useState<AgentAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [serverAgents, setServerAgents] = useState<ServerAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [planInfo, setPlanInfo] = useState({ plan: "starter", agentLimit: 2, totalAgents: 0 });
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", website: "", description: "" });
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = () => {
    return Promise.all([
      fetch("/api/reports").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([reportData, projectData]) => {
      setAgents(reportData.agents || []);
      setServerAgents(reportData.serverAgents || reportData.reports || []);
      setProjects(projectData.projects || []);
      setPlanInfo({
        plan: projectData.plan || "starter",
        agentLimit: projectData.agentLimit || 2,
        totalAgents: projectData.totalAgents || 0,
      });
    });
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_project", ...newProject }) });
      if (res.ok) { setNewProject({ name: "", website: "", description: "" }); setShowCreateProject(false); await loadData(); }
    } finally { setActionLoading(false); }
  }

  async function activateAgent(projectId: number, agentType: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate_agent", project_id: projectId, agent_type: agentType, locale }) });
      const data = await res.json();
      if (!res.ok) alert(data.error);
      await loadData();
    } finally { setActionLoading(false); }
  }

  async function deactivateAgent(agentId: number) {
    if (!confirm(ta.confirmRemoveAgent)) return;
    setActionLoading(true);
    try {
      await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deactivate_agent", agent_id: agentId }) });
      await loadData();
    } finally { setActionLoading(false); }
  }

  async function resolveBlocker(agentId: number, blockerIndex: number, blockerText: string) {
    const value = prompt(`${ta.resolvePrompt} "${blockerText}"\n\n${ta.resolveHint}`);
    if (value === null) return;
    setActionLoading(true);
    try {
      await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve_blocker", agent_id: agentId, blocker_index: blockerIndex, value }) });
      await loadData();
    } finally { setActionLoading(false); }
  }

  async function executeTask(agentId: number, taskIndex: number) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, task_index: taskIndex }) });
      const data = await res.json();
      if (!res.ok) alert(data.error || ta.taskFailed);
      await loadData();
    } finally { setActionLoading(false); }
  }

  async function runNextTask(agentId: number) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, action: "run-all" }) });
      const data = await res.json();
      if (!res.ok) alert(data.error || ta.taskFailed);
      await loadData();
    } finally { setActionLoading(false); }
  }

  async function deleteProject(projectId: number) {
    if (!confirm(ta.confirmDeleteProject)) return;
    setActionLoading(true);
    try {
      await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_project", project_id: projectId }) });
      await loadData();
    } finally { setActionLoading(false); }
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{tc.loading}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{ta.signInAgents}</h1>
          <a href={`/auth/login?returnTo=/${locale}/dashboard/agents`} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <img src="/logo.svg" alt="AutoClaw" className="w-9 h-9" />
            <span><span className="text-red-600">Auto</span>Claw</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/dashboard`} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.dashboard}</Link>
            <LanguageSwitcher locale={locale} />
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{ta.title}</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            <Link href={`/${locale}/dashboard`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.chat}</Link>
            <span className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-white text-gray-900 shadow-sm whitespace-nowrap">{tc.agents}</span>
            <Link href={`/${locale}/dashboard/reports`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.reports}</Link>
            <Link href={`/${locale}/dashboard/billing`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.billing}</Link>
            <Link href={`/${locale}/dashboard/settings`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.settings}</Link>
            <Link href={`/${locale}/dashboard/docs`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.docs}</Link>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">{ta.loadingAgents}</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-700 capitalize">{planInfo.plan}</span> {ta.plan} — {planInfo.totalAgents}/{planInfo.agentLimit === 999 ? ta.unlimited : planInfo.agentLimit} {ta.agentsUsed}
              </div>
              <button onClick={() => setShowCreateProject(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                {ta.newProject}
              </button>
            </div>

            {showCreateProject && (
              <form onSubmit={createProject} className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
                <h3 className="font-semibold text-sm mb-3">{ta.createProject}</h3>
                <div className="space-y-3">
                  <input type="text" placeholder={ta.projectName} value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" required />
                  <input type="text" placeholder={ta.websiteUrl} value={newProject.website} onChange={(e) => setNewProject({ ...newProject, website: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <textarea placeholder={ta.briefDesc} value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={2} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={actionLoading || !newProject.name.trim()} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">{tc.create}</button>
                    <button type="button" onClick={() => setShowCreateProject(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm cursor-pointer">{tc.cancel}</button>
                  </div>
                </div>
              </form>
            )}

            {projects.length === 0 && agents.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-2">{ta.noProjects}</p>
                <p className="text-gray-400 text-sm">{ta.noProjectsDesc}</p>
              </div>
            )}

            {projects.map((project) => {
              const projectAgents = agents.filter((a) => a.project_name === project.name);
              const assignedTypes = projectAgents.map((a) => a.agent_type);
              const availableToAdd = AGENT_OPTIONS.filter((a) => !assignedTypes.includes(a.type));

              return (
                <div key={project.id} className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-base font-semibold">{project.name}</h2>
                      {project.website && <p className="text-xs text-gray-400 break-all">{project.website}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {availableToAdd.length > 0 && planInfo.totalAgents < planInfo.agentLimit && (
                        <select
                          onChange={(e) => { if (e.target.value) { activateAgent(project.id, e.target.value); e.target.value = ""; } }}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                          defaultValue=""
                        >
                          <option value="" disabled>{ta.addAgent}</option>
                          {availableToAdd.map((a) => (<option key={a.type} value={a.type}>{a.label}</option>))}
                        </select>
                      )}
                      <button onClick={() => deleteProject(project.id)} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">{tc.delete}</button>
                    </div>
                  </div>

                  {projectAgents.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-white rounded-lg border border-gray-200 p-4">{ta.noAgents}</p>
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
                          <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-sm">{agent.agent_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
                              <div className="flex items-center gap-2">
                                {(inProgressTasks > 0 || tasks.some((t) => t.status === "pending")) && (
                                  <button onClick={() => runNextTask(agent.id)} disabled={actionLoading} className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer">{ta.runNext}</button>
                                )}
                                {statusBadge(agent.status)}
                                <button onClick={() => deactivateAgent(agent.id)} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">{tc.remove}</button>
                              </div>
                            </div>

                            {config.plan && (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-gray-500 mb-1">{ta.planLabel}</p>
                                <p className="text-sm text-gray-600">{config.plan}</p>
                              </div>
                            )}

                            {tasks.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span className="font-medium">{ta.executionProgress}</span>
                                  <span>{completedTasks}/{tasks.length} {ta.tasks} ({progress}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${Math.max(progress, inProgressTasks > 0 ? 8 : 0)}%` }} />
                                </div>
                              </div>
                            )}

                            {tasks.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">{ta.tasksLabel}</p>
                                <div className="space-y-1.5">
                                  {tasks.map((task, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className="mt-0.5 flex-shrink-0">
                                        {task.status === "completed" ? <span className="text-green-500">&#10003;</span> : task.status === "in_progress" ? <span className="text-red-500">&#9679;</span> : <span className="text-gray-300">&#9675;</span>}
                                      </span>
                                      <span className={`flex-1 ${task.status === "completed" ? "text-gray-400 line-through" : task.status === "in_progress" ? "text-gray-700 font-medium" : "text-gray-500"}`}>{task.name}</span>
                                      {(task.status === "in_progress" || task.status === "pending") && (
                                        <button onClick={() => executeTask(agent.id, i)} disabled={actionLoading} className="text-xs text-green-500 hover:text-green-700 font-medium whitespace-nowrap cursor-pointer">{tc.run}</button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {blockers.length > 0 && (
                              <div className="bg-red-50 border border-red-100 rounded-md p-3">
                                <p className="text-xs font-medium text-red-600 mb-1">{ta.blockers}</p>
                                <ul className="text-xs text-red-500 space-y-1">
                                  {blockers.map((b, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2">
                                      <div className="flex items-start gap-1.5">
                                        <span className="mt-0.5 flex-shrink-0">!</span>
                                        <span>{b}</span>
                                      </div>
                                      <button onClick={() => resolveBlocker(agent.id, i, b)} disabled={actionLoading} className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap cursor-pointer">{tc.resolve}</button>
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

            {/* Server Agents (OpenClaw cron jobs) */}
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{ta.serverAgents}</h2>
                <p className="text-xs text-gray-400 mt-1">{ta.serverAgentsDesc}</p>
              </div>
              {serverAgents.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500 text-sm">{ta.noServerAgents}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serverAgents.map((sa) => {
                    const statusColors: Record<string, string> = {
                      active: "bg-green-100 text-green-700",
                      pending: "bg-blue-100 text-blue-700",
                      paused: "bg-yellow-100 text-yellow-700",
                      completed: "bg-gray-100 text-gray-600",
                    };
                    const categoryLabels: Record<string, Record<string, string>> = {
                      en: { lead_generation: "Lead Gen", email_marketing: "Email", seo: "SEO", social_media: "Social", monitoring: "Monitor", project_mgmt: "PM", engineering: "Eng", sales: "Sales", other: "Other" },
                      zh: { lead_generation: "潜在客户", email_marketing: "邮件", seo: "SEO", social_media: "社交", monitoring: "监控", project_mgmt: "项目", engineering: "工程", sales: "销售", other: "其他" },
                    };
                    const catLabel = categoryLabels[locale]?.[sa.period] || categoryLabels.en[sa.period] || sa.period;
                    const metricEntries = Object.entries(sa.metrics || {}).filter(([, v]) => v !== 0 && v !== "0");
                    const statusLabels: Record<string, Record<string, string>> = {
                      en: { active: "active", pending: "pending", paused: "paused", completed: "completed" },
                      zh: { active: "运行正常", pending: "待运行", paused: "已暂停", completed: "已完成" },
                    };
                    const metricLabels: Record<string, Record<string, string>> = {
                      en: { emails_sent: "Sent", delivered: "Delivered", opened: "Opened", clicked: "Clicked", contacts_found: "Contacts", articles: "Articles", backlinks: "Backlinks", duration_sec: "Duration(s)", errors: "Errors" },
                      zh: { emails_sent: "已发送", delivered: "已送达", opened: "已打开", clicked: "已点击", contacts_found: "联系人", articles: "文章", backlinks: "外链", duration_sec: "耗时(秒)", errors: "错误" },
                    };
                    return (
                      <div key={sa.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{sa.agent.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sa.status] || "bg-gray-100 text-gray-600"}`}>
                                {statusLabels[locale]?.[sa.status] || sa.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>{sa.project}</span>
                              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{catLabel}</span>
                              {sa.last_run ? <span>{ta.lastRunAt}: {new Date(sa.last_run).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</span> : <span className="italic">{locale === "zh" ? "等待首次运行" : "Awaiting first run"}</span>}
                            </div>
                          </div>
                        </div>
                        {sa.summary && (
                          <p className="text-xs text-gray-500 mt-2">{sa.summary}</p>
                        )}
                        {metricEntries.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {metricEntries.map(([key, value]) => (
                              <span key={key} className="bg-gray-50 px-2 py-1 rounded text-xs">
                                <span className="text-gray-400">{metricLabels[locale]?.[key] || metricLabels.en[key] || key.replace(/_/g, " ")}:</span>{" "}
                                <span className="font-medium text-gray-700">{typeof value === "number" ? value.toLocaleString() : value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </>
        )}
      </main>
    </div>
  );
}
