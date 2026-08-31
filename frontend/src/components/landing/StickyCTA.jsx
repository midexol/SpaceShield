import { Link } from "react-router-dom";

// Mobile-only sticky call-to-action. Fixed to the bottom of the viewport under
// 760px on the marketing pages only (the dApp already has its own bottom-tab
// bar). The in-flow spacer reserves space so the fixed bar never covers the
// footer's last line.
export default function StickyCTA() {
  return (
    <>
      <div className="sticky-cta-spacer" aria-hidden="true" />
      <div className="sticky-cta">
        <div className="sticky-cta-text">
          <strong>Autonomous outage refunds</strong>
          <span>Local demo · connect a wallet to use</span>
        </div>
        <Link className="btn green small" to="/app">
          Launch app →
        </Link>
      </div>
    </>
  );
}
