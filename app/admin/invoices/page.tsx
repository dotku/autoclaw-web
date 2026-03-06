"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface InvoiceLine {
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  customer_email: string | null;
  customer_name: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  due_date: number | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  lines: InvoiceLine[];
}

interface LineItem {
  description: string;
  amount: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: string | null) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    open: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    void: "bg-red-100 text-red-700",
    uncollectible: "bg-red-100 text-red-700",
  };
  const s = status || "unknown";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}
    >
      {s}
    </span>
  );
}

export default function AdminInvoicesPage() {
  const { user, isLoading: userLoading } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form state
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dueDays, setDueDays] = useState("14");
  const [memo, setMemo] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", amount: "" },
  ]);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/invoices")
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user, fetchInvoices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const items = lineItems
      .filter((li) => li.description && li.amount)
      .map((li) => ({
        description: li.description,
        amount: parseFloat(li.amount),
      }));

    await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_email: customerEmail,
        customer_name: customerName,
        items,
        due_days: parseInt(dueDays),
        memo,
      }),
    });

    setCreating(false);
    setShowCreate(false);
    setCustomerEmail("");
    setCustomerName("");
    setMemo("");
    setLineItems([{ description: "", amount: "" }]);
    fetchInvoices();
  }

  async function handleAction(invoiceId: string, action: string) {
    setActionLoading(invoiceId);
    await fetch(`/api/admin/invoices/${invoiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionLoading(null);
    fetchInvoices();
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
          <a
            href="/auth/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Log In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold tracking-tight">
              <span className="text-blue-600">Auto</span>Claw
            </Link>
            <span className="text-sm text-gray-400">/ Admin / Invoices</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Dashboard
            </Link>
            <a
              href="/auth/logout"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Log Out
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Invoice Management</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {showCreate ? "Cancel" : "Create Invoice"}
          </button>
        </div>

        {/* Create Invoice Form */}
        {showCreate && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">New Invoice</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client / Company Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company Name"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Due (days)
                  </label>
                  <input
                    type="number"
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Memo / Notes
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Thank you for choosing JYTech.us"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Line Items
                </label>
                {lineItems.map((item, i) => (
                  <div key={i} className="flex gap-3 mb-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i].description = e.target.value;
                        setLineItems(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Description (e.g. AI Marketing System Setup)"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i].amount = e.target.value;
                        setLineItems(updated);
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Amount ($)"
                    />
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLineItems(lineItems.filter((_, j) => j !== i))
                        }
                        className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setLineItems([...lineItems, { description: "", amount: "" }])
                  }
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer"
                >
                  + Add Line Item
                </button>
              </div>

              {/* Total preview */}
              {lineItems.some((li) => li.amount) && (
                <div className="text-right text-sm text-gray-600">
                  Total:{" "}
                  <span className="font-semibold text-gray-900">
                    $
                    {lineItems
                      .reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                {creating ? "Creating..." : "Create Draft Invoice"}
              </button>
            </form>
          </div>
        )}

        {/* Invoice List */}
        {loading ? (
          <p className="text-gray-500">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No invoices yet. Create your first one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Invoice
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Client
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {inv.number || inv.id.slice(0, 20)}
                        </p>
                        {inv.description && (
                          <p className="text-gray-400 text-xs">{inv.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">
                          {inv.customer_name || "—"}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {inv.customer_email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(inv.created)}
                        {inv.due_date && (
                          <p className="text-gray-400 text-xs">
                            Due: {formatDate(inv.due_date)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(inv.amount_due)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === "draft" && (
                            <>
                              <button
                                onClick={() => handleAction(inv.id, "finalize")}
                                disabled={actionLoading === inv.id}
                                className="text-blue-600 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                Finalize
                              </button>
                              <button
                                onClick={() => handleAction(inv.id, "void")}
                                disabled={actionLoading === inv.id}
                                className="text-red-500 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                Void
                              </button>
                            </>
                          )}
                          {inv.status === "open" && (
                            <>
                              <button
                                onClick={() => handleAction(inv.id, "send")}
                                disabled={actionLoading === inv.id}
                                className="text-blue-600 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                Send
                              </button>
                              <button
                                onClick={() => handleAction(inv.id, "void")}
                                disabled={actionLoading === inv.id}
                                className="text-red-500 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                Void
                              </button>
                            </>
                          )}
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View
                            </a>
                          )}
                          {inv.invoice_pdf && (
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
