"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0/client";
import DashboardShell from "@/components/DashboardShell";
import { getDictionary, type Locale } from "@/lib/i18n";

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
  notes: string | null;
  tags: string[];
  logo_url: string | null;
  discount: string | null;
  created_at: string;
  updated_at: string;
}

const PARTNER_TYPES = ["supplier", "vendor", "distributor", "reseller", "partner", "other"] as const;
const STATUSES = ["active", "inactive", "pending"] as const;

export default function PartnersPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const t = dict.partnersPage;
  const tc = dict.common;

  const { user } = useUser();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<Partner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formType, setFormType] = useState("partner");
  const [formStatus, setFormStatus] = useState("active");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPartners(p = page) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("partner_type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(p));
    const res = await fetch(`/api/partners?${params}`);
    const data = await res.json();
    setPartners(data.partners || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setIsAdmin(data.isAdmin || false);
    setLoading(false);
  }

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => loadPartners(1), 300);
    return () => clearTimeout(timer);
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    loadPartners(page);
  }, [page]);

  function openForm(partner?: Partner) {
    if (partner) {
      setEditing(partner);
      setFormName(partner.name);
      setFormContactPerson(partner.contact_person || "");
      setFormEmail(partner.email || "");
      setFormPhone(partner.phone || "");
      setFormWebsite(partner.website || "");
      setFormAddress(partner.address || "");
      setFormType(partner.partner_type);
      setFormStatus(partner.status);
      setFormDescription(partner.description || "");
      setFormNotes(partner.notes || "");
      setFormLogoUrl(partner.logo_url || "");
      setFormDiscount(partner.discount || "");
    } else {
      setEditing(null);
      setFormName("");
      setFormContactPerson("");
      setFormEmail("");
      setFormPhone("");
      setFormWebsite("");
      setFormAddress("");
      setFormType("partner");
      setFormStatus("active");
      setFormDescription("");
      setFormNotes("");
      setFormLogoUrl("");
      setFormDiscount("");
    }
    setShowForm(true);
  }

  async function savePartner() {
    if (!formName.trim()) return;
    setSaving(true);
    await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editing ? "update" : "create",
        id: editing?.id,
        name: formName.trim(),
        contact_person: formContactPerson,
        email: formEmail,
        phone: formPhone,
        website: formWebsite,
        address: formAddress,
        partner_type: formType,
        status: formStatus,
        description: formDescription,
        notes: formNotes,
        logo_url: formLogoUrl,
        discount: formDiscount,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setMsg(t.saved);
    setTimeout(() => setMsg(""), 3000);
    loadPartners();
  }

  async function deletePartner(id: number) {
    if (!confirm(t.deleteConfirm)) return;
    await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setMsg(t.deleted);
    setTimeout(() => setMsg(""), 3000);
    loadPartners();
  }

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      supplier: t.typeSupplier,
      vendor: t.typeVendor,
      distributor: t.typeDistributor,
      reseller: t.typeReseller,
      partner: t.typePartner,
      other: t.typeOther,
    };
    return map[type] || type;
  };

  const typeBadgeColor = (type: string) => {
    const map: Record<string, string> = {
      supplier: "bg-blue-100 text-blue-700",
      vendor: "bg-purple-100 text-purple-700",
      distributor: "bg-orange-100 text-orange-700",
      reseller: "bg-green-100 text-green-700",
      partner: "bg-red-100 text-red-700",
      other: "bg-gray-100 text-gray-600",
    };
    return map[type] || "bg-gray-100 text-gray-600";
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: t.statusActive,
      inactive: t.statusInactive,
      pending: t.statusPending,
    };
    return map[s] || s;
  };

  const statusBadgeColor = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      inactive: "bg-gray-100 text-gray-500",
      pending: "bg-yellow-100 text-yellow-700",
    };
    return map[s] || "bg-gray-100 text-gray-600";
  };

  return (
    <DashboardShell user={user || {}}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => openForm()}
                className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                {t.addPartner}
              </button>
            </div>
          )}
        </div>

        {msg && (
          <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
            {msg}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">{t.allTypes}</option>
            {PARTNER_TYPES.map((pt) => (
              <option key={pt} value={pt}>{typeLabel(pt)}</option>
            ))}
          </select>
          {isAdmin && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">{t.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          )}
        </div>

        {/* Stats bar */}
        <div className="text-xs text-gray-400 mb-3">
          {t.total}: {total}
        </div>

        {/* Partners cards */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">{tc.loading}</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{t.noPartners}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((p) => (
              <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-bold shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(p.partner_type)}`}>
                        {typeLabel(p.partner_type)}
                      </span>
                      {isAdmin && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeColor(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      )}
                      {p.discount && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          {p.discount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>
                )}

                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {p.contact_person && <div>{t.contactPerson}: {p.contact_person}</div>}
                  {p.email && <div>{t.email}: <a href={`mailto:${p.email}`} className="text-red-600 hover:underline">{p.email}</a></div>}
                  {p.phone && <div>{t.phone}: {p.phone}</div>}
                  {p.address && <div>{t.address}: {p.address}</div>}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2 border-t border-gray-100">
                  {p.website && (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
                    >
                      {t.visit} &rarr;
                    </a>
                  )}
                  {isAdmin && (
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => openForm(p)} className="text-xs text-gray-500 hover:text-red-600 cursor-pointer">{t.editPartner}</button>
                      <button onClick={() => deletePartner(p.id)} className="text-xs text-gray-400 hover:text-red-600 cursor-pointer">{tc.delete}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              &larr;
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer ${
                    page === pageNum
                      ? "bg-red-700 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              &rarr;
            </button>
          </div>
        )}

        {/* Add/Edit modal (admin only) */}
        {showForm && isAdmin && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">{editing ? t.editPartner : t.addPartner}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.name} *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.description}</label>
                  <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.contactPerson}</label>
                    <input type="text" value={formContactPerson} onChange={(e) => setFormContactPerson(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.email}</label>
                    <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.phone}</label>
                    <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.website}</label>
                    <input type="url" value={formWebsite} onChange={(e) => setFormWebsite(e.target.value)} placeholder="https://" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.address}</label>
                  <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.logoUrl}</label>
                    <input type="url" value={formLogoUrl} onChange={(e) => setFormLogoUrl(e.target.value)} placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.discount}</label>
                    <input type="text" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} placeholder="e.g. 10% off" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.partnerType}</label>
                    <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                      {PARTNER_TYPES.map((pt) => (
                        <option key={pt} value={pt}>{typeLabel(pt)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.status}</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.notes}</label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">{tc.cancel}</button>
                <button onClick={savePartner} disabled={saving || !formName.trim()} className="bg-red-700 hover:bg-red-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                  {saving ? "..." : tc.save}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
