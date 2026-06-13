export const STATUS_META = {
  new: {
    label: "New",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
  },
  contacted: {
    label: "Contacted",
    color: "#B45309",
    bg: "rgba(245,158,11,0.10)",
  },
  converted: {
    label: "Converted",
    color: "#047857",
    bg: "rgba(16,185,129,0.10)",
  },
};

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.new;
  return (
    <span
      data-testid={`status-pill-${status}`}
      className="status-pill"
      style={{ color: meta.color, background: meta.bg }}
    >
      <span className="status-dot" />
      {meta.label}
    </span>
  );
}
