import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarBlank, TrendUp, UserPlus, CheckCircle } from "@phosphor-icons/react";
import api from "@/lib/api";
import AdminHeader from "@/components/AdminHeader";
import { StatusPill, STATUS_META } from "@/components/StatusPill";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l] = await Promise.all([api.get("/leads/stats"), api.get("/leads")]);
        setStats(s.data);
        setRecent((l.data || []).slice(0, 6));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    { key: "total", label: "Total leads", value: stats?.total ?? 0, icon: TrendUp, accent: "#030712" },
    { key: "new", label: "New", value: stats?.counts.new ?? 0, icon: UserPlus, accent: STATUS_META.new.color },
    { key: "contacted", label: "Contacted", value: stats?.counts.contacted ?? 0, icon: ArrowUpRight, accent: STATUS_META.contacted.color },
    { key: "converted", label: "Converted", value: stats?.counts.converted ?? 0, icon: CheckCircle, accent: STATUS_META.converted.color },
  ];

  const conversion =
    stats && stats.total > 0
      ? Math.round((stats.counts.converted / stats.total) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#F9FAFB]" data-testid="dashboard-page">
      <AdminHeader />

      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-eyebrow text-[#002FA7]">· Overview</span>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tighter font-black mt-2">
              Lead pipeline at a glance
            </h1>
          </div>
          <Link
            to="/admin/leads"
            data-testid="cta-all-leads"
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            All leads
            <ArrowUpRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Stat cards */}
        <section className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10">
          {cards.map((c) => (
            <div
              key={c.key}
              data-testid={`stat-${c.key}`}
              className="bg-white p-6 lg:p-8 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <span className="label-eyebrow text-neutral-500">{c.label}</span>
                <c.icon size={18} weight="bold" style={{ color: c.accent }} />
              </div>
              <div
                className="font-display font-black tracking-tighter text-5xl"
                style={{ color: c.accent }}
              >
                {loading ? "—" : c.value}
              </div>
            </div>
          ))}
        </section>

        {/* Two-column secondary */}
        <section className="mt-10 grid lg:grid-cols-12 gap-6">
          <div
            data-testid="conversion-card"
            className="lg:col-span-4 bg-white border border-black/10 p-8 flex flex-col gap-6"
          >
            <span className="label-eyebrow text-neutral-500">Conversion rate</span>
            <div className="font-display text-6xl font-black tracking-tighter">
              {conversion}<span className="text-2xl text-neutral-400">%</span>
            </div>
            <div className="h-2 bg-neutral-100 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#10B981] transition-all duration-700"
                style={{ width: `${Math.min(conversion, 100)}%` }}
              />
            </div>
            <p className="text-sm text-neutral-600">
              {stats?.counts.converted ?? 0} of {stats?.total ?? 0} leads have been converted.
            </p>
          </div>

          <div
            data-testid="follow-up-card"
            className="lg:col-span-4 bg-white border border-black/10 p-8 flex flex-col gap-6"
          >
            <span className="label-eyebrow text-neutral-500">Upcoming follow-ups</span>
            <div className="font-display text-6xl font-black tracking-tighter flex items-center gap-3">
              {stats?.upcoming_follow_ups ?? 0}
              <CalendarBlank size={32} weight="bold" className="text-[#002FA7]" />
            </div>
            <p className="text-sm text-neutral-600">
              Leads with a follow-up scheduled in the next 7 days.
            </p>
          </div>

          <div
            data-testid="by-source-card"
            className="lg:col-span-4 bg-white border border-black/10 p-8 flex flex-col gap-4"
          >
            <span className="label-eyebrow text-neutral-500">Leads by source</span>
            {stats?.by_source?.length ? (
              stats.by_source.map((s) => {
                const pct = stats.total ? (s.count / stats.total) * 100 : 0;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700">{s.source}</span>
                      <span className="font-mono-ibm text-xs text-neutral-500">{s.count}</span>
                    </div>
                    <div className="h-1.5 mt-1.5 bg-neutral-100">
                      <div
                        className="h-full bg-[#002FA7]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-neutral-500">No leads yet.</p>
            )}
          </div>
        </section>

        {/* Recent leads */}
        <section className="mt-12">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">Recent leads</h2>
            <Link
              to="/admin/leads"
              className="label-eyebrow text-neutral-500 hover:text-[#002FA7] transition-colors"
              data-testid="recent-view-all"
            >
              View all →
            </Link>
          </div>
          <div className="border border-black/10 bg-white overflow-hidden">
            <table className="w-full text-sm" data-testid="recent-leads-table">
              <thead className="bg-neutral-50 border-b border-black/10">
                <tr>
                  {["Name", "Email", "Source", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="label-eyebrow text-neutral-500 text-left px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">
                      No leads yet. Submit one via the public contact form.
                    </td>
                  </tr>
                )}
                {recent.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-black/5 last:border-0 hover:bg-neutral-50/60 transition-colors"
                    data-testid={`recent-row-${lead.id}`}
                  >
                    <td className="px-5 py-4 font-medium">{lead.name}</td>
                    <td className="px-5 py-4 text-neutral-600">{lead.email}</td>
                    <td className="px-5 py-4 text-neutral-600">{lead.source}</td>
                    <td className="px-5 py-4"><StatusPill status={lead.status} /></td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/leads/${lead.id}`}
                        className="text-[#002FA7] hover:underline font-medium"
                        data-testid={`recent-open-${lead.id}`}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
