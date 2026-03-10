"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  plan: string;
  amount: number | null;
  interval: string;
  cancel_at_period_end: boolean;
}

interface TokenSummary {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
}

interface TokenByModel {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
}

interface TokenByDate {
  date: string;
  total_tokens: number;
  request_count: number;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

// Retail pricing per 1M tokens [input, output]
// Includes API cost + compute/infrastructure overhead
const MODEL_PRICING: Record<string, [number, number]> = {
  // Premium models — API + compute
  "anthropic/claude-sonnet-4.5": [15, 75],
  "anthropic/claude-haiku-3.5": [4, 20],
  "anthropic/claude-opus-4": [75, 375],
  "openai/gpt-4o": [12.5, 50],
  "openai/gpt-4o-mini": [0.75, 3],
  // Open models — compute cost only
  "meta/llama-3.3-70b-instruct": [0.20, 0.20],
  "llama-3.1-nemotron-nano-8b-v1": [0.10, 0.10],
  "llama3.1-8b": [0.05, 0.05],
  "gpt-oss-120b": [0.30, 0.30],
  "qwen2.5:3b": [0.05, 0.05],
  "qwen2.5:7b": [0.10, 0.10],
  "gemini-2.0-flash": [0.05, 0.05],
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (promptTokens / 1_000_000) * pricing[0] + (completionTokens / 1_000_000) * pricing[1];
}

function formatCost(cost: number): string {
  if (cost === 0) return "—";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function statusBadge(status: string | null) {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    open: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    void: "bg-red-100 text-red-700",
    uncollectible: "bg-red-100 text-red-700",
    past_due: "bg-red-100 text-red-700",
    canceled: "bg-gray-100 text-gray-600",
    trialing: "bg-red-100 text-red-700",
    paused: "bg-yellow-100 text-yellow-700",
  };
  const s = status || "unknown";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}>
      {s}
    </span>
  );
}

