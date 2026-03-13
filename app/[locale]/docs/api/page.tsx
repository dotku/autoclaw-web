"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  scope: "read" | "write";
  description: string;
  params?: { name: string; type: string; required?: boolean; description: string }[];
  body?: { name: string; type: string; required?: boolean; description: string }[];
  response: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-800",
  POST: "bg-blue-100 text-blue-800",
  PATCH: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

const ENDPOINTS: { section: string; endpoints: Endpoint[] }[] = [
  {
    section: "Authentication",
    endpoints: [],
  },
  {
    section: "User",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/me",
        scope: "read",
        description: "Get the authenticated user's profile, plan, usage stats, and resource counts.",
        response: `{
  "user": { "id": 1, "email": "you@example.com", "name": "...", "plan": "growth", "created_at": "..." },
  "scopes": ["read", "write"],
  "usage": { "today": { "total_tokens": 1234, "prompt_tokens": 800, "completion_tokens": 434, "request_count": 5 } },
  "counts": { "documents": 12, "organizations": 1, "projects": 3 }
}`,
      },
    ],
  },
  {
    section: "Projects",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/projects",
        scope: "read",
        description: "List all projects owned by the authenticated user.",
        params: [
          { name: "limit", type: "number", description: "Max results (1-100, default 20)" },
          { name: "offset", type: "number", description: "Pagination offset (default 0)" },
        ],
        response: `{ "projects": [...], "total": 5, "limit": 20, "offset": 0 }`,
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        scope: "write",
        description: "Create a new project.",
        body: [
          { name: "name", type: "string", required: true, description: "Project name" },
          { name: "website", type: "string", description: "Project website URL" },
          { name: "description", type: "string", description: "Project description" },
          { name: "domain", type: "string", description: "Custom domain" },
          { name: "org_id", type: "number", description: "Organization ID (optional)" },
        ],
        response: `{ "project": { "id": 1, "name": "...", ... } }`,
      },
      {
        method: "GET",
        path: "/api/v1/projects/:id",
        scope: "read",
        description: "Get a single project with its agent assignments.",
        response: `{ "project": { "id": 1, "name": "...", "agents": [...], ... } }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/projects/:id",
        scope: "write",
        description: "Update a project's name, website, description, or domain.",
        body: [
          { name: "name", type: "string", description: "New project name" },
          { name: "website", type: "string", description: "New website URL" },
          { name: "description", type: "string", description: "New description" },
          { name: "domain", type: "string", description: "New domain" },
        ],
        response: `{ "project": { ... } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/projects/:id",
        scope: "write",
        description: "Delete a project and all associated data.",
        response: `{ "deleted": true }`,
      },
    ],
  },
  {
    section: "Knowledge Base",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/kb/documents",
        scope: "read",
        description: "List knowledge base documents.",
        params: [
          { name: "scope", type: "string", description: "Filter by scope: personal, org, project" },
          { name: "status", type: "string", description: "Filter by status: ready, processing, queued, error" },
          { name: "limit", type: "number", description: "Max results (1-100, default 20)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{ "documents": [...], "total": 12, "limit": 20, "offset": 0 }`,
      },
      {
        method: "POST",
        path: "/api/v1/kb/documents",
        scope: "write",
        description: "Create a new document from a URL or plain text. URL documents are automatically fetched and chunked.",
        body: [
          { name: "type", type: "string", required: true, description: "'url' or 'text'" },
          { name: "url", type: "string", description: "URL to add (required when type='url')" },
          { name: "text", type: "string", description: "Text content (required when type='text')" },
          { name: "title", type: "string", description: "Document title" },
          { name: "scope", type: "string", description: "personal (default), org, or project" },
          { name: "org_id", type: "number", description: "Organization ID (for org scope)" },
          { name: "project_id", type: "number", description: "Project ID (for project scope)" },
        ],
        response: `{ "document": { "id": 1, "title": "...", "status": "ready", ... } }`,
      },
      {
        method: "GET",
        path: "/api/v1/kb/documents/:id",
        scope: "read",
        description: "Get a single document with all its chunks.",
        response: `{ "document": { ... }, "chunks": [{ "chunk_index": 0, "content": "...", "token_count": 123 }, ...] }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/kb/documents/:id",
        scope: "write",
        description: "Update a document's title or URL. If the URL changes, content is re-extracted and re-embedded.",
        body: [
          { name: "title", type: "string", description: "New title" },
          { name: "url", type: "string", description: "New URL (URL documents only)" },
        ],
        response: `{ "document": { ... } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/kb/documents/:id",
        scope: "write",
        description: "Delete a document and all its chunks.",
        response: `{ "deleted": true }`,
      },
      {
        method: "GET",
        path: "/api/v1/kb/documents/:id/chunks",
        scope: "read",
        description: "List all chunks for a document.",
        response: `{ "chunks": [...], "total": 5 }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/kb/documents/:id/chunks/:index",
        scope: "write",
        description: "Edit a chunk's content. The embedding is automatically re-generated.",
        body: [
          { name: "content", type: "string", required: true, description: "New chunk content" },
        ],
        response: `{ "updated": true, "chunk_index": 0, "token_count": 150 }`,
      },
    ],
  },
  {
    section: "Chat",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/chat",
        scope: "read",
        description: "Get chat history. Returns messages in chronological order.",
        params: [
          { name: "project_id", type: "number", description: "Filter by project" },
          { name: "limit", type: "number", description: "Max results (1-100, default 20)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{ "messages": [{ "id": 1, "role": "user", "content": "...", "created_at": "..." }, ...] }`,
      },
      {
        method: "POST",
        path: "/api/v1/chat",
        scope: "write",
        description: "Send a message and receive an AI response. Uses RAG context from your knowledge base.",
        body: [
          { name: "message", type: "string", required: true, description: "The user message" },
          { name: "model", type: "string", description: "Model ID (optional, uses default if omitted)" },
          { name: "project_id", type: "number", description: "Scope chat to a specific project" },
        ],
        response: `{ "reply": "Here's what I found..." }`,
      },
    ],
  },
  {
    section: "Organizations",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/organizations",
        scope: "read",
        description: "List organizations the authenticated user belongs to.",
        response: `{ "organizations": [{ "id": 1, "name": "...", "plan": "growth", "user_role": "admin", "member_count": 5, ... }] }`,
      },
    ],
  },
];

