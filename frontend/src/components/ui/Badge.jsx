// tone: "" | "ok" | "warn" | "bad"
export function Tag({ tone = "", children }) {
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
