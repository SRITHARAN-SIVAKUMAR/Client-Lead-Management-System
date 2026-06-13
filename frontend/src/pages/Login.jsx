import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { ArrowRight, LockKey } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user && typeof user === "object") {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await login(email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (res.ok) {
      toast.success("Welcome back");
      navigate("/admin");
    } else {
      setError(res.error);
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2" data-testid="login-page">
      {/* Left: form */}
      <div className="flex flex-col justify-between p-8 lg:p-14 bg-[#F9FAFB]">
        <Link to="/" className="font-display font-black text-xl tracking-tighter">
          LEDGER<span className="text-[#002FA7]">.</span>CRM
        </Link>

        <div className="max-w-md w-full mx-auto">
          <span className="label-eyebrow text-[#002FA7] inline-flex items-center gap-2">
            <LockKey size={14} weight="bold" /> · Admin access
          </span>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tighter font-black mt-4 leading-[1.05]">
            Sign in to the
            <br />
            command room.
          </h1>
          <p className="mt-4 text-neutral-600">
            Use the seeded admin credentials. Need them?{" "}
            <span className="font-mono-ibm text-xs bg-neutral-200/70 px-1.5 py-0.5">
              admin@crm.local / Admin@12345
            </span>
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="label-eyebrow text-neutral-500">Email</span>
              <input
                data-testid="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-4 py-3 bg-white border border-black/15 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all"
                placeholder="admin@crm.local"
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-eyebrow text-neutral-500">Password</span>
              <input
                data-testid="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-4 py-3 bg-white border border-black/15 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div
                data-testid="login-error"
                className="border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="login-submit"
              className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
              <ArrowRight size={18} weight="bold" />
            </button>

            <Link
              to="/"
              data-testid="back-to-site"
              className="text-sm text-neutral-500 hover:text-[#030712] transition-colors text-center"
            >
              ← Back to website
            </Link>
          </form>
        </div>

        <div className="label-eyebrow text-neutral-400">PROTECTED · /admin</div>
      </div>

      {/* Right: image */}
      <div className="hidden md:block relative overflow-hidden border-l border-black/5">
        <img
          src="https://images.unsplash.com/photo-1483959651481-dc75b89291f1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMG1lc2h8ZW58MHx8fHwxNzgxMzYxNDY4fDA&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#002FA7]/10 mix-blend-multiply" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <span className="label-eyebrow">· Secure ingress</span>
          <h2 className="font-display text-3xl font-bold mt-3 leading-tight">
            One door. One key. Every lead, fully accounted for.
          </h2>
        </div>
      </div>
    </div>
  );
}
