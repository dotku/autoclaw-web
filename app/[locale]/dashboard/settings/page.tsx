"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserPlanBadge from "@/components/UserPlanBadge";

interface Project {
  id: number;
  name: string;
  website: string;
  description: string;
  ga_property_id: string | null;
  domain: string | null;
  org_id: number | null;
}

interface Org {
  id: number;
  name: string;
  domain: string | null;
  member_role: string | null;
  member_count: number;
  project_count: number;
}

interface OrgMember {
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  user_email: string;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, Record<string, string>> = {
  en: {
    "login": "Login",
    "project.create": "Create Project",
    "project.update": "Update Project",
    "project.delete": "Delete Project",
    "agent.activate": "Activate Agent",
    "agent.deactivate": "Deactivate Agent",
    "agent.config_update": "Update Agent Config",
    "blocker.resolve": "Resolve Blocker",
    "settings.update": "Update Settings",
    "execute.task": "Execute Task",
    "subscribe.register": "Register Subscription",
    "org.create": "Create Organization",
    "org.add_member": "Add Org Member",
    "org.remove_member": "Remove Org Member",
    "org.assign_project": "Assign Project to Org",
    "org.update_role": "Update Member Role",
    "org.rename": "Rename Organization",
    "org.join": "Join Organization",
    "org.delete": "Delete Organization",
    "apikey.upsert": "Save API Key",
    "apikey.delete": "Delete API Key",
  },
  zh: {
    "login": "登录",
    "project.create": "创建项目",
    "project.update": "更新项目",
    "project.delete": "删除项目",
    "agent.activate": "激活智能体",
    "agent.deactivate": "停用智能体",
    "agent.config_update": "更新智能体配置",
    "blocker.resolve": "解决阻碍",
    "settings.update": "更新设置",
    "execute.task": "执行任务",
    "subscribe.register": "注册订阅",
    "org.create": "创建组织",
    "org.add_member": "添加组织成员",
    "org.remove_member": "移除组织成员",
    "org.assign_project": "分配项目到组织",
    "org.update_role": "更新成员角色",
    "org.rename": "重命名组织",
    "org.join": "加入组织",
    "org.delete": "删除组织",
    "apikey.upsert": "保存 API 密钥",
    "apikey.delete": "删除 API 密钥",
  },
  "zh-TW": {
    "login": "登入",
    "project.create": "建立專案",
    "project.update": "更新專案",
    "project.delete": "刪除專案",
    "agent.activate": "啟用智能體",
    "agent.deactivate": "停用智能體",
    "agent.config_update": "更新智能體設定",
    "blocker.resolve": "解決阻礙",
    "settings.update": "更新設定",
    "execute.task": "執行任務",
    "subscribe.register": "註冊訂閱",
    "org.create": "建立組織",
    "org.add_member": "新增組織成員",
    "org.remove_member": "移除組織成員",
    "org.assign_project": "分配專案至組織",
    "org.update_role": "更新成員角色",
    "org.rename": "重新命名組織",
    "org.join": "加入組織",
    "org.delete": "刪除組織",
    "apikey.upsert": "儲存 API 金鑰",
    "apikey.delete": "刪除 API 金鑰",
  },
  fr: {
    "login": "Connexion",
    "project.create": "Créer un projet",
    "project.update": "Mettre à jour le projet",
    "project.delete": "Supprimer le projet",
    "agent.activate": "Activer l'agent",
    "agent.deactivate": "Désactiver l'agent",
    "agent.config_update": "Modifier la config agent",
    "blocker.resolve": "Résoudre le blocage",
    "settings.update": "Modifier les paramètres",
    "execute.task": "Exécuter la tâche",
    "subscribe.register": "Inscription abonnement",
    "org.create": "Créer une organisation",
    "org.add_member": "Ajouter un membre",
    "org.remove_member": "Retirer un membre",
    "org.assign_project": "Assigner un projet",
    "org.update_role": "Modifier le rôle",
    "org.rename": "Renommer l'organisation",
    "org.join": "Rejoindre l'organisation",
    "org.delete": "Supprimer l'organisation",
    "apikey.upsert": "Enregistrer la clé API",
    "apikey.delete": "Supprimer la clé API",
  },
};

export default function SettingsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const ts = dict.settings;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [selectedLocale, setSelectedLocale] = useState<string>(locale);
  const [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", website: "", ga_property_id: "", description: "", domain: "" });
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSaved, setProjectSaved] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ email: string; name: string; project_role: string; created_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProject, setInviteProject] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgMembers, setOrgMembers] = useState<Record<number, OrgMember[]>>({});
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDomain, setNewOrgDomain] = useState("");
  const [orgCreating, setOrgCreating] = useState(false);
  const [orgMsg, setOrgMsg] = useState("");
  const [orgMsgType, setOrgMsgType] = useState<"success" | "error">("success");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberOrgId, setAddMemberOrgId] = useState<number | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [assignProjectId, setAssignProjectId] = useState<number | null>(null);
  const [assignOrgId, setAssignOrgId] = useState<number | null>(null);
  const [renamingOrgId, setRenamingOrgId] = useState<number | null>(null);
  const [renameOrgName, setRenameOrgName] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const [userPlan, setUserPlan] = useState<string>("starter");
  const [apiKeys, setApiKeys] = useState<{ id: number; service: string; masked_key: string; label: string | null; updated_at: string }[]>([]);
  const [byokEditing, setByokEditing] = useState<string | null>(null);
  const [byokKeyInput, setByokKeyInput] = useState("");
  const [byokLabelInput, setByokLabelInput] = useState("");
  const [byokSaving, setByokSaving] = useState(false);
  const [byokMsg, setByokMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    fetch(`/api/projects?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects || []); if (data.role) setUserRole(data.role); if (data.plan) setUserPlan(data.plan); });
    setAuditLoading(true);
    fetch("/api/audit-logs?limit=20")
      .then((r) => r.json())
      .then((data) => setAuditLogs(data.logs || []))
      .finally(() => setAuditLoading(false));
    fetch("/api/team-members")
      .then((r) => r.json())
      .then((data) => setTeamMembers(data.members || []));
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        const orgList = data.orgs || [];
        setOrgs(orgList);
        orgList.forEach((org: Org) => loadOrgMembers(org.id));
      });
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((data) => setApiKeys(data.keys || []));
  }, [user]);

  function loadOrgMembers(orgId: number) {
    fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_members", org_id: orgId }),
    })
      .then((r) => r.json())
      .then((data) => setOrgMembers((prev) => ({ ...prev, [orgId]: data.members || [] })));
  }

  function handleSave() {
    document.cookie = `locale=${selectedLocale};path=/;max-age=31536000`;
    setSaved(true);
    if (selectedLocale !== locale) {
      const newPath = window.location.pathname.replace(`/${locale}`, `/${selectedLocale}`);
      window.location.href = newPath;
    }
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditForm({
      name: project.name || "",
      website: project.website || "",
      ga_property_id: project.ga_property_id || "",
      description: project.description || "",
      domain: project.domain || "",
    });
    setProjectSaved(null);
  }

  async function saveProject(projectId: number) {
    setProjectSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_project",
          project_id: projectId,
          name: editForm.name || undefined,
          website: editForm.website,
          ga_property_id: editForm.ga_property_id || null,
          description: editForm.description,
          domain: editForm.domain || null,
        }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, name: editForm.name || p.name, website: editForm.website, ga_property_id: editForm.ga_property_id || null, description: editForm.description, domain: editForm.domain || null }
              : p
          )
        );
        setEditingId(null);
        setProjectSaved(projectId);
        setTimeout(() => setProjectSaved(null), 2000);
      }
    } finally {
      setProjectSaving(false);
    }
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
          <h1 className="text-2xl font-bold mb-4">{tc.loading}</h1>
          <a href="/auth/login" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
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
            <span className="text-sm text-gray-600 hidden sm:flex items-center gap-1.5">{user.email} <UserPlanBadge /></span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{ts.title}</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            <Link href={`/${locale}/dashboard/chat`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.chat}</Link>
            <Link href={`/${locale}/dashboard/agents`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.agents}</Link>
            <Link href={`/${locale}/dashboard/reports`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.reports}</Link>
            <Link href={`/${locale}/dashboard/billing`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.billing}</Link>
            <span className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-white text-gray-900 shadow-sm whitespace-nowrap">{tc.settings}</span>
            <Link href={`/${locale}/dashboard/docs`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.docs}</Link>
          </div>
        </div>

        {/* Project Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{ts.projectsTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.projectsDesc}</p>

          {projects.length === 0 ? (
            <p className="text-sm text-gray-400">{ts.noProjects}</p>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    {editingId === project.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="font-semibold text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      />
                    ) : (
                      <h3 className="font-semibold text-sm">{project.name}</h3>
                    )}
                    <div className="flex items-center gap-2">
                      {projectSaved === project.id && (
                        <span className="text-xs text-green-600">{ts.saved}</span>
                      )}
                      {editingId === project.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveProject(project.id)}
                            disabled={projectSaving}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {projectSaving ? "..." : tc.save}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 transition-colors cursor-pointer"
                          >
                            {tc.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(project)}
                          className="text-xs text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                        >
                          {ts.edit}
                        </button>
                      )}
                    </div>
                  </div>

                  {editingId === project.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{ts.website}</label>
                        <input
                          type="url"
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{ts.gaPropertyId}</label>
                        <input
                          type="text"
                          value={editForm.ga_property_id}
                          onChange={(e) => setEditForm({ ...editForm, ga_property_id: e.target.value })}
                          placeholder="e.g. 526614012"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">{ts.gaPropertyIdHint}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{ts.domain || "Work Domain"}</label>
                        <input
                          type="text"
                          value={editForm.domain}
                          onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                          placeholder="e.g. usproglove.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">{ts.domainHint || "All users with this email domain can access this project"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{ts.description}</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-400">{ts.website}</span>
                        <p className="text-gray-700 truncate">{project.website || "-"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">{ts.gaPropertyId}</span>
                        <p className="text-gray-700">{project.ga_property_id || "-"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">{ts.domain || "Work Domain"}</span>
                        <p className="text-gray-700">{project.domain || "-"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">{ts.description}</span>
                        <p className="text-gray-700 truncate">{project.description || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Language Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{ts.language}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.languageDesc}</p>

          <div className="space-y-2 mb-6">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="locale"
                value="en"
                checked={selectedLocale === "en"}
                onChange={() => { setSelectedLocale("en"); setSaved(false); }}
                className="text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium">{ts.english}</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="locale"
                value="zh"
                checked={selectedLocale === "zh"}
                onChange={() => { setSelectedLocale("zh"); setSaved(false); }}
                className="text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium">{ts.chinese}</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="locale"
                value="zh-TW"
                checked={selectedLocale === "zh-TW"}
                onChange={() => { setSelectedLocale("zh-TW"); setSaved(false); }}
                className="text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium">{ts.chineseTW || "繁體中文"}</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="locale"
                value="fr"
                checked={selectedLocale === "fr"}
                onChange={() => { setSelectedLocale("fr"); setSaved(false); }}
                className="text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium">{ts.french || "Français"}</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {tc.save}
            </button>
            {saved && <span className="text-sm text-green-600">{ts.saved}</span>}
          </div>
        </div>

        {/* Team & Organization */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{ts.orgTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.orgDesc}</p>

          {userPlan === "starter" ? (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500 mb-3">{ts.orgUpgradeHint}</p>
              <Link href={`/${locale}/dashboard/billing`} className="inline-block bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {ts.orgUpgradeBtn}
              </Link>
            </div>
          ) : orgs.length === 0 ? (
            <>
              <p className="text-sm text-gray-400 mb-4">{ts.orgNoOrg}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder={ts.orgName}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <input
                  type="text"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  placeholder={ts.orgDomain + " (optional)"}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <button
                  onClick={async () => {
                    if (!newOrgName) return;
                    setOrgCreating(true);
                    try {
                      const res = await fetch("/api/organizations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "create", name: newOrgName, domain: newOrgDomain || null }),
                      });
                      if (res.ok) {
                        setOrgMsg(ts.orgCreated);
                        setOrgMsgType("success");
                        setNewOrgName("");
                        setNewOrgDomain("");
                        const data = await fetch("/api/organizations").then((r) => r.json());
                        setOrgs(data.orgs || []);
                        (data.orgs || []).forEach((org: Org) => loadOrgMembers(org.id));
                      } else {
                        const err = await res.json();
                        setOrgMsg(err.error || "Failed");
                        setOrgMsgType("error");
                      }
                    } finally {
                      setOrgCreating(false);
                      setTimeout(() => setOrgMsg(""), 3000);
                    }
                  }}
                  disabled={orgCreating || !newOrgName}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {orgCreating ? "..." : ts.orgCreate}
                </button>
              </div>
              {orgMsg && <p className={`text-sm mt-2 ${orgMsgType === "error" ? "text-red-500" : "text-green-600"}`}>{orgMsg}</p>}
            </>
          ) : (
            <div className="space-y-4">
              {orgs.map((org) => (
                <div key={org.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {renamingOrgId === org.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renameOrgName}
                            onChange={(e) => setRenameOrgName(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && renameOrgName) {
                                await fetch("/api/organizations", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "rename", org_id: org.id, name: renameOrgName }),
                                });
                                setRenamingOrgId(null);
                                const data = await fetch("/api/organizations").then((r) => r.json());
                                setOrgs(data.orgs || []);
                              }
                              if (e.key === "Escape") setRenamingOrgId(null);
                            }}
                          />
                          <button
                            onClick={async () => {
                              if (!renameOrgName) return;
                              await fetch("/api/organizations", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "rename", org_id: org.id, name: renameOrgName }),
                              });
                              setRenamingOrgId(null);
                              const data = await fetch("/api/organizations").then((r) => r.json());
                              setOrgs(data.orgs || []);
                            }}
                            className="text-xs text-green-600 hover:text-green-800 cursor-pointer"
                          >{tc.save}</button>
                          <button onClick={() => setRenamingOrgId(null)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">{tc.cancel}</button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-sm">{org.name}</h3>
                          {org.member_role === "admin" && (
                            <button
                              onClick={() => { setRenamingOrgId(org.id); setRenameOrgName(org.name); }}
                              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                            >{ts.orgRename || "Rename"}</button>
                          )}
                        </>
                      )}
                      {org.domain && <span className="text-xs text-gray-400">@{org.domain}</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${org.member_role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-600"}`}>
                        {org.member_role === "admin" ? ts.orgRoleAdmin : ts.orgRoleMember}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{org.member_count} {ts.orgMembers}</span>
                      <span>{org.project_count} {ts.orgProjects}</span>
                      {org.member_role === "admin" && orgMembers[org.id] && orgMembers[org.id].length <= 1 && (
                        <button
                          onClick={async () => {
                            if (!confirm(ts.orgDeleteConfirm || "Delete this organization?")) return;
                            const res = await fetch("/api/organizations", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "delete", org_id: org.id }),
                            });
                            if (res.ok) {
                              setOrgMsg(ts.orgDeleted || "Organization deleted");
                              const data = await fetch("/api/organizations").then((r) => r.json());
                              setOrgs(data.orgs || []);
                              fetch(`/api/projects?_t=${Date.now()}`).then((r) => r.json()).then((d) => setProjects(d.projects || []));
                              setTimeout(() => setOrgMsg(""), 3000);
                            } else {
                              const data = await res.json();
                              setOrgMsg(data.error || "Failed");
                              setTimeout(() => setOrgMsg(""), 3000);
                            }
                          }}
                          className="text-red-400 hover:text-red-600 cursor-pointer"
                        >
                          {tc.delete}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Org Members */}
                  {orgMembers[org.id] && orgMembers[org.id].length > 0 && (
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left">
                            <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamEmail || "Email"}</th>
                            <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamName || "Name"}</th>
                            <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamRole || "Role"}</th>
                            <th className="pb-2 font-medium text-gray-500 text-xs"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgMembers[org.id].map((member) => (
                            <tr key={member.email} className="border-b border-gray-100">
                              <td className="py-2 pr-4 text-gray-700">{member.email}</td>
                              <td className="py-2 pr-4 text-gray-500">{member.name || "-"}</td>
                              <td className="py-2 pr-4">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${member.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-600"}`}>
                                  {member.role === "admin" ? ts.orgRoleAdmin : ts.orgRoleMember}
                                </span>
                              </td>
                              <td className="py-2 text-right space-x-2">
                                {org.member_role === "admin" && !(member.email === user?.email && member.role === "admin") && (
                                  <button
                                    onClick={async () => {
                                      const newRole = member.role === "admin" ? "member" : "admin";
                                      await fetch("/api/organizations", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "update_role", org_id: org.id, member_email: member.email, role: newRole }),
                                      });
                                      loadOrgMembers(org.id);
                                    }}
                                    className={`text-xs cursor-pointer ${member.role === "admin" ? "text-gray-500 hover:text-gray-700" : "text-purple-500 hover:text-purple-700"}`}
                                  >
                                    {member.role === "admin" ? (ts.orgDemote || "Demote") : (ts.orgPromote || "Promote")}
                                  </button>
                                )}
                                {org.member_role === "admin" && member.role !== "admin" && (
                                  <button
                                    onClick={async () => {
                                      await fetch("/api/organizations", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "remove_member", org_id: org.id, member_email: member.email }),
                                      });
                                      loadOrgMembers(org.id);
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                                  >
                                    {ts.orgRemove}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add Member (only for org admins) */}
                  {org.member_role === "admin" && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={addMemberOrgId === org.id ? addMemberEmail : ""}
                        onChange={(e) => { setAddMemberEmail(e.target.value); setAddMemberOrgId(org.id); }}
                        onFocus={() => setAddMemberOrgId(org.id)}
                        placeholder={ts.invitePlaceholder || "colleague@company.com"}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (!addMemberEmail) return;
                          setAddingMember(true);
                          setOrgMsg("");
                          try {
                            const res = await fetch("/api/organizations", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "add_member", org_id: org.id, email: addMemberEmail }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setOrgMsg(ts.orgMemberAdded);
                              setAddMemberEmail("");
                              loadOrgMembers(org.id);
                              fetch("/api/organizations").then((r) => r.json()).then((d) => setOrgs(d.orgs || []));
                            } else {
                              setOrgMsg(data.error || "Failed");
                            }
                          } finally {
                            setAddingMember(false);
                            setTimeout(() => setOrgMsg(""), 3000);
                          }
                        }}
                        disabled={addingMember || !addMemberEmail || addMemberOrgId !== org.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {addingMember ? "..." : ts.orgAddMember}
                      </button>
                    </div>
                  )}

                  {/* Assign Project to Org (only for org admins) */}
                  {org.member_role === "admin" && projects.filter((p) => !p.org_id).length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <select
                        value={assignOrgId === org.id ? (assignProjectId ?? "") : ""}
                        onChange={(e) => { setAssignProjectId(e.target.value ? Number(e.target.value) : null); setAssignOrgId(org.id); }}
                        onFocus={() => setAssignOrgId(org.id)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      >
                        <option value="">{ts.orgAssignProject}</option>
                        {projects.filter((p) => !p.org_id).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          if (!assignProjectId || assignOrgId !== org.id) return;
                          const res = await fetch("/api/organizations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "assign_project", org_id: org.id, project_id: assignProjectId }),
                          });
                          if (res.ok) {
                            setOrgMsg(ts.orgProjectAssigned);
                            setAssignProjectId(null);
                            setProjects((prev) => prev.map((p) => p.id === assignProjectId ? { ...p, org_id: org.id } : p));
                            fetch("/api/organizations").then((r) => r.json()).then((d) => setOrgs(d.orgs || []));
                            setTimeout(() => setOrgMsg(""), 3000);
                          }
                        }}
                        disabled={!assignProjectId || assignOrgId !== org.id}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {ts.orgAssignProject}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {orgMsg && <p className="text-sm text-green-600">{orgMsg}</p>}

              {/* Create another org */}
              <div className="border border-dashed border-gray-300 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder={ts.orgName}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                  <input
                    type="text"
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                    placeholder={ts.orgDomain + " (optional)"}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                  <button
                    onClick={async () => {
                      if (!newOrgName) return;
                      setOrgCreating(true);
                      try {
                        const res = await fetch("/api/organizations", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "create", name: newOrgName, domain: newOrgDomain || null }),
                        });
                        if (res.ok) {
                          setOrgMsg(ts.orgCreated);
                          setOrgMsgType("success");
                          setNewOrgName("");
                          setNewOrgDomain("");
                          const data = await fetch("/api/organizations").then((r) => r.json());
                          setOrgs(data.orgs || []);
                          (data.orgs || []).forEach((o: Org) => loadOrgMembers(o.id));
                        } else {
                          const err = await res.json();
                          setOrgMsg(err.error || "Failed");
                          setOrgMsgType("error");
                        }
                      } finally {
                        setOrgCreating(false);
                        setTimeout(() => setOrgMsg(""), 3000);
                      }
                    }}
                    disabled={orgCreating || !newOrgName}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {orgCreating ? "..." : ts.orgCreate}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project Collaborators — invite by project */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">{ts.teamTitle}</h3>
            <p className="text-xs text-gray-400 mb-3">{ts.teamDesc}</p>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={ts.invitePlaceholder || "colleague@company.com"}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
              <select
                value={inviteProject ?? ""}
                onChange={(e) => setInviteProject(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              >
                <option value="">{ts.inviteSelectProject || "Select project"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!inviteEmail || !inviteProject) return;
                  setInviting(true);
                  setInviteMsg("");
                  try {
                    const res = await fetch("/api/team-members", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: inviteEmail, project_id: inviteProject }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setInviteMsg(ts.inviteSuccess || "Invitation sent!");
                      setInviteEmail("");
                      fetch("/api/team-members").then((r) => r.json()).then((d) => setTeamMembers(d.members || []));
                    } else {
                      setInviteMsg(data.error || "Failed");
                    }
                  } finally {
                    setInviting(false);
                    setTimeout(() => setInviteMsg(""), 3000);
                  }
                }}
                disabled={inviting || !inviteEmail || !inviteProject}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {inviting ? "..." : (ts.inviteBtn || "Invite")}
              </button>
            </div>
            {inviteMsg && <p className="text-sm text-green-600 mb-3">{inviteMsg}</p>}

            {teamMembers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamEmail || "Email"}</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamName || "Name"}</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamRole || "Role"}</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.teamJoined || "Joined"}</th>
                      <th className="pb-2 font-medium text-gray-500 text-xs"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => {
                      const isOwner = member.project_role === "owner";
                      const isSelf = member.email === user?.email;
                      const roleColors: Record<string, string> = {
                        owner: "bg-red-100 text-red-800",
                        admin: "bg-purple-100 text-purple-800",
                        operator: "bg-blue-100 text-blue-700",
                        viewer: "bg-gray-100 text-gray-600",
                        member: "bg-gray-100 text-gray-600",
                        domain: "bg-green-100 text-green-700",
                      };
                      // Current user can manage if they are an owner
                      const currentUserIsOwner = teamMembers.some((m) => m.email === user?.email && m.project_role === "owner");
                      const canManage = (currentUserIsOwner || userRole === "admin") && !isOwner && !isSelf;
                      return (
                        <tr key={member.email} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-700">{member.email}</td>
                          <td className="py-2 pr-4 text-gray-500">{member.name || "-"}</td>
                          <td className="py-2 pr-4">
                            {canManage ? (
                              <select
                                value={member.project_role}
                                onChange={async (e) => {
                                  const newRole = e.target.value;
                                  await fetch("/api/team-members", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ project_id: projects[0]?.id, member_email: member.email, role: newRole }),
                                  });
                                  setTeamMembers((prev) => prev.map((m) => m.email === member.email ? { ...m, project_role: newRole } : m));
                                }}
                                className="text-xs font-medium px-2 py-1 rounded border border-gray-200 outline-none cursor-pointer"
                              >
                                <option value="admin">Admin</option>
                                <option value="operator">Operator</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[member.project_role] || "bg-gray-100 text-gray-600"}`}>
                                {member.project_role}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                            {new Date(member.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : locale === "zh-TW" ? "zh-TW" : locale === "fr" ? "fr-FR" : "en-US", {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </td>
                          <td className="py-2">
                            {canManage && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${member.email}?`)) return;
                                  await fetch(`/api/team-members?project_id=${projects[0]?.id}&member_email=${encodeURIComponent(member.email)}`, { method: "DELETE" });
                                  setTeamMembers((prev) => prev.filter((m) => m.email !== member.email));
                                }}
                                className="text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                {tc.remove}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* API Keys (BYOK) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{ts.byokTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.byokDesc}</p>

          <div className="space-y-3">
            {([
              { service: "openai", name: ts.byokOpenai, hint: ts.byokOpenaiHint },
              { service: "anthropic", name: ts.byokAnthropic, hint: ts.byokAnthropicHint },
              { service: "google", name: ts.byokGoogle, hint: ts.byokGoogleHint },
              { service: "vercel", name: ts.byokVercel, hint: ts.byokVercelHint },
              { service: "clawhub", name: ts.byokClawhub, hint: ts.byokClawhubHint },
            ] as const).map((svc) => {
              const existing = apiKeys.find((k) => k.service === svc.service);
              const isEditing = byokEditing === svc.service;

              return (
                <div key={svc.service} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{svc.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${existing ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                        {existing ? ts.byokMasked : ts.byokNotSet}
                      </span>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => {
                          setByokEditing(svc.service);
                          setByokKeyInput("");
                          setByokLabelInput(existing?.label || "");
                        }}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                      >
                        {existing ? ts.edit : ts.byokSave}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{svc.hint}</p>

                  {existing && !isEditing && (
                    <p className="text-sm text-gray-600 font-mono">{existing.masked_key}</p>
                  )}

                  {isEditing && (
                    <div className="space-y-2 mt-2">
                      <input
                        type="password"
                        value={byokKeyInput}
                        onChange={(e) => setByokKeyInput(e.target.value)}
                        placeholder={ts.byokPlaceholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-mono"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={byokLabelInput}
                        onChange={(e) => setByokLabelInput(e.target.value)}
                        placeholder={ts.byokLabel}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!byokKeyInput) return;
                            setByokSaving(true);
                            try {
                              const res = await fetch("/api/api-keys", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "upsert", service: svc.service, api_key: byokKeyInput, label: byokLabelInput || null }),
                              });
                              if (res.ok) {
                                setByokMsg(ts.byokSaved);
                                setByokEditing(null);
                                setByokKeyInput("");
                                const data = await fetch("/api/api-keys").then((r) => r.json());
                                setApiKeys(data.keys || []);
                              }
                            } finally {
                              setByokSaving(false);
                              setTimeout(() => setByokMsg(""), 3000);
                            }
                          }}
                          disabled={byokSaving || !byokKeyInput}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {byokSaving ? "..." : ts.byokSave}
                        </button>
                        <button
                          onClick={() => setByokEditing(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 transition-colors cursor-pointer"
                        >
                          {tc.cancel}
                        </button>
                        {existing && (
                          <button
                            onClick={async () => {
                              await fetch("/api/api-keys", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "delete", service: svc.service }),
                              });
                              setByokMsg(ts.byokDeleted);
                              setByokEditing(null);
                              const data = await fetch("/api/api-keys").then((r) => r.json());
                              setApiKeys(data.keys || []);
                              setTimeout(() => setByokMsg(""), 3000);
                            }}
                            className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 transition-colors cursor-pointer"
                          >
                            {ts.byokDelete}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* X (Twitter) - 4 keys grouped */}
            {(() => {
              const twitterKeys = [
                { service: "twitter_api_key" as const, name: ts.byokTwitterApiKey },
                { service: "twitter_api_secret" as const, name: ts.byokTwitterApiSecret },
                { service: "twitter_access_token" as const, name: ts.byokTwitterAccessToken },
                { service: "twitter_access_token_secret" as const, name: ts.byokTwitterAccessTokenSecret },
              ];
              const twitterConfigured = twitterKeys.filter((k) => apiKeys.some((a) => a.service === k.service));
              const isEditingTwitter = byokEditing === "twitter";

              return (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{ts.byokTwitter}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${twitterConfigured.length === 4 ? "bg-green-100 text-green-800" : twitterConfigured.length > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-500"}`}>
                        {twitterConfigured.length === 4 ? ts.byokMasked : twitterConfigured.length > 0 ? `${twitterConfigured.length}/4` : ts.byokNotSet}
                      </span>
                    </div>
                    {!isEditingTwitter && (
                      <button
                        onClick={() => {
                          setByokEditing("twitter");
                          setByokKeyInput("");
                        }}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                      >
                        {twitterConfigured.length > 0 ? ts.edit : ts.byokSave}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{ts.byokTwitterHint}</p>

                  {!isEditingTwitter && twitterConfigured.length > 0 && (
                    <div className="space-y-1">
                      {twitterKeys.map((tk) => {
                        const existing = apiKeys.find((a) => a.service === tk.service);
                        return existing ? (
                          <div key={tk.service} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-36">{tk.name}:</span>
                            <span className="text-sm text-gray-600 font-mono">{existing.masked_key}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}

                  {isEditingTwitter && (
                    <div className="space-y-2 mt-2">
                      {twitterKeys.map((tk) => {
                        const existing = apiKeys.find((a) => a.service === tk.service);
                        return (
                          <div key={tk.service}>
                            <label className="text-xs text-gray-500 mb-1 block">{tk.name}</label>
                            <input
                              type="password"
                              defaultValue=""
                              placeholder={existing ? "••••••••  (leave blank to keep)" : ts.byokPlaceholder}
                              data-twitter-key={tk.service}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-mono"
                            />
                          </div>
                        );
                      })}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={async () => {
                            setByokSaving(true);
                            try {
                              const inputs = document.querySelectorAll<HTMLInputElement>("[data-twitter-key]");
                              let saved = false;
                              for (const input of inputs) {
                                const service = input.getAttribute("data-twitter-key");
                                const value = input.value.trim();
                                if (value && service) {
                                  const res = await fetch("/api/api-keys", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "upsert", service, api_key: value }),
                                  });
                                  if (res.ok) saved = true;
                                }
                              }
                              if (saved) {
                                setByokMsg(ts.byokSaved);
                                setByokEditing(null);
                                const data = await fetch("/api/api-keys").then((r) => r.json());
                                setApiKeys(data.keys || []);
                              }
                            } finally {
                              setByokSaving(false);
                              setTimeout(() => setByokMsg(""), 3000);
                            }
                          }}
                          disabled={byokSaving}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {byokSaving ? "..." : ts.byokSave}
                        </button>
                        <button
                          onClick={() => setByokEditing(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 transition-colors cursor-pointer"
                        >
                          {tc.cancel}
                        </button>
                        {twitterConfigured.length > 0 && (
                          <button
                            onClick={async () => {
                              for (const tk of twitterKeys) {
                                await fetch("/api/api-keys", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "delete", service: tk.service }),
                                });
                              }
                              setByokMsg(ts.byokDeleted);
                              setByokEditing(null);
                              const data = await fetch("/api/api-keys").then((r) => r.json());
                              setApiKeys(data.keys || []);
                              setTimeout(() => setByokMsg(""), 3000);
                            }}
                            className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 transition-colors cursor-pointer"
                          >
                            {ts.byokDelete}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {byokMsg && <p className="text-sm text-green-600 mt-3">{byokMsg}</p>}
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-1">{ts.auditLogTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.auditLogDesc}</p>

          {auditLoading ? (
            <p className="text-sm text-gray-400">{tc.loading}</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400">{ts.auditLogEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.auditAction}</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.auditResource}</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">{ts.auditUser}</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs">{ts.auditTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-700">
                        {(ACTION_LABELS[locale] || ACTION_LABELS.en)[log.action] || log.action}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {log.resource_type ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ""}` : "-"}
                      </td>
                      <td className="py-2 pr-4 text-gray-500 truncate max-w-40">{log.user_email}</td>
                      <td className="py-2 text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString(locale === "zh" ? "zh-CN" : locale === "zh-TW" ? "zh-TW" : locale === "fr" ? "fr-FR" : "en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
