"use client";

import { usePathname } from "next/navigation";
import { type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  const switchTo = locale === "en" ? "zh" : "en";
  const label = locale === "en" ? "中文" : "EN";

  // Replace /en/... with /zh/... or vice versa
  const newPath = pathname.replace(`/${locale}`, `/${switchTo}`) || `/${switchTo}`;

  const handleSwitch = () => {
    document.cookie = `locale=${switchTo};path=/;max-age=31536000`;
    window.location.href = newPath;
  };

  return (
    <button
      onClick={handleSwitch}
      className="text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
    >
      {label}
    </button>
  );
}
