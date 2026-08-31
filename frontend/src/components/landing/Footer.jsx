import { Link } from "react-router-dom";

// Shared footer. On the landing page (`home`) the section links are in-page
// anchors; on the standalone 404 / privacy pages they become deep links back
// to the landing sections so none of them are dead.
export default function Footer({ home = false }) {
  const p = home ? "" : "/";
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-cta">
          <h2 className="reveal">
            Ready when a satellite is <span className="foot-cta-accent">not</span>.
          </h2>
          <Link className="btn green" to="/app">
            Launch app →
          </Link>
        </div>

        <div className="foot-grid">
          <div>
            <Link to="/" className="foot-brand">
              <span className="brand-mark" style={{ display: "inline-block" }} /> SpaceShield
            </Link>
            <p className="foot-desc">
              Autonomous SLA enforcement for Spacecoin's satellite network. Detected by an AI agent,
              verified by Attestcoin, settled by Creditcoin.
            </p>
          </div>
          <div className="foot-col">
            <h5>Protocol</h5>
            <a href={`${p}#problem`}>The problem</a>
            <a href={`${p}#architecture`}>Architecture</a>
            <a href={`${p}#simulate`}>Live simulator</a>
          </div>
          <div className="foot-col">
            <h5>Build</h5>
            <a href={`${p}#cases`}>Case studies</a>
            <a href={`${p}#faq`}>Questions</a>
          </div>
          <div className="foot-col">
            <h5>App</h5>
            <Link to="/app">Launch app</Link>
            <Link to="/app/network">Network status</Link>
            <Link to="/app/history">Settlement history</Link>
            <Link to="/app/settings">Settings</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>SPACESHIELD · LOCAL DEMO BUILD — CONNECT A WALLET TO USE</span>
          <span className="foot-bottom-right">
            <Link to="/privacy">Privacy</Link>
            <span className="foot-dot" aria-hidden="true">·</span>
            <span className="mono">PRECOMPILE 0x0FD2 · CREDITCOIN CC3-TESTNET</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
