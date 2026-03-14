"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Partner {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  partner_type: string;
  status: string;
  description: string | null;
  logo_url: string | null;
  discount: string | null;
}

const PARTNER_TYPES = ["supplier", "vendor", "distributor", "reseller", "partner", "other"] as const;

export default function PartnersPublicPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const t = dict.partnersPublicPage;
  const tp = dict.partnersPage;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams();
    if (typeFilter) qs.set("partner_type", typeFilter);
    qs.set("status", "active");
    fetch(`/api/partners?${qs}`)
      .then((res) => res.json())
      .then((data) => {
        setPartners(data.partners || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [typeFilter]);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      supplier: tp.typeSupplier,
      vendor: tp.typeVendor,
      distributor: tp.typeDistributor,
      reseller: tp.typeReseller,
      partner: tp.typePartner,
      other: tp.typeOther,
    };
    return map[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <img src="/logo.svg" alt="AutoClaw" className="h-8 w-8" />
            <span className="font-bold text-lg">AutoClaw</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher locale={locale} />
            <Link
              href={`/${locale}`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {t.backHome}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          {t.title}
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          {t.subtitle}
        </p>
      </section>

      {/* Filter */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setTypeFilter("")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              !typeFilter
                ? "bg-red-700 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {t.allPartners}
          </button>
          {PARTNER_TYPES.map((pt) => (
            <button
              key={pt}
              onClick={() => setTypeFilter(pt)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                typeFilter === pt
                  ? "bg-red-700 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {typeLabel(pt)}
            </button>
          ))}
        </div>
      </div>

      {/* Partners Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-20 text-gray-500">{t.noPartners}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((p) => (
              <div
                key={p.id}
                className="group bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:border-red-500/40 hover:bg-white/[0.08] transition-all flex flex-col"
              >
                {/* Logo + Name */}
                <div className="flex items-center gap-4 mb-4">
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt={p.name}
                      className="w-14 h-14 rounded-xl object-cover bg-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold text-gray-500 shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg truncate">{p.name}</h3>
                    <span className="text-xs text-gray-400">{typeLabel(p.partner_type)}</span>
                  </div>
                </div>

                {/* Discount badge */}
                {p.discount && (
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-sm font-medium px-3 py-1.5 rounded-lg border border-amber-500/30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                      </svg>
                      {t.exclusiveDeal}: {p.discount}
                    </span>
                  </div>
                )}

                {/* Description */}
                {p.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-3 flex-1">{p.description}</p>
                )}

                {/* Contact info */}
                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  {p.contact_person && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                      {p.contact_person}
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6-9.75-6" /></svg>
                      <a href={`mailto:${p.email}`} className="text-red-400 hover:underline">{p.email}</a>
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                      {p.phone}
                    </div>
                  )}
                </div>

                {/* CTA */}
                {p.website && (
                  <div className="mt-auto pt-4 border-t border-white/10">
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                    >
                      {t.visitWebsite}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} AutoClaw. All rights reserved.
      </footer>
    </div>
  );
}
