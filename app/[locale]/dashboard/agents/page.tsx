"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

interface AgentAssignment {
  id: number;
  agent_type: string;
  status: string;
  project_name: string;
  project_id?: number;
  config?: {
    plan?: string;
    tasks?: { name: string; status: string; result?: string }[];
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

function RunningTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="ml-1 text-yellow-600 font-normal">({elapsed}s)</span>;
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
    { type: "orchestrator", label: ta.orchestrator },
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
  const [runningTask, setRunningTask] = useState<{ agentId: number; taskIndex: number; startedAt: number } | null>(null);
  const [taskResult, setTaskResult] = useState<Record<number, { result?: unknown; message?: string; error?: string }>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [taskReports, setTaskReports] = useState<Record<number, { task_name: string; summary: string; metrics: Record<string, unknown>; created_at: string }[]>>({});

  const loadData = () => {
    const ts = Date.now();
    return Promise.all([
      fetch(`/api/reports?_t=${ts}`).then((r) => r.json()),
      fetch(`/api/projects?_t=${ts}`).then((r) => r.json()),
    ]).then(([reportData, projectData]) => {
      setAgents(projectData.agents || []);
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
    setRunningTask({ agentId, taskIndex, startedAt: Date.now() });
    setTaskResult((prev) => ({ ...prev, [agentId]: {} }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, task_index: taskIndex }), signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        setTaskResult((prev) => ({ ...prev, [agentId]: { error: data.error || ta.taskFailed } }));
      } else {
        setTaskResult((prev) => ({ ...prev, [agentId]: { result: data.result, message: data.message } }));
      }
      await loadData();
    } catch (e) {
      const msg = e instanceof DOMException && e.name === "AbortError" ? "Task timed out (2 min). It may still be running on the server." : ta.taskFailed;
      setTaskResult((prev) => ({ ...prev, [agentId]: { error: msg } }));
    } finally { clearTimeout(timeout); setActionLoading(false); setRunningTask(null); }
  }

  async function runNextTask(agentId: number) {
    setActionLoading(true);
    setRunningTask({ agentId, taskIndex: -1, startedAt: Date.now() });
    setTaskResult((prev) => ({ ...prev, [agentId]: {} }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, action: "run-all" }), signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        setTaskResult((prev) => ({ ...prev, [agentId]: { error: data.error || ta.taskFailed } }));
      } else {
        setTaskResult((prev) => ({ ...prev, [agentId]: { result: data.result, message: data.message } }));
      }
      await loadData();
    } catch (e) {
      const msg = e instanceof DOMException && e.name === "AbortError" ? "Task timed out (2 min). It may still be running on the server." : ta.taskFailed;
      setTaskResult((prev) => ({ ...prev, [agentId]: { error: msg } }));
    } finally { clearTimeout(timeout); setActionLoading(false); setRunningTask(null); }
  }

  function toggleTaskDetail(agentId: number, taskIndex: number) {
    const key = `${agentId}-${taskIndex}`;
    setExpandedTasks((prev) => ({ ...prev, [key]: !prev[key] }));
    // Fetch reports for this agent if not loaded yet
    if (!taskReports[agentId]) {
      fetch(`/api/agent-reports?agent_id=${agentId}`).then((r) => r.json()).then((data) => {
        setTaskReports((prev) => ({ ...prev, [agentId]: data.reports || [] }));
      });
    }
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
          <a href={`/auth/login?returnTo=/${locale}/dashboard/reports`} className="bg-red-800 hover:bg-red-900 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell user={user} plan={planInfo.plan}>
      <div className="px-4 sm:px-6 py-6 w-full">
        <h1 className="text-2xl font-bold mb-6">{ta.title}</h1>

        {loading ? (
          <p className="text-gray-500">{ta.loadingAgents}</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-700 capitalize">{planInfo.plan}</span> {ta.plan} — {planInfo.totalAgents}/{planInfo.agentLimit === 999 ? ta.unlimited : planInfo.agentLimit} {ta.agentsUsed}
              </div>
              <button onClick={() => setShowCreateProject(true)} className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
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
                    <button type="submit" disabled={actionLoading || !newProject.name.trim()} className="bg-red-800 hover:bg-red-900 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">{tc.create}</button>
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
                        const blockers = (config.blockers || []).filter((b) => !b.toLowerCase().includes("linkedin"));
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
                                <div className="space-y-1">
                                  {tasks.map((task, i) => {
                                    const taskKey = `${agent.id}-${i}`;
                                    const isExpanded = expandedTasks[taskKey];
                                    const reports = taskReports[agent.id] || [];
                                    const matchedReport = reports.find((_r, idx) => idx === i) || reports.find((r) => task.name.toLowerCase().includes(r.task_name.toLowerCase().split(" ")[0]));
                                    const isThisTaskRunning = runningTask?.agentId === agent.id && (runningTask.taskIndex === i || runningTask.taskIndex === -1);

                                    return (
                                      <div key={i}>
                                        <div className="flex items-start gap-2 text-xs">
                                          <span className="mt-0.5 flex-shrink-0">
                                            {isThisTaskRunning
                                              ? <span className="text-yellow-500 animate-spin inline-block">&#9696;</span>
                                              : task.status === "completed" ? <span className="text-green-500">&#10003;</span> : task.status === "in_progress" ? <span className="text-red-500">&#9679;</span> : <span className="text-gray-300">&#9675;</span>}
                                          </span>
                                          <span className={`flex-1 ${task.status === "completed" ? "text-gray-400 line-through" : task.status === "in_progress" ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                                            {task.name}
                                            {isThisTaskRunning && <RunningTimer startedAt={runningTask!.startedAt} />}
                                          </span>
                                          {task.status === "completed" && task.result && (
                                            <button onClick={() => toggleTaskDetail(agent.id, i)} className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap cursor-pointer">
                                              {isExpanded ? "Hide" : "Log"}
                                            </button>
                                          )}
                                          {(task.status === "in_progress" || task.status === "pending") && !isThisTaskRunning && (
                                            <button onClick={() => executeTask(agent.id, i)} disabled={actionLoading} className="text-xs text-green-500 hover:text-green-700 font-medium whitespace-nowrap cursor-pointer">{tc.run}</button>
                                          )}
                                        </div>
                                        {isExpanded && task.result && (
                                          <div className="ml-6 mt-1 mb-2 bg-gray-50 border border-gray-100 rounded-md p-2">
                                            <p className="text-xs text-gray-500 mb-1">{task.result}</p>
                                            {matchedReport && (
                                              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words max-h-60 overflow-y-auto bg-white rounded p-2 mt-1">
                                                {JSON.stringify(matchedReport.metrics, null, 2)}
                                              </pre>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
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

                            {/* Task execution result */}
                            {taskResult[agent.id] && (taskResult[agent.id].result || taskResult[agent.id].message || taskResult[agent.id].error) && (
                              <div className={`mt-3 rounded-md p-3 ${taskResult[agent.id].error ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <p className={`text-xs font-medium ${taskResult[agent.id].error ? "text-red-600" : "text-green-700"}`}>
                                    {taskResult[agent.id].error ? ta.taskFailed : "Result"}
                                  </p>
                                  <button
                                    onClick={() => setTaskResult((prev) => { const n = { ...prev }; delete n[agent.id]; return n; })}
                                    className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                                  >
                                    &times;
                                  </button>
                                </div>
                                {taskResult[agent.id].error && (
                                  <p className="text-xs text-red-500">{taskResult[agent.id].error}</p>
                                )}
                                {taskResult[agent.id].message && (
                                  <p className="text-xs text-green-600">{taskResult[agent.id].message}</p>
                                )}
                                {taskResult[agent.id].result != null && (
                                  <pre className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-words max-h-60 overflow-y-auto bg-white/60 rounded p-2">
                                    {typeof taskResult[agent.id].result === "string"
                                      ? String(taskResult[agent.id].result)
                                      : JSON.stringify(taskResult[agent.id].result, null, 2)}
                                  </pre>
                                )}
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
      </div>
    </DashboardShell>
  );
}
