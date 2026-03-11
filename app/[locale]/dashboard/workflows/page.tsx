"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

type Tab = "templates" | "my";

interface WorkflowStep {
  type: "trigger" | "action" | "condition" | "end";
  labelKey: string;
}

interface WorkflowTemplate {
  key: string;
  steps: WorkflowStep[];
  runs: number;
  status: "active" | "draft" | "paused";
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    key: "tmplColdOutreach",
    steps: [
      { type: "trigger", labelKey: "triggerNewLead" },
      { type: "action", labelKey: "actionEnrichLead" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "condition", labelKey: "ifLabel" },
      { type: "action", labelKey: "actionNotify" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
  {
    key: "tmplContentPromo",
    steps: [
      { type: "trigger", labelKey: "triggerWebhook" },
      { type: "action", labelKey: "actionRunAgent" },
      { type: "action", labelKey: "actionPostSocial" },
      { type: "action", labelKey: "actionPostSocial" },
      { type: "action", labelKey: "actionRunAgent" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
  {
    key: "tmplLeadNurture",
    steps: [
      { type: "trigger", labelKey: "triggerFormSubmit" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionAddToCrm" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
  {
    key: "tmplReEngagement",
    steps: [
      { type: "trigger", labelKey: "triggerSchedule" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "condition", labelKey: "ifLabel" },
      { type: "action", labelKey: "actionNotify" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
  {
    key: "tmplWebinarFunnel",
    steps: [
      { type: "trigger", labelKey: "triggerFormSubmit" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
  {
    key: "tmplReviewRequest",
    steps: [
      { type: "trigger", labelKey: "triggerWebhook" },
      { type: "action", labelKey: "actionWait" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "condition", labelKey: "ifLabel" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "action", labelKey: "actionSendEmail" },
      { type: "end", labelKey: "endLabel" },
    ],
    runs: 0,
    status: "draft",
  },
];

const STEP_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  trigger: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  action: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-400" },
  condition: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  end: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500" },
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-500",
  paused: "bg-yellow-100 text-yellow-700",
};

export default function WorkflowsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const tw = dict.workflowsPage;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [tab, setTab] = useState<Tab>("templates");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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
          <h1 className="text-2xl font-bold mb-4">{tw.title}</h1>
          <a href={`/auth/login?returnTo=/${locale}/dashboard/workflows`} className="bg-red-800 hover:bg-red-900 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      <div className="px-4 sm:px-6 py-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{tw.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{tw.subtitle}</p>
          </div>
          <button className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
            + {tw.createWorkflow}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setTab("templates")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === "templates" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tw.templates}
          </button>
          <button
            onClick={() => setTab("my")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === "my" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tw.myWorkflows}
          </button>
        </div>

        {tab === "my" ? (
          /* My Workflows - empty state */
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">{tw.noWorkflows}</h3>
            <p className="text-sm text-gray-500 mb-4">{tw.noWorkflowsDesc}</p>
            <div className="flex gap-3 justify-center">
              <button className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                {tw.fromScratch}
              </button>
              <button
                onClick={() => setTab("templates")}
                className="border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                {tw.useTemplate}
              </button>
            </div>
          </div>
        ) : (
          /* Templates grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {TEMPLATES.map((tmpl) => {
              const name = tw[tmpl.key as keyof typeof tw] as string;
              const desc = tw[`${tmpl.key}Desc` as keyof typeof tw] as string;
              const isExpanded = expandedCard === tmpl.key;

              return (
                <div
                  key={tmpl.key}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[tmpl.status]}`}>
                        {tw[tmpl.status as keyof typeof tw] as string}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{desc}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{tmpl.steps.length} {tw.steps}</span>
                      </div>
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : tmpl.key)}
                        className="text-xs text-red-700 hover:text-red-900 font-medium cursor-pointer"
                      >
                        {isExpanded ? "▲" : "▼"} {tw.steps}
                      </button>
                    </div>
                  </div>

                  {/* Expanded step view */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <div className="relative">
                        {tmpl.steps.map((step, i) => {
                          const style = STEP_STYLES[step.type];
                          const label = tw[step.labelKey as keyof typeof tw] as string;
                          const isLast = i === tmpl.steps.length - 1;

                          return (
                            <div key={i} className="flex items-start gap-3 relative">
                              {/* Vertical line */}
                              <div className="flex flex-col items-center">
                                <div className={`w-3 h-3 rounded-full ${style.dot} shrink-0 mt-1.5 z-10`} />
                                {!isLast && <div className="w-0.5 h-full bg-gray-200 absolute top-4 left-1.5" />}
                              </div>
                              {/* Step card */}
                              <div className={`flex-1 mb-2 px-3 py-2 rounded-md border text-xs font-medium ${style.bg} ${style.border} ${style.text}`}>
                                <span className="uppercase text-[10px] opacity-60 mr-1.5">
                                  {step.type === "trigger" ? tw.triggerLabel :
                                   step.type === "condition" ? tw.ifLabel :
                                   step.type === "end" ? tw.endLabel : tw.thenLabel}
                                </span>
                                {label}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button className="mt-3 w-full bg-red-800 hover:bg-red-900 text-white py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                        {tw.useTemplate}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
