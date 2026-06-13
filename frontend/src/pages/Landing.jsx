import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle, Lightning, ShieldCheck } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function Landing() {
  const [sources, setSources] = useState(["Website Contact Form"]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Website Contact Form",
    message: "",
  });

  useEffect(() => {
    api
      .get("/sources")
      .then((r) => setSources(r.data.sources || []))
      .catch(() => {});
  }, []);

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/leads/public", form);
      setSubmitted(true);
      toast.success("Thanks! We'll be in touch shortly.");
      setForm({ name: "", email: "", phone: "", source: "Website Contact Form", message: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#030712]" data-testid="landing-page">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-black/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-display font-black text-xl tracking-tighter"
            data-testid="landing-logo"
          >
            LEDGER<span className="text-[#002FA7]">.</span>CRM
          </Link>
          <nav className="flex items-center gap-2">
            <a
              href="#features"
              className="hidden sm:inline-flex label-eyebrow text-neutral-500 hover:text-[#030712] px-3 py-2 transition-colors"
            >
              Features
            </a>
            <a
              href="#contact"
              data-testid="nav-contact"
              className="hidden sm:inline-flex label-eyebrow text-neutral-500 hover:text-[#030712] px-3 py-2 transition-colors"
            >
              Contact
            </a>
            <Link
              to="/admin/login"
              data-testid="nav-admin-login"
              className="btn-ghost text-sm"
            >
              Admin login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/5">
        <div className="absolute inset-0 brand-grid opacity-60" aria-hidden />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32 grid md:grid-cols-12 gap-10 relative">
          <div className="md:col-span-7 flex flex-col gap-8">
            <span className="label-eyebrow text-[#002FA7]">
              · 001 / Lead Operating System
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl tracking-tighter font-black leading-[0.95]">
              Turn cold contact forms into
              <span className="block text-[#002FA7]">closed conversations.</span>
            </h1>
            <p className="text-lg text-neutral-600 max-w-xl leading-relaxed">
              A minimalist CRM for capturing inbound leads from your website, tracking every
              follow-up, and converting interest into revenue — without the bloat.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#contact"
                data-testid="hero-cta-contact"
                className="btn-primary inline-flex items-center gap-2"
              >
                Submit a lead
                <ArrowUpRight size={18} weight="bold" />
              </a>
              <Link
                to="/admin/login"
                data-testid="hero-cta-login"
                className="btn-ghost inline-flex items-center gap-2"
              >
                Open admin
              </Link>
            </div>

            <div className="flex items-center gap-8 pt-6 border-t border-black/10">
              <div>
                <div className="font-display text-3xl font-bold">01.</div>
                <div className="label-eyebrow text-neutral-500">Capture</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">02.</div>
                <div className="label-eyebrow text-neutral-500">Qualify</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">03.</div>
                <div className="label-eyebrow text-neutral-500">Convert</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 relative">
            <div className="absolute -inset-4 border border-black/10" aria-hidden />
            <img
              src="https://images.unsplash.com/photo-1672152567948-0d3d10da0039?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwb2ZmaWNlJTIwYnVpbGRpbmd8ZW58MHx8fHwxNzgxMzYxNDY4fDA&ixlib=rb-4.1.0&q=85"
              alt="Modern office"
              className="relative w-full h-[460px] object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-black/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <span className="label-eyebrow text-[#002FA7]">· 002 / Why Ledger</span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight font-bold mt-4 leading-tight">
              Built for the people who actually pick up the phone.
            </h2>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-2 gap-px bg-black/10 border border-black/10">
            {[
              {
                icon: Lightning,
                title: "Instant capture",
                body: "Every website submission lands in the dashboard in real time, ready for triage.",
              },
              {
                icon: ShieldCheck,
                title: "Secure admin access",
                body: "JWT-based authentication with httpOnly cookies. Only your team sees lead data.",
              },
              {
                icon: CheckCircle,
                title: "Status workflow",
                body: "Move leads through New → Contacted → Converted with one click. No drag, no fuss.",
              },
              {
                icon: ArrowUpRight,
                title: "Follow-ups that stick",
                body: "Set a date, get a reminder. Notes stay timestamped against every lead for clean handoffs.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white p-8 hover:bg-neutral-50 transition-colors">
                <f.icon size={28} weight="bold" className="text-[#002FA7]" />
                <h3 className="font-display text-xl font-semibold mt-4">{f.title}</h3>
                <p className="text-neutral-600 mt-2 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="border-b border-black/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <span className="label-eyebrow text-[#002FA7]">· 003 / Get in touch</span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight font-bold mt-4 leading-tight">
              Tell us about the lead you&apos;d like to track.
            </h2>
            <p className="mt-4 text-neutral-600 max-w-md">
              Submissions land instantly in the admin dashboard. The team responds within one
              business day.
            </p>
            <div className="mt-10 border-l-2 border-[#002FA7] pl-6">
              <p className="font-display text-2xl leading-snug">
                &ldquo;Ledger replaced three spreadsheets and a Slack channel — and our close rate
                went up 34%.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc4MTM2MTQ2N3ww&ixlib=rb-4.1.0&q=85"
                  alt="Customer"
                  className="w-10 h-10 object-cover"
                />
                <div>
                  <div className="text-sm font-semibold">Mira Calvert</div>
                  <div className="label-eyebrow text-neutral-500">Head of Growth, Cypher Co.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <form
              data-testid="contact-form"
              onSubmit={handleSubmit}
              className="bg-white border border-black/10 p-8 lg:p-10 grid grid-cols-1 sm:grid-cols-2 gap-5"
            >
              <div className="sm:col-span-2 flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold">New inquiry</h3>
                <span className="label-eyebrow text-neutral-400">FORM · 01</span>
              </div>

              <Field label="Full name *">
                <input
                  data-testid="contact-name"
                  required
                  value={form.name}
                  onChange={handleChange("name")}
                  className="form-input"
                  placeholder="Jamie Rivera"
                />
              </Field>

              <Field label="Email *">
                <input
                  data-testid="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange("email")}
                  className="form-input"
                  placeholder="jamie@company.com"
                />
              </Field>

              <Field label="Phone">
                <input
                  data-testid="contact-phone"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  className="form-input"
                  placeholder="+1 555 010 9942"
                />
              </Field>

              <Field label="Source">
                <select
                  data-testid="contact-source"
                  value={form.source}
                  onChange={handleChange("source")}
                  className="form-input"
                >
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Message" full>
                <textarea
                  data-testid="contact-message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange("message")}
                  className="form-input resize-none"
                  placeholder="Tell us about the project, timeline, and budget…"
                />
              </Field>

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2">
                <span className="text-xs text-neutral-500">
                  By submitting, you agree to be contacted about your inquiry.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="contact-submit"
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit inquiry"}
                  <ArrowUpRight size={18} weight="bold" />
                </button>
              </div>

              {submitted && (
                <div
                  data-testid="contact-success"
                  className="sm:col-span-2 border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm"
                >
                  Lead captured. Our team will reach out shortly.
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <footer className="py-10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-neutral-500">
          <div className="font-display font-black text-[#030712]">
            LEDGER<span className="text-[#002FA7]">.</span>CRM
          </div>
          <div className="label-eyebrow">© 2026 · Built for inbound teams</div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <label className={`flex flex-col gap-2 ${full ? "sm:col-span-2" : ""}`}>
      <span className="label-eyebrow text-neutral-500">{label}</span>
      {children}
      <style>{`
        .form-input {
          width: 100%;
          padding: 12px 14px;
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.15);
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 15px;
          color: #030712;
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .form-input:focus {
          border-color: #002FA7;
          box-shadow: 0 0 0 2px rgba(0,47,167,0.18);
        }
      `}</style>
    </label>
  );
}
