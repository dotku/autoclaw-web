"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserPlanBadge from "@/components/UserPlanBadge";
import ChatWidget from "@/components/ChatWidget";

interface Props {
  children: React.ReactNode;
  user: { email?: string | null };
  plan?: string;
  fullHeight?: boolean;
}

export default function DashboardShell({ children, user, plan, fullHeight }: Props) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const tc = dict.common;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { href: `/${locale}/dashboard/chat`, label: tc.chat },
    { href: `/${locale}/dashboard/agents`, label: tc.agents },
    { href: `/${locale}/dashboard/skills`, label: tc.skills },
    { href: `/${locale}/dashboard/knowledge`, label: tc.knowledge },
    { href: `/${locale}/dashboard/workflows`, label: tc.workflows },
    { href: `/${locale}/dashboard/reports`, label: tc.reports },
    { href: `/${locale}/dashboard/billing`, label: tc.billing },
    { href: `/${locale}/dashboard/settings`, label: tc.settings },
    { href: `/${locale}/dashboard/docs`, label: tc.docs },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className={`${fullHeight ? "h-screen" : "min-h-screen"} bg-gray-50 flex flex-col`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileNavOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <Link href={`/${locale}`} className="text-xl font-bold tracking-tight flex items-center gap-2">
              <img src="/logo.svg" alt="AutoClaw" className="w-8 h-8" />
              <span><span className="text-red-600">Auto</span>Claw</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher locale={locale} />
            <span className="text-sm text-gray-600 hidden sm:flex items-center gap-1.5">
              {user.email} <UserPlanBadge plan={plan} />
            </span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-44 bg-white border-r border-gray-200 py-4 shrink-0">
          <nav className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-red-50 text-red-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile nav overlay */}
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <aside className="relative w-56 bg-white shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{tc.dashboard}</span>
                <button onClick={() => setMobileNavOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-0.5 px-2 py-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-red-50 text-red-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto px-4 py-3 border-t border-gray-100 sm:hidden">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  {user.email} <UserPlanBadge plan={plan} />
                </span>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className={`flex-1 ${fullHeight ? "flex flex-col min-h-0 overflow-hidden" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>

      {/* Floating chat widget */}
      <ChatWidget />
    </div>
  );
}
