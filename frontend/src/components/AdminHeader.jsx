import { Link, useLocation, useNavigate } from "react-router-dom";
import { SignOut, ChartBar, UsersThree, ShieldCheck, ClockClockwise } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const isActive = (path, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <header
      data-testid="admin-header"
      className="sticky top-0 z-40 bg-white border-b border-black/10 backdrop-blur-xl"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link
            to="/admin"
            data-testid="admin-logo"
            className="font-display font-black text-xl tracking-tighter text-[#030712]"
          >
            LEDGER<span className="text-[#002FA7]">.</span>CRM
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/admin" exact label="Dashboard" icon={ChartBar} isActive={isActive} testid="nav-dashboard" />
            <NavLink to="/admin/leads" label="Leads" icon={UsersThree} isActive={isActive} testid="nav-leads" />
            {isAdmin && (
              <>
                <NavLink to="/admin/users" label="Team" icon={ShieldCheck} isActive={isActive} testid="nav-users" />
                <NavLink to="/admin/audit" label="Audit" icon={ClockClockwise} isActive={isActive} testid="nav-audit" />
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="label-eyebrow text-neutral-400">
              {user?.role === "admin" ? "Admin" : "Agent"}
            </span>
            <span
              data-testid="header-user-email"
              className="text-sm font-medium text-[#030712]"
            >
              {user?.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            data-testid="logout-button"
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            <SignOut size={16} weight="bold" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, exact, label, icon: Icon, isActive, testid }) {
  const active = exact ? isActive(to, true) : isActive(to);
  return (
    <Link
      to={to}
      data-testid={testid}
      className={`label-eyebrow px-3 py-2 inline-flex items-center gap-2 transition-colors ${
        active ? "text-[#002FA7]" : "text-neutral-500 hover:text-[#030712]"
      }`}
    >
      <Icon size={14} weight="bold" />
      {label}
    </Link>
  );
}

