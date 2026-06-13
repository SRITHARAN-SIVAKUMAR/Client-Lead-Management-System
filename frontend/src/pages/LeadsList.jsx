import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import api from "@/lib/api";
import AdminHeader from "@/components/AdminHeader";
import { StatusPill, STATUS_META } from "@/components/StatusPill";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
];

export default function LeadsList() {
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/sources").then((r) => setSources(r.data.sources || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (status !== "all") params.status = status;
    if (source !== "all") params.source = source;
    if (q.trim()) params.q = q.trim();
    api
      .get("/leads", { params })
      .then((r) => setLeads(r.data || []))
      .finally(() => setLoading(false));
  }, [status, source, q]);

  const grouped = useMemo(() => leads, [leads]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]" data-testid="leads-page">
      <AdminHeader />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-eyebrow text-[#002FA7]">· All leads</span>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tighter font-black mt-2">
              {leads.length} {leads.length === 1 ? "lead" : "leads"}
            </h1>
          </div>
        </div>

        {/* Filters */}
        <section className="mt-8 bg-white border border-black/10 p-5 grid md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            />
            <input
              data-testid="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, phone…"
              className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all text-sm"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <FunnelSimple size={16} weight="bold" className="text-neutral-400" />
            <select
              data-testid="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  Status · {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              data-testid="filter-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none text-sm"
            >
              <option value="all">Source · All</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  Source · {s}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="mt-6 border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm" data-testid="leads-table">
            <thead className="bg-neutral-50 border-b border-black/10">
              <tr>
                {["Name", "Email", "Phone", "Source", "Status", "Follow-up", "Created", ""].map((h) => (
                  <th
                    key={h}
                    className="label-eyebrow text-neutral-500 text-left px-5 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && grouped.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-neutral-500">
                    No leads match your filters.
                  </td>
                </tr>
              )}
              {grouped.map((lead) => (
                <tr
                  key={lead.id}
                  data-testid={`lead-row-${lead.id}`}
                  className="border-b border-black/5 last:border-0 hover:bg-neutral-50/60 transition-colors"
                >
                  <td className="px-5 py-4 font-medium whitespace-nowrap">{lead.name}</td>
                  <td className="px-5 py-4 text-neutral-600 whitespace-nowrap">{lead.email}</td>
                  <td className="px-5 py-4 text-neutral-600 whitespace-nowrap">{lead.phone || "—"}</td>
                  <td className="px-5 py-4 text-neutral-600 whitespace-nowrap">{lead.source}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><StatusPill status={lead.status} /></td>
                  <td className="px-5 py-4 text-neutral-600 font-mono-ibm text-xs whitespace-nowrap">
                    {lead.follow_up_at || "—"}
                  </td>
                  <td className="px-5 py-4 text-neutral-500 font-mono-ibm text-xs whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <Link
                      to={`/admin/leads/${lead.id}`}
                      className="text-[#002FA7] hover:underline font-medium"
                      data-testid={`open-lead-${lead.id}`}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className="inline-flex items-center gap-2">
              <span
                className="w-2 h-2"
                style={{ background: meta.color }}
              />
              {meta.label}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
