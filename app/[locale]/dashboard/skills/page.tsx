"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

type Category = "all" | "email" | "seo" | "leads" | "social" | "analytics" | "automation";

interface Skill {
  key: string;
  category: Exclude<Category, "all">;
  agents: number;
  active: boolean;
}

const SKILLS: Skill[] = [
  // Email
  { key: "skillColdEmail", category: "email", agents: 3, active: true },
  { key: "skillFollowUp", category: "email", agents: 2, active: true },
  { key: "skillNewsletter", category: "email", agents: 1, active: false },
  { key: "skillEmailTemplate", category: "email", agents: 1, active: false },
  // SEO
  { key: "skillBlogWriter", category: "seo", agents: 4, active: true },
  { key: "skillKeywordResearch", category: "seo", agents: 2, active: true },
  { key: "skillSeoAudit", category: "seo", agents: 1, active: false },
  { key: "skillMetaOptimizer", category: "seo", agents: 1, active: false },
  // Leads
  { key: "skillLinkedIn", category: "leads", agents: 3, active: true },
  { key: "skillWebScraper", category: "leads", agents: 2, active: false },
  { key: "skillEnrichment", category: "leads", agents: 1, active: false },
  { key: "skillCrmSync", category: "leads", agents: 2, active: true },
  // Social
  { key: "skillTweetComposer", category: "social", agents: 3, active: true },
  { key: "skillContentScheduler", category: "social", agents: 2, active: true },
  { key: "skillSocialListening", category: "social", agents: 1, active: false },
  { key: "skillHashtagResearch", category: "social", agents: 1, active: false },
  // Analytics
  { key: "skillTrafficDashboard", category: "analytics", agents: 2, active: true },
  { key: "skillCampaignAnalytics", category: "analytics", agents: 3, active: true },
  { key: "skillConversionTracking", category: "analytics", agents: 1, active: false },
  { key: "skillReportGenerator", category: "analytics", agents: 2, active: false },
  // Automation
  { key: "skillWorkflowBuilder", category: "automation", agents: 2, active: true },
  { key: "skillWebhookTrigger", category: "automation", agents: 1, active: false },
  { key: "skillDataPipeline", category: "automation", agents: 1, active: false },
  { key: "skillTaskScheduler", category: "automation", agents: 2, active: true },
];

const CATEGORY_ICONS: Record<Exclude<Category, "all">, string> = {
  email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  seo: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  leads: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  social: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
  analytics: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  automation: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

export default function SkillsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const ts = dict.skillsPage;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const categories: { key: Category; label: string }[] = [
    { key: "all", label: ts.allCategories },
    { key: "email", label: ts.catEmail },
    { key: "seo", label: ts.catSeo },
    { key: "leads", label: ts.catLeads },
    { key: "social", label: ts.catSocial },
    { key: "analytics", label: ts.catAnalytics },
    { key: "automation", label: ts.catAutomation },
  ];

  const filtered = activeCategory === "all" ? SKILLS : SKILLS.filter((s) => s.category === activeCategory);

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
          <h1 className="text-2xl font-bold mb-4">{ts.title}</h1>
          <a href={`/auth/login?returnTo=/${locale}/dashboard/skills`} className="bg-red-800 hover:bg-red-900 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      <div className="px-4 sm:px-6 py-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{ts.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{ts.subtitle}</p>
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory === cat.key
                  ? "bg-red-700 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skills grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">{ts.noSkills}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((skill) => {
              const name = ts[skill.key as keyof typeof ts] as string;
              const desc = ts[`${skill.key}Desc` as keyof typeof ts] as string;
              const icon = CATEGORY_ICONS[skill.category];
              const catLabel = categories.find((c) => c.key === skill.category)?.label || skill.category;

              return (
                <div
                  key={skill.key}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        skill.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {skill.active ? ts.active : ts.available}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{name}</h3>
                  <p className="text-xs text-gray-500 mb-3 flex-1">{desc}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {catLabel}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ts.usedBy} {skill.agents} {skill.agents === 1 ? "agent" : "agents"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
