import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Trash,
  Calendar as CalendarIcon,
  PaperPlaneTilt,
  ChatCircle,
} from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import api, { formatApiErrorDetail } from "@/lib/api";
import AdminHeader from "@/components/AdminHeader";
import AuditTimeline from "@/components/AuditTimeline";
import { StatusPill, STATUS_META } from "@/components/StatusPill";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [tab, setTab] = useState("notes");
  const [auditNonce, setAuditNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status) => {
    try {
      const { data } = await api.patch(`/leads/${id}`, { status });
      setLead(data);
      setAuditNonce((n) => n + 1);
      toast.success(`Status set to ${STATUS_META[status].label}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Update failed");
    }
  };

  const handleFollowUp = async (date) => {
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    try {
      const { data } = await api.patch(`/leads/${id}`, { follow_up_at: iso });
      setLead(data);
      setAuditNonce((n) => n + 1);
      toast.success(`Follow-up set for ${iso}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Update failed");
    }
  };

  const clearFollowUp = async () => {
    try {
      const res = await api.patch(`/leads/${id}`, { follow_up_at: "" });
      setLead(res.data);
      setAuditNonce((n) => n + 1);
      toast.success("Follow-up cleared");
    } catch (e) {
      toast.error("Could not clear follow-up");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/leads/${id}/notes`, { text: noteText.trim() });
      setNoteText("");
      await load();
      setAuditNonce((n) => n + 1);
      toast.success("Note added");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.delete(`/leads/${id}/notes/${noteId}`);
      await load();
      setAuditNonce((n) => n + 1);
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleDeleteLead = async () => {
    if (!window.confirm("Delete this lead permanently?")) return;
    try {
      await api.delete(`/leads/${id}`);
      toast.success("Lead deleted");
      navigate("/admin/leads");
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <AdminHeader />
        <div className="max-w-[1400px] mx-auto px-6 py-20 text-center text-neutral-500">
          Loading lead…
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <AdminHeader />
        <div className="max-w-[1400px] mx-auto px-6 py-20 text-center">
          <p className="text-neutral-500">Lead not found.</p>
          <Link to="/admin/leads" className="text-[#002FA7] hover:underline">
            ← Back to leads
          </Link>
        </div>
      </div>
    );
  }

  const notes = [...(lead.notes || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]" data-testid="lead-detail-page">
      <AdminHeader />

      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <Link
          to="/admin/leads"
          className="inline-flex items-center gap-2 label-eyebrow text-neutral-500 hover:text-[#030712] transition-colors"
          data-testid="back-to-leads"
        >
          <ArrowLeft size={14} weight="bold" />
          All leads
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1
              data-testid="lead-name"
              className="font-display text-4xl sm:text-5xl tracking-tighter font-black"
            >
              {lead.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-neutral-600">
              <span data-testid="lead-email">{lead.email}</span>
              {lead.phone && <span>· {lead.phone}</span>}
              <span>· {lead.source}</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={handleDeleteLead}
              data-testid="delete-lead-button"
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 transition-colors text-sm"
            >
              <Trash size={16} weight="bold" />
              Delete lead
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-6 mt-10">
          {/* LEFT: status + follow-up + message */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Status workflow */}
            <div
              data-testid="status-card"
              className="bg-white border border-black/10 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="label-eyebrow text-neutral-500">Current status</span>
                <StatusPill status={lead.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {["new", "contacted", "converted"].map((s) => {
                  const meta = STATUS_META[s];
                  const active = lead.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      data-testid={`set-status-${s}`}
                      className="px-3 py-3 border text-xs font-semibold tracking-wider uppercase transition-all"
                      style={{
                        borderColor: active ? meta.color : "rgba(0,0,0,0.12)",
                        color: active ? "white" : "#030712",
                        background: active ? meta.color : "white",
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow-up */}
            <div
              data-testid="followup-card"
              className="bg-white border border-black/10 p-6"
            >
              <span className="label-eyebrow text-neutral-500">Follow-up reminder</span>
              <div className="mt-4 flex items-center justify-between">
                <div className="font-display text-2xl font-bold">
                  {lead.follow_up_at ? (
                    format(parseISO(lead.follow_up_at), "MMM d, yyyy")
                  ) : (
                    <span className="text-neutral-400">Not set</span>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      data-testid="open-calendar"
                      className="btn-ghost inline-flex items-center gap-2 text-sm"
                    >
                      <CalendarIcon size={16} weight="bold" />
                      {lead.follow_up_at ? "Change" : "Schedule"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="p-0 w-auto">
                    <Calendar
                      mode="single"
                      selected={lead.follow_up_at ? parseISO(lead.follow_up_at) : undefined}
                      onSelect={handleFollowUp}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {lead.follow_up_at && (
                <button
                  onClick={clearFollowUp}
                  data-testid="clear-followup"
                  className="mt-3 text-xs text-neutral-500 hover:text-red-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Original message */}
            {lead.message && (
              <div
                data-testid="lead-message-card"
                className="bg-white border border-black/10 p-6"
              >
                <span className="label-eyebrow text-neutral-500">Inbound message</span>
                <p className="mt-3 text-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {lead.message}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-white border border-black/10 p-6 font-mono-ibm text-xs text-neutral-500 space-y-1">
              <div>ID · {lead.id}</div>
              <div>CREATED · {new Date(lead.created_at).toLocaleString()}</div>
              <div>UPDATED · {new Date(lead.updated_at).toLocaleString()}</div>
            </div>
          </div>

          {/* RIGHT: notes / activity tabs */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-black/10">
              <div className="flex items-center justify-between border-b border-black/10">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setTab("notes")}
                    data-testid="tab-notes"
                    className={`px-6 py-5 label-eyebrow border-b-2 transition-colors ${
                      tab === "notes"
                        ? "text-[#002FA7] border-[#002FA7]"
                        : "text-neutral-500 border-transparent hover:text-[#030712]"
                    }`}
                  >
                    Notes ({notes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("activity")}
                    data-testid="tab-activity"
                    className={`px-6 py-5 label-eyebrow border-b-2 transition-colors ${
                      tab === "activity"
                        ? "text-[#002FA7] border-[#002FA7]"
                        : "text-neutral-500 border-transparent hover:text-[#030712]"
                    }`}
                  >
                    Activity
                  </button>
                </div>
                <ChatCircle size={18} weight="bold" className="text-[#002FA7] mr-6" />
              </div>

              {tab === "notes" && (
                <>
                  <form onSubmit={handleAddNote} className="p-6 border-b border-black/10">
                    <textarea
                      data-testid="note-input"
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Log a call, paste an email, or note next steps…"
                      className="w-full px-4 py-3 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all text-sm resize-none"
                    />
                    <div className="flex justify-end mt-3">
                      <button
                        type="submit"
                        disabled={savingNote || !noteText.trim()}
                        data-testid="add-note-button"
                        className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        <PaperPlaneTilt size={16} weight="bold" />
                        {savingNote ? "Saving…" : "Add note"}
                      </button>
                    </div>
                  </form>

                  <ul className="divide-y divide-black/5">
                    {notes.length === 0 && (
                      <li className="p-8 text-center text-neutral-500 text-sm">
                        No notes yet. Add the first one above.
                      </li>
                    )}
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        data-testid={`note-${n.id}`}
                        className="p-6 flex gap-4 group"
                      >
                        <div className="w-1 self-stretch bg-[#002FA7]/30" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="label-eyebrow text-[#002FA7]">{n.author}</span>
                            <span className="font-mono-ibm text-xs text-neutral-400">
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 text-neutral-800 leading-relaxed whitespace-pre-wrap">
                            {n.text}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          data-testid={`delete-note-${n.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-600 self-start"
                          aria-label="Delete note"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tab === "activity" && (
                <AuditTimeline key={auditNonce} leadId={id} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
