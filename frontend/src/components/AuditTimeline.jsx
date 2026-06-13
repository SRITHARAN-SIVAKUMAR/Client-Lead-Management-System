import { useEffect, useState } from "react";
import {
  Plus,
  Trash,
  ArrowsLeftRight,
  CalendarPlus,
  CalendarX,
  ChatCircle,
  ChatCircleSlash,
  Download,
  User,
  ShieldWarning,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const ICONS = {
  "lead.created": Plus,
  "lead.deleted": Trash,
  "lead.status_changed": ArrowsLeftRight,
  "lead.followup_set": CalendarPlus,
  "lead.followup_cleared": CalendarX,
  "lead.note_added": ChatCircle,
  "lead.note_deleted": ChatCircleSlash,
  "leads.exported": Download,
  "user.created": User,
  "user.updated": User,
  "user.deleted": ShieldWarning,
};

const COLOR = {
  "lead.created": "#2563EB",
  "lead.deleted": "#DC2626",
  "lead.status_changed": "#7C3AED",
  "lead.followup_set": "#10B981",
  "lead.followup_cleared": "#4B5563",
  "lead.note_added": "#0891B2",
  "lead.note_deleted": "#4B5563",
  "leads.exported": "#030712",
  "user.created": "#002FA7",
  "user.updated": "#002FA7",
  "user.deleted": "#DC2626",
};

export default function AuditTimeline({ leadId, limit = 50 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = leadId ? `/leads/${leadId}/audit` : "/audit";
    api
      .get(url, { params: leadId ? undefined : { limit } })
      .then((r) => setEntries(r.data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [leadId, limit]);

  if (loading) {
    return <div className="p-8 text-center text-neutral-500 text-sm">Loading activity…</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 text-sm" data-testid="audit-empty">
        No activity logged yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-black/5" data-testid="audit-timeline">
      {entries.map((e) => {
        const Icon = ICONS[e.action] || User;
        const color = COLOR[e.action] || "#030712";
        return (
          <li
            key={e.id}
            data-testid={`audit-entry-${e.id}`}
            className="flex items-start gap-4 p-5"
          >
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: `${color}10`, color }}
            >
              <Icon size={18} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <span className="label-eyebrow" style={{ color }}>
                  {e.action.replace(/\./g, " · ")}
                </span>
                <span className="font-mono-ibm text-xs text-neutral-400 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-800 break-words">{e.summary}</p>
              <p className="mt-1 text-xs text-neutral-500">by {e.actor_email}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
