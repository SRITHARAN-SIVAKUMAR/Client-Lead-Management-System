import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
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

  return children;
}