const DEFAULT_BASE_URL = "https://autoclaw.jytech.us";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL;

export default function ApiDocsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("Authentication");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/${locale}`} className="text-xl font-bold tracking-tight flex items-center gap-2">
              <img src="/logo.svg" alt="AutoClaw" className="w-8 h-8" />
              <span><span className="text-red-600">Auto</span>Claw</span>
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-medium text-gray-600">API Reference</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/dashboard/settings`} className="text-sm text-gray-600 hover:text-gray-900">
              {dict.common.settings || "Settings"}
            </Link>
            <LanguageSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8">
        {/* Sidebar navigation */}
        <nav className="hidden lg:block w-48 shrink-0 sticky top-24 self-start space-y-1">
          {ENDPOINTS.map((group) => (
            <button
              key={group.section}
              onClick={() => {
                setActiveSection(group.section);
                document.getElementById(`section-${group.section}`)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`block w-full text-left px-3 py-1.5 text-sm rounded cursor-pointer transition-colors ${
                activeSection === group.section ? "bg-red-50 text-red-800 font-medium" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {group.section}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* Intro */}
          <div>
            <h1 className="text-3xl font-bold mb-3">AutoClaw API</h1>
            <p className="text-gray-600 mb-6">Build integrations with AutoClaw using our REST API. Manage projects, knowledge base documents, chat, and more.</p>

            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold">Base URL</h2>
              <code className="block bg-gray-50 rounded px-4 py-2 text-sm font-mono">{BASE_URL}/api/v1</code>

              <h2 className="text-sm font-semibold">Authentication</h2>
              <p className="text-sm text-gray-600">
                All API requests require a Bearer token. Create an API key in{" "}
                <Link href={`/${locale}/dashboard/settings`} className="text-red-700 underline">Settings</Link>{" "}
                under "Platform API Keys".
              </p>
              <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto">
{`curl ${BASE_URL}/api/v1/me \\
  -H "Authorization: Bearer ac_live_your_key_here"`}
              </pre>

              <h2 className="text-sm font-semibold">Scopes</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-3">
                  <p className="font-medium">read</p>
                  <p className="text-xs text-gray-500">View resources (GET requests)</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="font-medium">write</p>
                  <p className="text-xs text-gray-500">Create, update, delete resources</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="font-medium">admin</p>
                  <p className="text-xs text-gray-500">Full access (includes read + write)</p>
                </div>
              </div>

              <h2 className="text-sm font-semibold">Rate Limits</h2>
              <p className="text-sm text-gray-600">60 requests per minute per IP. Returns <code className="bg-gray-100 px-1 rounded text-xs">429 Too Many Requests</code> when exceeded.</p>

              <h2 className="text-sm font-semibold">Error Format</h2>
              <pre className="bg-gray-50 rounded px-4 py-2 text-sm font-mono">{`{ "error": "Description of what went wrong" }`}</pre>
            </div>
          </div>

          {/* Endpoint sections */}
          {ENDPOINTS.filter((g) => g.endpoints.length > 0).map((group) => (
            <div key={group.section} id={`section-${group.section}`}>
              <h2 className="text-xl font-bold mb-4 pt-2">{group.section}</h2>
              <div className="space-y-3">
                {group.endpoints.map((ep) => {
                  const key = `${ep.method}-${ep.path}`;
                  const isExpanded = expandedEndpoint === key;
                  return (
                    <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedEndpoint(isExpanded ? null : key)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_COLORS[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="text-sm font-mono text-gray-800 flex-1 text-left">{ep.path}</code>
                        <span className="text-xs text-gray-400">{ep.scope}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                          <p className="text-sm text-gray-600 pt-3">{ep.description}</p>

                          {ep.params && ep.params.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Query Parameters</h4>
                              <div className="bg-gray-50 rounded overflow-hidden">
                                <table className="w-full text-sm">
                                  <tbody>
                                    {ep.params.map((p) => (
                                      <tr key={p.name} className="border-b border-gray-100 last:border-0">
                                        <td className="px-3 py-2 font-mono text-xs w-32">
                                          {p.name}
                                          {p.required && <span className="text-red-500 ml-1">*</span>}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-400 w-20">{p.type}</td>
                                        <td className="px-3 py-2 text-xs text-gray-600">{p.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {ep.body && ep.body.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Request Body (JSON)</h4>
                              <div className="bg-gray-50 rounded overflow-hidden">
                                <table className="w-full text-sm">
                                  <tbody>
                                    {ep.body.map((p) => (
                                      <tr key={p.name} className="border-b border-gray-100 last:border-0">
                                        <td className="px-3 py-2 font-mono text-xs w-32">
                                          {p.name}
                                          {p.required && <span className="text-red-500 ml-1">*</span>}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-400 w-20">{p.type}</td>
                                        <td className="px-3 py-2 text-xs text-gray-600">{p.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Example Response</h4>
                            <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{ep.response}</pre>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">cURL Example</h4>
                            <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{ep.method === "GET"
  ? `curl ${BASE_URL}${ep.path} \\\n  -H "Authorization: Bearer ac_live_your_key"`
  : ep.method === "DELETE"
  ? `curl -X DELETE ${BASE_URL}${ep.path} \\\n  -H "Authorization: Bearer ac_live_your_key"`
  : `curl -X ${ep.method} ${BASE_URL}${ep.path} \\\n  -H "Authorization: Bearer ac_live_your_key" \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body ? JSON.stringify(Object.fromEntries(ep.body.filter((b) => b.required).map((b) => [b.name, b.type === "number" ? 1 : "..."])), null, 0) : "{}"}'`}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
            <p className="text-sm text-gray-500">
              Need help? Check the{" "}
              <Link href={`/${locale}/dashboard/settings`} className="text-red-700 underline">Settings page</Link>{" "}
              to manage your API keys, or use the{" "}
              <Link href={`/${locale}/dashboard/chat`} className="text-red-700 underline">chat</Link>{" "}
              to ask questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
