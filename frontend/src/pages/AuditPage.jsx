import { ClockClockwise } from "@phosphor-icons/react";
import AdminHeader from "@/components/AdminHeader";
import AuditTimeline from "@/components/AuditTimeline";

export default function AuditPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]" data-testid="audit-page">
      <AdminHeader />
      <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
        <span className="label-eyebrow text-[#002FA7]">· Audit log</span>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter font-black mt-2 inline-flex items-center gap-3">
          <ClockClockwise size={42} weight="bold" />
          Activity
        </h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Every status change, follow-up, note, user invite, deletion, and CSV export — recorded in
          one immutable timeline.
        </p>
        <section className="mt-8 border border-black/10 bg-white">
          <AuditTimeline limit={200} />
        </section>
      </main>
    </div>
  );
}
