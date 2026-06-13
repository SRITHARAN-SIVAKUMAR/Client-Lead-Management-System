import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user } = useAuth();

  if (user === null) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-screen flex items-center justify-center font-mono-ibm text-sm tracking-widest uppercase text-neutral-500"
      >
        Verifying session…
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireAdmin && user.role !== "admin") {
    return (
      <div
        data-testid="forbidden"
        className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <span className="label-eyebrow text-red-600">· Forbidden</span>
        <h1 className="font-display text-3xl font-bold">Admin access required</h1>
        <p className="text-neutral-500 text-sm max-w-md">
          Your account has the <span className="font-mono-ibm">{user.role}</span> role. Ask an admin
          to elevate your access if you need to manage users or view the global audit log.
        </p>
      </div>
    );
  }

  return children;
}

