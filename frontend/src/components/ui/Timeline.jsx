// Generic expandable timeline. Each entry is fully-formed by the caller:
//   { key, marker, title, sub, right, detail? }
// marker ∈ "status" | "verified" | "settled" (drives the dot color). When
// `detail` is present the row toggles it open; otherwise it's a static row.
// History passes rich proof-chain nodes as `detail`; Network passes plain rows.
import { useState } from "react";

export default function Timeline({ entries }) {
  const [openKey, setOpenKey] = useState(null);
  if (!entries?.length) return null;

  return (
    <div className="timeline">
      {entries.map((en) => {
        const isOpen = openKey === en.key;
        const hasDetail = Boolean(en.detail);
        const Row = (
          <>
            <span className={`tl-marker ${en.marker || ""}`} />
            <div className="tl-main">
              <div className="tl-title">{en.title}</div>
              {en.sub ? <div className="tl-sub">{en.sub}</div> : null}
            </div>
            <div className="tl-right">{en.right}</div>
          </>
        );
        return (
          <div className={`tl-item ${isOpen ? "open" : ""}`} key={en.key}>
            {hasDetail ? (
              <button
                type="button"
                className="tl-row"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : en.key)}
              >
                {Row}
              </button>
            ) : (
              <div className="tl-row" style={{ cursor: "default" }}>
                {Row}
              </div>
            )}
            {hasDetail ? (
              <div className="tl-detail">
                <div className="tl-detail-in">{en.detail}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
