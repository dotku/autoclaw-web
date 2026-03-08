import Link from "next/link";
import { getDictionary, isValidLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Changelog – AutoClaw",
};

interface ChangelogEntry {
  date: string;
  version: string;
  title: Record<string, string>;
  items: Record<string, string[]>;
}

const changelog: ChangelogEntry[] = [
  {
    date: "2026-03-07",
    version: "1.3.0",
    title: {
      en: "Real-time Sync & Privacy Compliance",
      zh: "实时同步与隐私合规",
      "zh-TW": "即時同步與隱私合規",
      fr: "Synchronisation en temps réel et conformité",
    },
    items: {
      en: [
        "Real-time notifications — When you create a project or activate an AI agent, your automation pipeline starts immediately. No more waiting.",
        "Automatic retry — A background sync runs every 10 minutes to ensure no task is ever missed, even during network hiccups.",
        "Privacy Policy — A dedicated privacy policy page is now available in all supported languages, as part of our SOC 2 compliance efforts.",
        "Unified Team & Organization — The team management and organization settings have been combined into a single, cleaner interface.",
      ],
      zh: [
        "实时通知 — 创建项目或激活 AI 智能体后，自动化流程立即启动，无需等待。",
        "自动重试 — 后台每 10 分钟同步一次，确保即使网络波动也不会遗漏任何任务。",
        "隐私政策 — 新增多语言隐私政策页面，作为 SOC 2 合规工作的一部分。",
        "统一团队与组织 — 团队管理和组织设置合并为更简洁的界面。",
      ],
      "zh-TW": [
        "即時通知 — 建立專案或啟用 AI 智能體後，自動化流程立即啟動，無需等待。",
        "自動重試 — 背景每 10 分鐘同步一次，確保即使網路波動也不會遺漏任何任務。",
        "隱私權政策 — 新增多語言隱私權政策頁面，作為 SOC 2 合規工作的一部分。",
        "統一團隊與組織 — 團隊管理和組織設定合併為更簡潔的介面。",
      ],
      fr: [
        "Notifications en temps réel — Lorsque vous créez un projet ou activez un agent IA, votre pipeline d'automatisation démarre immédiatement.",
        "Synchronisation automatique — Une synchronisation en arrière-plan s'exécute toutes les 10 minutes pour garantir qu'aucune tâche n'est manquée.",
        "Politique de confidentialité — Une page dédiée est désormais disponible dans toutes les langues, dans le cadre de notre conformité SOC 2.",
        "Équipe et organisation unifiées — La gestion d'équipe et les paramètres d'organisation ont été regroupés dans une interface simplifiée.",
      ],
    },
  },
  {
    date: "2026-03-05",
    version: "1.2.0",
    title: {
      en: "Analytics & Reporting",
      zh: "数据分析与报告",
      "zh-TW": "數據分析與報告",
      fr: "Analytique et rapports",
    },
    items: {
      en: [
        "Google Analytics integration — Connect your GA4 property to see real-time traffic data per project directly in your dashboard.",
        "Agent Reports tab — View detailed performance summaries from each AI agent, including tasks completed and key metrics.",
        "Mobile-optimized dashboard — Navigation and layout improvements for a better experience on phones and tablets.",
      ],
      zh: [
        "Google Analytics 集成 — 连接 GA4 媒体资源，在面板中直接查看每个项目的实时流量数据。",
        "智能体报告 — 查看每个 AI 智能体的详细绩效摘要，包括完成的任务和关键指标。",
        "移动端优化 — 仪表板导航和布局改进，在手机和平板上体验更佳。",
      ],
      "zh-TW": [
        "Google Analytics 整合 — 連接 GA4 媒體資源，在面板中直接檢視每個專案的即時流量資料。",
        "智能體報告 — 檢視每個 AI 智能體的詳細績效摘要，包括完成的任務和關鍵指標。",
        "行動裝置最佳化 — 儀表板導航和版面改進，在手機和平板上體驗更佳。",
      ],
      fr: [
        "Intégration Google Analytics — Connectez votre propriété GA4 pour voir les données de trafic en temps réel par projet.",
        "Rapports d'agents — Consultez les résumés de performance détaillés de chaque agent IA.",
        "Tableau de bord mobile — Navigation et mise en page améliorées pour une meilleure expérience sur téléphone et tablette.",
      ],
    },
  },
  {
    date: "2026-03-01",
    version: "1.1.0",
    title: {
      en: "Multi-language Support & Billing",
      zh: "多语言支持与账单管理",
      "zh-TW": "多語言支援與帳單管理",
      fr: "Support multilingue et facturation",
    },
    items: {
      en: [
        "4-language support — AutoClaw is now available in English, Simplified Chinese, Traditional Chinese, and French.",
        "Standalone billing page — Manage your subscription, view invoices, and update payment methods in one place.",
        "Settings page — Personalized dashboard settings with project management and team collaboration.",
      ],
      zh: [
        "四语言支持 — AutoClaw 现已支持英语、简体中文、繁体中文和法语。",
        "独立账单页面 — 在一个页面中管理订阅、查看发票和更新支付方式。",
        "设置页面 — 包含项目管理和团队协作的个性化面板设置。",
      ],
      "zh-TW": [
        "四語言支援 — AutoClaw 現已支援英語、簡體中文、繁體中文和法語。",
        "獨立帳單頁面 — 在一個頁面中管理訂閱、檢視發票和更新付款方式。",
        "設定頁面 — 包含專案管理和團隊協作的個人化面板設定。",
      ],
      fr: [
        "Support 4 langues — AutoClaw est maintenant disponible en anglais, chinois simplifié, chinois traditionnel et français.",
        "Page de facturation — Gérez votre abonnement, consultez vos factures et mettez à jour vos moyens de paiement.",
        "Page de paramètres — Paramètres personnalisés avec gestion de projets et collaboration d'équipe.",
      ],
    },
  },
  {
    date: "2026-02-20",
    version: "1.0.0",
    title: {
      en: "AutoClaw Launch",
      zh: "AutoClaw 正式上线",
      "zh-TW": "AutoClaw 正式上線",
      fr: "Lancement d'AutoClaw",
    },
    items: {
      en: [
        "6 AI Agents — Email marketing, SEO optimization, lead generation, social media, project management, and sales outreach.",
        "One-click activation — Select the agents you need, configure them for your project, and let them work autonomously.",
        "Dashboard — A central hub to manage all your projects, monitor agent activity, and communicate with your AI team.",
        "3 pricing tiers — Free starter plan, Growth at $49/mo, and Scale at $149/mo.",
      ],
      zh: [
        "6 大 AI 智能体 — 邮件营销、SEO 优化、潜客开发、社交媒体、项目管理和销售拓展。",
        "一键激活 — 选择所需智能体，为项目配置后即可自主运行。",
        "管理面板 — 集中管理所有项目、监控智能体活动并与 AI 团队沟通。",
        "3 档定价 — 免费入门版、Growth $49/月、Scale $149/月。",
      ],
      "zh-TW": [
        "6 大 AI 智能體 — 郵件行銷、SEO 最佳化、潛客開發、社群媒體、專案管理和銷售拓展。",
        "一鍵啟用 — 選擇所需智能體，為專案設定後即可自主運行。",
        "管理面板 — 集中管理所有專案、監控智能體活動並與 AI 團隊溝通。",
        "3 檔定價 — 免費入門版、Growth $49/月、Scale $149/月。",
      ],
      fr: [
        "6 agents IA — Marketing par email, optimisation SEO, génération de leads, réseaux sociaux, gestion de projet et prospection commerciale.",
        "Activation en un clic — Sélectionnez les agents nécessaires, configurez-les et laissez-les travailler de manière autonome.",
        "Tableau de bord — Un hub central pour gérer vos projets, surveiller l'activité des agents et communiquer avec votre équipe IA.",
        "3 niveaux de tarification — Plan gratuit, Growth à 49 $/mois et Scale à 149 $/mois.",
      ],
    },
  },
];

const labels: Record<string, { title: string; backHome: string }> = {
  en: { title: "Changelog", backHome: "Back to Home" },
  zh: { title: "更新日志", backHome: "返回首页" },
  "zh-TW": { title: "更新日誌", backHome: "返回首頁" },
  fr: { title: "Journal des mises à jour", backHome: "Retour à l'accueil" },
};

export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  getDictionary(locale); // validate locale
  const l = labels[locale] || labels.en;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-xl font-bold">
            <span className="text-red-500">Auto</span>Claw
          </Link>
          <Link
            href={`/${locale}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; {l.backHome}
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">{l.title}</h1>

        <div className="space-y-12">
          {changelog.map((entry) => (
            <article key={entry.version} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  v{entry.version}
                </span>
                <time className="text-sm text-gray-400">{entry.date}</time>
              </div>
              <h2 className="text-xl font-semibold mb-4">
                {entry.title[locale] || entry.title.en}
              </h2>
              <ul className="space-y-3">
                {(entry.items[locale] || entry.items.en).map((item, i) => (
                  <li key={i} className="flex gap-3 text-gray-700 leading-relaxed">
                    <span className="text-red-400 mt-1 shrink-0">&#9679;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-gray-400 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} AutoClaw. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