export default function BillingPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const td = dict.dashboard;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [userPlan, setUserPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [tokenByModel, setTokenByModel] = useState<TokenByModel[]>([]);
  const [tokenByDate, setTokenByDate] = useState<TokenByDate[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchBilling = fetch("/api/invoices").then((r) => r.json()).catch(() => ({}));
    const fetchTokens = fetch("/api/token-usage").then((r) => r.json()).catch(() => ({}));
    Promise.all([fetchBilling, fetchTokens])
      .then(([billingData, tokenData]) => {
        setInvoices(billingData.invoices || []);
        setSubscriptions(billingData.subscriptions || []);
        if (billingData.userPlan) setUserPlan(billingData.userPlan);
        setTokenSummary(tokenData.summary || null);
        setTokenByModel(tokenData.byModel || []);
        setTokenByDate(tokenData.byDate || []);
      })
      .finally(() => setLoading(false));
  }, [user]);

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
          <h1 className="text-2xl font-bold mb-4">{td.signInDashboard}</h1>
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
            <LanguageSwitcher locale={locale} />
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{tc.billing}</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            <Link href={`/${locale}/dashboard`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.chat}</Link>
            <Link href={`/${locale}/dashboard/agents`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.agents}</Link>
            <Link href={`/${locale}/dashboard/reports`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.reports}</Link>
            <span className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-white text-gray-900 shadow-sm whitespace-nowrap">{tc.billing}</span>
            <Link href={`/${locale}/dashboard/settings`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.settings}</Link>
            <Link href={`/${locale}/dashboard/docs`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.docs}</Link>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">{tc.loading}</p>
        ) : (
          <>
            {/* Token Usage Section */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">{td.tokenUsage}</h2>
              {!tokenSummary || Number(tokenSummary.total_tokens) === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500">{td.noTokenUsage}</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  {(() => {
                    const totalCost = tokenByModel.reduce((sum, row) => sum + estimateCost(row.model, Number(row.prompt_tokens), Number(row.completion_tokens)), 0);
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">{td.estCost}</p>
                          <p className="text-xl font-bold text-red-600">{formatCost(totalCost)}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">{td.totalTokens}</p>
                          <p className="text-xl font-bold text-gray-900">{formatNumber(Number(tokenSummary.total_tokens))}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">{td.promptTokens}</p>
                          <p className="text-xl font-bold text-gray-900">{formatNumber(Number(tokenSummary.prompt_tokens))}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">{td.completionTokens}</p>
                          <p className="text-xl font-bold text-gray-900">{formatNumber(Number(tokenSummary.completion_tokens))}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">{td.requests}</p>
                          <p className="text-xl font-bold text-gray-900">{formatNumber(Number(tokenSummary.request_count))}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Usage by Provider/Model */}
                  {tokenByModel.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-medium text-gray-600">{td.usageByModel}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left px-4 py-2 font-medium text-gray-500">{td.model}</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-500">{td.totalTokens}</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-500">{td.requests}</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-500">{td.estCost}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokenByModel.map((row, i) => {
                              const cost = estimateCost(row.model, Number(row.prompt_tokens), Number(row.completion_tokens));
                              return (
                              <tr key={i} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2 font-medium">{row.model}</td>
                                <td className="px-4 py-2 text-right">{formatNumber(Number(row.total_tokens))}</td>
                                <td className="px-4 py-2 text-right text-gray-500">{formatNumber(Number(row.request_count))}</td>
                                <td className="px-4 py-2 text-right font-medium text-red-600">{formatCost(cost)}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daily Usage (Last 30 Days) */}
                  {tokenByDate.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-medium text-gray-600">{td.last30Days}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left px-4 py-2 font-medium text-gray-500">{td.date}</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-500">{td.totalTokens}</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-500">{td.requests}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokenByDate.map((row) => (
                              <tr key={row.date} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2">{row.date}</td>
                                <td className="px-4 py-2 text-right">{formatNumber(Number(row.total_tokens))}</td>
                                <td className="px-4 py-2 text-right text-gray-500">{formatNumber(Number(row.request_count))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Subscriptions */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">{td.activeSubscriptions}</h2>
              {subscriptions.length === 0 ? (
                userPlan === "enterprise" || userPlan === "scale" || userPlan === "growth" ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-lg">
                        {userPlan === "enterprise" ? td.enterprisePlan : userPlan === "scale" ? td.scalePlan : td.growthPlan}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">active</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-2">
                      {userPlan === "enterprise" ? td.enterprisePlanDesc : td.managedBilling}
                    </p>
                    <p className="text-gray-400 text-xs">{td.managedBilling}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                    <p className="text-gray-500 mb-4">{td.noSubscriptions}</p>
                    <Link href={`/${locale}#pricing`} className="text-red-600 hover:underline text-sm font-medium">{td.viewPlans}</Link>
                  </div>
                )
              ) : (
                <div className="grid gap-4">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{sub.amount ? `${formatCurrency(sub.amount, "usd")}/${sub.interval}` : td.customPlan}</h3>
                          {statusBadge(sub.status)}
                        </div>
                        {sub.cancel_at_period_end && <span className="text-xs text-red-500 font-medium">{td.cancelsAtEnd}</span>}
                      </div>
                      <p className="text-sm text-gray-500">{td.currentPeriod} {formatDate(sub.current_period_start)} — {formatDate(sub.current_period_end)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Invoices */}
            <section>
              <h2 className="text-lg font-semibold mb-4">{td.invoices}</h2>
              {invoices.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500">{td.noInvoices}</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{td.invoice}</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{td.date}</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{td.amount}</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{td.status}</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">{td.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-medium">{inv.number || inv.id.slice(0, 16)}</p>
                              <p className="text-gray-400 text-xs">{inv.description}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(inv.created)}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(inv.amount_due, inv.currency)}</td>
                            <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              {inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">{td.view}</a>}
                              {inv.invoice_pdf && <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">{td.pdf}</a>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
