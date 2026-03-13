"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

export default function IncomePage() {
  const { user, isLoading } = useUser();
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const tc = dict.common;

  if (isLoading) {
    return (
      <DashboardShell user={{ email: null }} plan="">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">{tc.loading}</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell user={{ email: null }} plan="">
        <div className="flex items-center justify-center h-64">
          <a href="/auth/login" className="text-red-600 hover:underline">{tc.logIn}</a>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} plan="">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{tc.income}</h1>
        <p className="text-gray-500 mb-8">
          Track revenue from your products and services. Connect Google Analytics or accounting APIs to view income data.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly Revenue</p>
            <p className="text-2xl font-bold text-gray-300">—</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Transactions</p>
            <p className="text-2xl font-bold text-gray-300">—</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Growth</p>
            <p className="text-2xl font-bold text-gray-300">—</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-500 mb-2">Coming Soon</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Connect Google Analytics e-commerce tracking or accounting APIs (QuickBooks, Xero) to automatically import and visualize your income data.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
