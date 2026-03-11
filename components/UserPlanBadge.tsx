"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

const PLAN_COLORS: Record<string, string> = {
  S: "bg-gray-200 text-gray-700",
  G: "bg-emerald-100 text-emerald-700",
  P: "bg-purple-100 text-purple-700",
  E: "bg-amber-100 text-amber-700",
};

export default function UserPlanBadge({ plan }: { plan?: string }) {
  const { user } = useUser();
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (plan || !user) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => { if (d.plan) setFetched(d.plan); })
      .catch(() => {});
  }, [plan, user]);

  const display = plan || fetched;
  if (!display) return null;

  const letter = display.charAt(0).toUpperCase();
  const color = PLAN_COLORS[letter] || PLAN_COLORS.S;

  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${color}`} title={display}>
      {letter}
    </span>
  );
}
