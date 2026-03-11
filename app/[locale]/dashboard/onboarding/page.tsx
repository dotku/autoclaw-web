"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const t = dict.onboarding;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create org state
  const [orgName, setOrgName] = useState("");
  const [orgDomain, setOrgDomain] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join org state
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  // Check if user already has an org — redirect if so
  useEffect(() => {
    if (!user) return;
    // Starter plan users don't need org — redirect them
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.plan === "starter") {
          router.replace(`/${locale}/dashboard/reports`);
          return;
        }
      });
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (data.orgs && data.orgs.length > 0) {
          router.replace(`/${locale}/dashboard/reports`);
        }
      });
  }, [user, locale, router]);

  // Debounced org name availability check
  useEffect(() => {
    if (!orgName.trim()) {
      setNameStatus("idle");
      return;
    }
    setNameStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_name", name: orgName.trim() }),
        });
        const data = await res.json();
        setNameStatus(data.available ? "available" : "taken");
      } catch {
        setNameStatus("idle");
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [orgName]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || nameStatus === "taken") return;
    setCreating(true);
    setMsg("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: orgName.trim(), domain: orgDomain.trim() || null }),
      });
      if (res.ok) {
        setMsg(t.createSuccess);
        setMsgType("success");
        setTimeout(() => router.push(`/${locale}/dashboard/reports`), 1500);
      } else {
        const data = await res.json();
        setMsg(data.error || "Failed");
        setMsgType("error");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim()) return;
    setJoining(true);
    setMsg("");
    try {
      // First check if org exists
      const checkRes = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_name", name: joinName.trim() }),
      });
      const checkData = await checkRes.json();
      if (checkData.available) {
        // Org doesn't exist
        setMsg(t.orgNotFound);
        setMsgType("error");
        return;
      }

      // Try to add self as member
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name: joinName.trim() }),
      });
      if (res.ok) {
        setMsg(t.joinSuccess);
        setMsgType("success");
        setTimeout(() => router.push(`/${locale}/dashboard/reports`), 1500);
      } else {
        const data = await res.json();
        setMsg(data.error || "Failed");
        setMsgType("error");
      }
    } finally {
      setJoining(false);
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
          <h1 className="text-2xl font-bold mb-4">{t.welcomeTitle}</h1>
          <a href={`/auth/login?returnTo=/${locale}/dashboard/onboarding`} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
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
            <LanguageSwitcher locale={locale} />
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">&#127919;</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.welcomeTitle}</h1>
            <p className="text-sm text-gray-500">{t.welcomeDesc}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => { setTab("create"); setMsg(""); }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === "create"
                    ? "text-red-600 border-b-2 border-red-600 bg-red-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.createOrgTab}
              </button>
              <button
                onClick={() => { setTab("join"); setMsg(""); }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === "join"
                    ? "text-red-600 border-b-2 border-red-600 bg-red-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.joinOrgTab}
              </button>
            </div>

            <div className="p-6">
              {tab === "create" ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.orgNameLabel}</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder={t.orgNamePlaceholder}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors ${
                        nameStatus === "taken"
                          ? "border-red-400"
                          : nameStatus === "available"
                          ? "border-green-400"
                          : "border-gray-300"
                      }`}
                      autoFocus
                    />
                    <div className="mt-1.5 min-h-[20px]">
                      {nameStatus === "checking" && (
                        <p className="text-xs text-gray-400">...</p>
                      )}
                      {nameStatus === "taken" && (
                        <p className="text-xs text-red-500">{t.orgNameTaken}</p>
                      )}
                      {nameStatus === "available" && (
                        <p className="text-xs text-green-600">{t.orgNameAvailable}</p>
                      )}
                      {nameStatus === "idle" && orgName === "" && (
                        <p className="text-xs text-gray-400">{t.orgNameHint}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.orgDomainLabel}</label>
                    <input
                      type="text"
                      value={orgDomain}
                      onChange={(e) => setOrgDomain(e.target.value)}
                      placeholder={t.orgDomainPlaceholder}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">{t.orgDomainHint}</p>
                  </div>

                  <button
                    type="submit"
                    disabled={creating || !orgName.trim() || nameStatus === "taken" || nameStatus === "checking"}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {creating ? t.creating : t.createOrgBtn}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <p className="text-sm text-gray-500">{t.joinDesc}</p>
                  <div>
                    <input
                      type="text"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder={t.joinOrgPlaceholder}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={joining || !joinName.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {joining ? t.joining : t.joinOrgBtn}
                  </button>
                </form>
              )}

              {msg && (
                <p className={`text-sm mt-4 ${msgType === "success" ? "text-green-600" : "text-red-500"}`}>{msg}</p>
              )}
            </div>
          </div>

          {/* Skip */}
          <div className="text-center mt-6">
            <button
              onClick={() => router.push(`/${locale}/dashboard/reports`)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              {t.skipBtn}
            </button>
            <p className="text-xs text-gray-300 mt-1">{t.skipHint}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
