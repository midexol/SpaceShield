// tone: "" | "ok" | "warn" | "bad". flat: soft-filled pill, no border/dot —
// the calmer editorial status style used on Dashboard + Docs.
export function Tag({ tone = "", flat = false, children }) {
  if (flat) {
    return <span className={`pill ${tone}`}>{children}</span>;
  }
  return (
    <span className={`tag ${tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

// dot: "" (green) | "rust" | "amber"
export function Badge({ dot = "", children }) {
  return (
    <span className="badge">
      <span className={`dot ${dot}`} />
      {children}
    </span>
  );
}
