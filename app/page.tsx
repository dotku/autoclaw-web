"use client";

import { useState, useEffect } from "react";

const agents = [
  {
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
    title: "Email Marketing Agent",
    description:
      "Automated cold outreach, follow-up sequences, and newsletter campaigns via Brevo. Personalized at scale.",
  },
  {
    icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
    title: "SEO & Content Agent",
    description:
      "Blog post generation, keyword research, on-page optimization, and technical SEO audits. Multilingual support.",
  },
  {
    icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
    title: "Lead Prospecting Agent",
    description:
      "Finds qualified B2B leads from web research, imports to CRM, and enriches contact data automatically.",
  },
  {
    icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
    title: "Social Media Agent",
    description:
      "Automated X/Twitter posting with content rotation, LinkedIn engagement, and social listening.",
  },
  {
    icon: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z",
    title: "Product Manager Agent",
    description:
      "Monitors website health, tracks conversion funnels, manages feature backlogs, and creates GitHub issues.",
  },
  {
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    title: "Sales Follow-up Agent",
    description:
      "Tracks lead engagement, sends timed follow-ups, updates CRM status, and nurtures prospects to close.",
  },
];

const caseStudies = [
  {
    company: "Sienovo",
    industry: "Edge AI / Hardware",
    agents: 3,
    results: "B2B lead outreach, product marketing, website management",
    tag: "sienovo",
  },
  {
    company: "MedTravel China",
    industry: "Dental Tourism",
    agents: 5,
    results:
      "Cold email, clinic outreach, SEO content, X/Twitter, lead prospecting",
    tag: "medtravel",
  },
  {
    company: "GPULaw",
    industry: "Legal Tech",
    agents: 4,
    results: "Market research, product management, dev quality, CPO strategy",
    tag: "gpulaw",
  },
];

function SignupForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          company: formData.get("company"),
          website: formData.get("website"),
          agents: selectedAgents,
          goals: formData.get("goals"),
        }),
      });
      if (res.ok) {
        setStatus("success");
        form.reset();
        setSelectedAgents([]);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const toggleAgent = (agent: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  if (status === "success") {
    return (
      <div className="bg-white/10 backdrop-blur rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">&#10003;</div>
        <h3 className="text-xl font-bold text-white mb-2">You&apos;re registered!</h3>
        <p className="text-gray-300">We&apos;ll reach out shortly to set up your AI marketing agents.</p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-6 text-blue-400 hover:underline text-sm"
        >
          Register another product
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-8 text-left">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
            <input
              name="name"
              type="text"
              required
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              placeholder="you@company.com"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Product / Company Name</label>
          <input
            name="company"
            type="text"
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            placeholder="Your product or company"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Website URL</label>
          <input
            name="website"
            type="url"
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            placeholder="https://yourproduct.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">What agents do you need?</label>
          <div className="grid grid-cols-2 gap-2">
            {["Email Outreach", "SEO & Content", "Lead Generation", "Social Media", "Product Management", "Sales Follow-up"].map((agent) => (
              <label key={agent} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAgents.includes(agent)}
                  onChange={() => toggleAgent(agent)}
                  className="rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-400"
                />
                {agent}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Tell us about your marketing goals</label>
          <textarea
            name="goals"
            rows={3}
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            placeholder="What are you trying to achieve? Who is your target audience?"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white py-3 rounded-lg font-medium transition-colors text-lg"
        >
          {status === "loading" ? "Registering..." : "Register My Product"}
        </button>
        {status === "error" && (
          <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  );
}

const pricingPlans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Get started with AI marketing automation",
    features: [
      "2 AI marketing agents",
      "100 emails/month via Brevo",
      "1 product/project",
      "Community support",
      "Basic email templates",
    ],
    cta: "Get Started Free",
    highlight: false,
    plan: "starter",
  },
  {
    name: "Growth",
    price: "$49",
    period: "/month",
    description: "For growing businesses ready to scale",
    features: [
      "10 AI marketing agents",
      "2,000 emails/month via Brevo",
      "5 products/projects",
      "CRM integration (HubSpot, Twenty)",
      "SEO & content generation",
      "Social media automation",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlight: true,
    plan: "growth",
  },
  {
    name: "Scale",
    price: "$149",
    period: "/month",
    description: "Full automation for serious teams",
    features: [
      "Unlimited AI agents",
      "10,000 emails/month via Brevo",
      "Unlimited products/projects",
      "Custom agent development",
      "Multi-channel campaigns",
      "Advanced analytics & reporting",
      "Dedicated support",
      "White-label option",
    ],
    cta: "Get Started",
    highlight: false,
    plan: "scale",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored solutions for large organizations",
    features: [
      "Everything in Scale",
      "Dedicated infrastructure",
      "Custom AI agent training",
      "SLA & uptime guarantee",
      "SSO & advanced security",
      "On-premise deployment option",
      "Custom API integrations",
      "Dedicated account manager",
      "Volume email negotiation",
    ],
    cta: "Contact Sales",
    highlight: false,
    plan: "enterprise",
  },
];

export default function Home() {
  const [user, setUser] = useState<{ name?: string; picture?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch("/auth/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.email || data?.name) setUser(data); })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">Auto</span>Claw
            </span>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a
                href="#agents"
                className="hover:text-primary transition-colors"
              >
                Agents
              </a>
              <a
                href="#how-it-works"
                className="hover:text-primary transition-colors"
              >
                How It Works
              </a>
              <a
                href="#cases"
                className="hover:text-primary transition-colors"
              >
                Case Studies
              </a>
              <a
                href="#pricing"
                className="hover:text-primary transition-colors"
              >
                Pricing
              </a>
              <a
                href="/dashboard"
                className="hover:text-primary transition-colors"
              >
                Dashboard
              </a>
              {user ? (
                <div className="flex items-center gap-3">
                  <a href="/dashboard" className="flex items-center gap-2">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || "User"}
                        className="w-8 h-8 rounded-full border-2 border-blue-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                        {(user.name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-700 max-w-[100px] truncate">{user.name || user.email}</span>
                  </a>
                  <a
                    href="/auth/logout"
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Logout
                  </a>
                </div>
              ) : (
                <a
                  href="/auth/login"
                  className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Get Started
                </a>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
            <p className="text-blue-400 font-semibold text-sm uppercase tracking-wider mb-4">
              AI-Powered Marketing Automation
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 max-w-4xl mx-auto">
              Your Marketing Team,{" "}
              <span className="text-blue-400">Powered by AI</span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Deploy autonomous AI agents that handle email outreach, content
              creation, lead generation, SEO, and social media — 24/7. No
              marketing team required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/auth/login"
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors"
              >
                Start Free
              </a>
              <a
                href="#how-it-works"
                className="border border-gray-500 hover:border-white text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors"
              >
                See How It Works
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 pt-12 border-t border-gray-700 max-w-3xl mx-auto">
              {[
                { value: "30+", label: "Pre-built Agent Skills" },
                { value: "24/7", label: "Autonomous Operation" },
                { value: "10K+", label: "Emails/Month Capacity" },
                { value: "3", label: "Live Client Products" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Agents */}
        <section id="agents" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                AI Agents That Work For You
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Each agent is a specialist. Combine them to build a complete
                marketing machine for your product or business.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {agents.map((agent) => (
                <div
                  key={agent.title}
                  className="p-6 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={agent.icon}
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{agent.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Go from zero to a fully automated marketing operation in
                minutes.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: "1",
                  title: "Describe Your Product",
                  description:
                    "Tell us about your product, target audience, and marketing goals. We create custom agent configurations.",
                },
                {
                  step: "2",
                  title: "Activate Your Agents",
                  description:
                    "Choose which agents to deploy — email outreach, SEO content, social media, lead gen. Mix and match.",
                },
                {
                  step: "3",
                  title: "Agents Work 24/7",
                  description:
                    "Your AI agents run autonomously on schedule. They prospect leads, send emails, write content, and report results.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Tech stack */}
            <div className="mt-16 bg-white rounded-xl p-8 border border-gray-100 max-w-3xl mx-auto">
              <p className="text-center text-sm font-medium text-gray-400 mb-4">
                POWERED BY
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  "Claude AI",
                  "Brevo Email",
                  "HubSpot CRM",
                  "GitHub",
                  "X / Twitter",
                  "Docker",
                ].map((tech) => (
                  <span
                    key={tech}
                    className="bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-100"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section id="cases" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Already Running For Real Products
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                These businesses use our AI agents to run their marketing
                operations autonomously.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {caseStudies.map((cs) => (
                <div
                  key={cs.company}
                  className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                    <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">
                      {cs.industry}
                    </p>
                    <h3 className="text-2xl font-bold">{cs.company}</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-blue-50 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                        {cs.agents} AI Agents
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {cs.results}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Start free. Scale when you&apos;re ready. No contracts, cancel
                anytime.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl p-8 ${
                    plan.highlight
                      ? "bg-primary text-white ring-4 ring-blue-200 scale-105"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <h3
                    className={`text-lg font-semibold mb-1 ${plan.highlight ? "text-blue-100" : "text-gray-500"}`}
                  >
                    {plan.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span
                        className={`text-sm ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm mb-6 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}
                  >
                    {plan.description}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <svg
                          className={`w-5 h-5 shrink-0 mt-0.5 ${plan.highlight ? "text-blue-200" : "text-green-500"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={async () => {
                      if (plan.plan === "enterprise") {
                        window.location.href = "mailto:jay.lin@jytech.us?subject=AutoClaw Enterprise Plan Inquiry";
                      } else if (plan.plan === "starter") {
                        window.location.href = "/auth/login";
                      } else {
                        try {
                          const res = await fetch("/api/checkout", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ plan: plan.plan }),
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        } catch {
                          window.location.href = "/auth/login";
                        }
                      }
                    }}
                    className={`block w-full text-center py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      plan.highlight
                        ? "bg-white text-primary hover:bg-blue-50"
                        : "bg-primary text-white hover:bg-primary-dark"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section
          id="signup"
          className="py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white"
        >
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Launch Your AI Marketing Team
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Register your product, and we&apos;ll set up your custom AI
              marketing agents. Start with the free tier — no credit card
              required.
            </p>
            <SignupForm />
            <p className="text-gray-400 text-sm mt-6">
              Questions? Email us at{" "}
              <a
                href="mailto:jay.lin@jytech.us"
                className="text-blue-400 hover:underline"
              >
                jay.lin@jytech.us
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-400 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <p className="text-xl font-bold text-white mb-2">
                <span className="text-blue-400">Auto</span>Claw
              </p>
              <p className="text-sm leading-relaxed">
                AI-powered marketing automation by AutoClaw. Deploy autonomous
                agents that handle your entire marketing operation.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white mb-3 text-sm">Platform</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#agents"
                    className="hover:text-white transition-colors"
                  >
                    AI Agents
                  </a>
                </li>
                <li>
                  <a
                    href="#cases"
                    className="hover:text-white transition-colors"
                  >
                    Case Studies
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-white transition-colors"
                  >
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-3 text-sm">Contact</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:jay.lin@jytech.us"
                    className="hover:text-white transition-colors"
                  >
                    jay.lin@jytech.us
                  </a>
                </li>
                <li>
                  <a
                    href="https://jytech.us"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    jytech.us
                  </a>
                </li>
                <li>
                  <a
                    href="https://xpilot.jytech.us/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    xPilot — AI Social Media Copilot
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-xs">
            <p>
              &copy; {new Date().getFullYear()} AutoClaw. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
