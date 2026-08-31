import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  ["#problem", "Problem"],
  ["#simulate", "Simulate"],
  ["#architecture", "Architecture"],
  ["#cases", "Case studies"],
  ["#scope", "Scope"],
  ["#faq", "FAQ"],
];

// Shared marketing top nav — used by the landing page (`home`), the 404 page,
// and the privacy page. On the landing page the links are in-page anchors; on
// the standalone pages they collapse to a single "back to home" link so we
// never render dead in-page anchors.
export default function SiteNav({ home = false }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`site-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap">
        <Link className="brand" to="/">
          <span className="brand-mark" /> SPACESHIELD
        </Link>
        <div className="navlinks">
          {home ? (
            SECTIONS.map(([href, label]) => (
              <a key={href} href={href} className="hide-sm">
                {label}
              </a>
            ))
          ) : (
            <Link to="/" className="hide-sm">
              ← Back to home
            </Link>
          )}
        </div>
        <div className="nav-right">
          <div className="badge">
            <span className="dot" />
            Creditcoin Testnet
          </div>
          <Link className="btn small green" to="/app">
            Launch app →
          </Link>
        </div>
      </div>
    </nav>
  );
}
