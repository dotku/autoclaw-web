"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserPlanBadge from "@/components/UserPlanBadge";

export default function DocsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const td = dict.docsPage;
  const tc = dict.common;
  const ts = dict.settings;

  const { user, isLoading: userLoading } = useUser();

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
          <h1 className="text-2xl font-bold">{td.title}</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            <Link href={`/${locale}/dashboard/chat`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.chat}</Link>
            <Link href={`/${locale}/dashboard/agents`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.agents}</Link>
            <Link href={`/${locale}/dashboard/reports`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.reports}</Link>
            <Link href={`/${locale}/dashboard/billing`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.billing}</Link>
            <Link href={`/${locale}/dashboard/settings`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.settings}</Link>
            <span className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-white text-gray-900 shadow-sm whitespace-nowrap">{tc.docs}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">{td.subtitle}</p>

        {/* Google Analytics Integration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{td.gaTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{td.gaDesc}</p>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{td.gaStep1}</p>
              <p className="text-sm text-gray-500">{td.gaStep1Desc}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{td.gaStep2}</p>
              <p className="text-sm text-gray-500">{td.gaStep2Desc}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{td.gaStep3}</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-800 select-all">
                  autoclaw-analytics@jytech.iam.gserviceaccount.com
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("autoclaw-analytics@jytech.iam.gserviceaccount.com");
                  }}
                  className="text-xs text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                >
                  {td.copy}
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{td.gaStep4}</p>
              <p className="text-sm text-gray-500">{td.gaStep4Desc}</p>
            </div>
          </div>
        </div>

        {/* Organizations & Teams */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{td.orgTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{td.orgDesc}</p>

          <div className="space-y-4">
            {[
              { title: td.orgGuide1Title, desc: td.orgGuide1Desc },
              { title: td.orgGuide2Title, desc: td.orgGuide2Desc },
              { title: td.orgGuide3Title, desc: td.orgGuide3Desc },
              { title: td.orgGuide4Title, desc: td.orgGuide4Desc },
              { title: td.orgGuide5Title, desc: td.orgGuide5Desc },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Agents Guide */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{td.agentsTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{td.agentsDesc}</p>

          <div className="space-y-4">
            {[
              { title: td.agentsGuide1Title, desc: td.agentsGuide1Desc },
              { title: td.agentsGuide2Title, desc: td.agentsGuide2Desc },
              { title: td.agentsGuide3Title, desc: td.agentsGuide3Desc },
              { title: td.agentsGuide4Title, desc: td.agentsGuide4Desc },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API & Integrations */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{td.apiTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{td.apiDesc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: td.apiBrevo, desc: td.apiBrevoDesc },
              { title: td.apiCrm, desc: td.apiCrmDesc },
              { title: td.apiSocial, desc: td.apiSocialDesc },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Compliance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{ts.securityTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{ts.securityDesc}</p>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{ts.dataPracticesTitle}</h3>
            <div className="space-y-2">
              {[ts.dataEncryption, ts.dataAuth, ts.dataRetention, ts.dataBackup, ts.dataAccess, ts.dataRateLimit, ts.dataLoginAudit].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{ts.complianceTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: ts.complianceSoc2, status: ts.complianceSoc2Status, color: "bg-yellow-100 text-yellow-800" },
                { label: ts.complianceHttps, status: ts.complianceHttpsStatus, color: "bg-green-100 text-green-800" },
                { label: ts.complianceHeaders, status: ts.complianceHeadersStatus, color: "bg-green-100 text-green-800" },
                { label: ts.complianceAudit, status: ts.complianceAuditStatus, color: "bg-green-100 text-green-800" },
                { label: ts.complianceRateLimit, status: ts.complianceRateLimitStatus, color: "bg-green-100 text-green-800" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{td.faqTitle}</h2>

          <div className="space-y-4">
            {[
              { q: td.faq1Q, a: td.faq1A },
              { q: td.faq2Q, a: td.faq2A },
              { q: td.faq3Q, a: td.faq3A },
              { q: td.faq4Q, a: td.faq4A },
            ].map((item, i) => (
              <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-gray-700">{item.q}</p>
                <p className="text-sm text-gray-500 mt-1">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-2">{td.contactTitle}</h2>
          <p className="text-sm text-gray-500">
            {td.contactDesc}{" "}
            <a href="mailto:jay.lin@jytech.us" className="text-red-600 hover:text-red-800 transition-colors">
              jay.lin@jytech.us
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
