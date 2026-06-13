import { useEffect, useState } from "react";
import { Plus, Trash, ShieldCheck, Users as UsersIcon, X } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import AdminHeader from "@/components/AdminHeader";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function UsersAdmin() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "agent" });
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data || []);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim() || !form.name.trim()) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);
    try {
      await api.post("/users", {
        ...form,
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
      });
      toast.success(`User ${form.email} created`);
      setForm({ email: "", name: "", password: "", role: "agent" });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not create user");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (u, role) => {
    if (u.role === role) return;
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success(`${u.email} → ${role}`);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not update role");
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User deleted");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not delete user");
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]" data-testid="users-page">
      <AdminHeader />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-eyebrow text-[#002FA7]">· Access control</span>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tighter font-black mt-2 inline-flex items-center gap-3">
              <UsersIcon size={42} weight="bold" />
              Team & roles
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            data-testid="toggle-create-user"
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            {showForm ? <X size={16} weight="bold" /> : <Plus size={16} weight="bold" />}
            {showForm ? "Cancel" : "Invite user"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            data-testid="create-user-form"
            className="mt-8 bg-white border border-black/10 p-6 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <input
              data-testid="new-user-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              className="px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all text-sm"
            />
            <input
              data-testid="new-user-email"
              type="text"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@company.com"
              className="px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all text-sm"
            />
            <input
              data-testid="new-user-password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (≥6 chars)"
              className="px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none focus:ring-2 focus:ring-[#002FA7]/20 transition-all text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                data-testid="new-user-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="flex-1 px-3 py-2.5 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none text-sm"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={creating}
                data-testid="create-user-submit"
                className="btn-primary text-sm disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        )}

        {/* Users table */}
        <section className="mt-8 border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="bg-neutral-50 border-b border-black/10">
              <tr>
                {["Name", "Email", "Role", "Created", ""].map((h) => (
                  <th key={h} className="label-eyebrow text-neutral-500 text-left px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">Loading…</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">No users yet.</td>
                </tr>
              )}
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr
                    key={u.id}
                    data-testid={`user-row-${u.id}`}
                    className="border-b border-black/5 last:border-0 hover:bg-neutral-50/60 transition-colors"
                  >
                    <td className="px-5 py-4 font-medium whitespace-nowrap">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 label-eyebrow text-[#002FA7]">· you</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-600 whitespace-nowrap">{u.email}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <select
                        data-testid={`role-select-${u.id}`}
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="px-2 py-1 bg-[#F9FAFB] border border-black/10 focus:border-[#002FA7] focus:outline-none text-xs uppercase tracking-wider font-semibold"
                        style={{
                          color: u.role === "admin" ? "#002FA7" : "#030712",
                        }}
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                      {u.role === "admin" && (
                        <ShieldCheck
                          size={14}
                          weight="bold"
                          className="inline-block ml-2 text-[#002FA7]"
                        />
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono-ibm text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={isSelf}
                        data-testid={`delete-user-${u.id}`}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
                        title={isSelf ? "You can't delete your own account" : "Delete user"}
                      >
                        <Trash size={14} weight="bold" />
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="mt-6 text-xs text-neutral-500 max-w-2xl">
          <strong className="text-[#030712]">Admins</strong> can manage users, delete leads, and view the global audit
          log. <strong className="text-[#030712]">Agents</strong> can view leads, change status, add notes, and schedule
          follow-ups.
        </p>
      </main>
    </div>
  );
}
