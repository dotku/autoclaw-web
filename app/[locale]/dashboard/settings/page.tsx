"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

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
  const [teamMembers, setTeamMembers] = useState<{ email: string; name: string; project_role: string; created_at: string; project_ids: number[] }[]>([]);
  const [projectInviteEmail, setProjectInviteEmail] = useState<Record<number, string>>({});
  const [projectInviting, setProjectInviting] = useState<Record<number, boolean>>({});
  const [projectInviteMsg, setProjectInviteMsg] = useState<Record<number, string>>({});
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    projects: true,
    language: true,
    org: true,
    byok: true,
  });

  useEffect(() => {
    if (!user) return;
    fetch(`/api/projects?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects || []); if (data.role) setUserRole(data.role); if (data.plan) setUserPlan(data.plan); });
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
          <a href="/auth/login" className="bg-red-800 hover:bg-red-900 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      <div className="px-4 sm:px-6 py-6 w-full">
        <h1 className="text-2xl font-bold mb-4">{ts.title}</h1>

        {/* Settings Index Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: "projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", label: ts.projectsTitle, count: projects.length },
            { key: "language", icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129", label: ts.language },
            { key: "org", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: ts.orgTitle, count: orgs.length },
            { key: "byok", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label: ts.byokTitle, count: apiKeys.length },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setCollapsed((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                setTimeout(() => document.getElementById(`section-${item.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all cursor-pointer ${
                !collapsed[item.key] ? "border-red-300 bg-red-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <svg className={`w-6 h-6 ${!collapsed[item.key] ? "text-red-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <span className={`text-xs font-medium ${!collapsed[item.key] ? "text-red-700" : "text-gray-600"}`}>{item.label}</span>
              {item.count !== undefined && (
                <span className="text-[10px] text-gray-400">{item.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Project Management */}
        <div id="section-projects" className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, projects: !prev.projects }))}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-lg font-semibold">{ts.projectsTitle}</h2>
              <p className="text-sm text-gray-500">{ts.projectsDesc}</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${collapsed.projects ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsed.projects && <div className="px-6 pb-6 border-t border-gray-100 pt-4">

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
                            className="text-xs bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
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

                  {/* Project Team Members */}
                  {(() => {
                    const projectMembers = teamMembers.filter((m) => m.project_ids?.includes(project.id));
                    const isOwner = projectMembers.some((m) => m.email === user?.email && m.project_role === "owner");
                    const canManage = isOwner || userRole === "admin";
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">{ts.teamTitle || "Team Members"}</h4>
                        {projectMembers.length > 0 && (
                          <div className="overflow-x-auto mb-2">
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
                                {projectMembers.map((member) => {
                                  const memberIsOwner = member.project_role === "owner";
                                  const isSelf = member.email === user?.email;
                                  const roleColors: Record<string, string> = {
                                    owner: "bg-red-100 text-red-800",
                                    admin: "bg-purple-100 text-purple-800",
                                    operator: "bg-blue-100 text-blue-700",
                                    viewer: "bg-gray-100 text-gray-600",
                                    member: "bg-gray-100 text-gray-600",
                                    domain: "bg-green-100 text-green-700",
                                  };
                                  const canEdit = canManage && !memberIsOwner && !isSelf;
                                  return (
                                    <tr key={member.email} className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-700">{member.email}</td>
                                      <td className="py-2 pr-4 text-gray-500">{member.name || "-"}</td>
                                      <td className="py-2 pr-4">
                                        {canEdit ? (
                                          <select
                                            value={member.project_role}
                                            onChange={async (e) => {
                                              const newRole = e.target.value;
                                              await fetch("/api/team-members", {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ project_id: project.id, member_email: member.email, role: newRole }),
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
                                      <td className="py-2">
                                        {canEdit && (
                                          <button
                                            onClick={async () => {
                                              if (!confirm(`Remove ${member.email}?`)) return;
                                              await fetch(`/api/team-members?project_id=${project.id}&member_email=${encodeURIComponent(member.email)}`, { method: "DELETE" });
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
                        {canManage && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="email"
                              value={projectInviteEmail[project.id] || ""}
                              onChange={(e) => setProjectInviteEmail((prev) => ({ ...prev, [project.id]: e.target.value }))}
                              placeholder={ts.invitePlaceholder || "colleague@company.com"}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            />
                            <button
                              onClick={async () => {
                                const email = projectInviteEmail[project.id];
                                if (!email) return;
                                setProjectInviting((prev) => ({ ...prev, [project.id]: true }));
                                try {
                                  const res = await fetch("/api/team-members", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ email, project_id: project.id }),
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setProjectInviteMsg((prev) => ({ ...prev, [project.id]: ts.inviteSuccess || "Added!" }));
                                    setProjectInviteEmail((prev) => ({ ...prev, [project.id]: "" }));
                                    fetch("/api/team-members").then((r) => r.json()).then((d) => setTeamMembers(d.members || []));
                                  } else {
                                    setProjectInviteMsg((prev) => ({ ...prev, [project.id]: data.error || "Failed" }));
                                  }
                                } finally {
                                  setProjectInviting((prev) => ({ ...prev, [project.id]: false }));
                                  setTimeout(() => setProjectInviteMsg((prev) => ({ ...prev, [project.id]: "" })), 3000);
                                }
                              }}
                              disabled={projectInviting[project.id] || !projectInviteEmail[project.id]}
                              className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {projectInviting[project.id] ? "..." : (ts.inviteBtn || "Invite")}
                            </button>
                          </div>
                        )}
                        {projectInviteMsg[project.id] && <p className="text-sm text-green-600 mt-1">{projectInviteMsg[project.id]}</p>}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>}
        </div>

        {/* Language Settings */}
        <div id="section-language" className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, language: !prev.language }))}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-lg font-semibold">{ts.language}</h2>
              <p className="text-sm text-gray-500">{ts.languageDesc}</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${collapsed.language ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsed.language && <div className="px-6 pb-6 border-t border-gray-100 pt-4">

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
              className="bg-red-800 hover:bg-red-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {tc.save}
            </button>
            {saved && <span className="text-sm text-green-600">{ts.saved}</span>}
          </div>
        </div>}
        </div>

        {/* Team & Organization */}
        <div id="section-org" className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, org: !prev.org }))}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-lg font-semibold">{ts.orgTitle}</h2>
              <p className="text-sm text-gray-500">{ts.orgDesc}</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${collapsed.org ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsed.org && <div className="px-6 pb-6 border-t border-gray-100 pt-4">

          {userPlan === "starter" ? (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500 mb-3">{ts.orgUpgradeHint}</p>
              <Link href={`/${locale}/dashboard/billing`} className="inline-block bg-red-800 hover:bg-red-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
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
                  className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
                        className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {addingMember ? "..." : ts.orgAddMember}
                      </button>
                    </div>
                  )}

                  {/* Assigned Projects */}
                  {(() => {
                    const orgProjects = projects.filter((p) => p.org_id === org.id);
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">{ts.orgProjects || "Projects"} ({orgProjects.length})</h4>
                        {orgProjects.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {orgProjects.map((p) => (
                              <div key={p.id} className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-700">{p.name}</span>
                                  {p.website && <span className="text-xs text-gray-400 truncate max-w-[200px]">{p.website}</span>}
                                </div>
                                {org.member_role === "admin" && (
                                  <button
                                    onClick={async () => {
                                      await fetch("/api/projects", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "update_project", project_id: p.id, org_id: null }),
                                      });
                                      setProjects((prev) => prev.map((proj) => proj.id === p.id ? { ...proj, org_id: null } : proj));
                                      fetch("/api/organizations").then((r) => r.json()).then((d) => setOrgs(d.orgs || []));
                                    }}
                                    className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                                  >
                                    {ts.orgUnassign || "Unassign"}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Assign Project to Org (only for org admins) */}
                        {org.member_role === "admin" && projects.filter((p) => !p.org_id).length > 0 && (
                          <div className="flex flex-col sm:flex-row gap-2">
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
                    );
                  })()}
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
                    className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {orgCreating ? "..." : ts.orgCreate}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>}
        </div>

        {/* API Keys (BYOK) */}
        <div id="section-byok" className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, byok: !prev.byok }))}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-lg font-semibold">{ts.byokTitle}</h2>
              <p className="text-sm text-gray-500">{ts.byokDesc}</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${collapsed.byok ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsed.byok && <div className="px-6 pb-6 border-t border-gray-100 pt-4">

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
                          className="text-xs bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
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
                          className="text-xs bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
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
        </div>}
        </div>

      </div>
    </DashboardShell>
  );
}
