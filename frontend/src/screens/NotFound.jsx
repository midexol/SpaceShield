import { Link } from "react-router-dom";
import SiteNav from "../components/landing/SiteNav";
import Footer from "../components/landing/Footer";
import Icon from "../components/ui/Icon";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// Custom 404 — keeps the marketing chrome (nav + footer) and offers real
// internal links back into the app rather than a bare "not found".
export default function NotFound() {
  useDocumentMeta(
    "Page not found (404)",
    "That page drifted out of range. Head back to the SpaceShield home page or launch the app."
  );

  return (
    <div className="landing-dark">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap notfound">
          <div className="nf-mark">
            <Icon name="compass" size={40} />
          </div>
          <div className="nf-num mono">404</div>
          <h1>This orbit is empty.</h1>
          <p className="lede">
            The page you're looking for drifted out of range — moved, renamed, or never in this
            constellation to begin with.
          </p>
          <div className="row nf-cta">
            <Link className="btn green" to="/">
              Back to home →
            </Link>
            <Link className="btn" to="/app">
              Launch the app
            </Link>
          </div>

          <div className="nf-links">
            <div className="nf-links-label mono">Try one of these</div>
            <ul>
              <li>
                <Link to="/app">Dashboard</Link> — your coverage and payouts
              </li>
              <li>
                <Link to="/app/network">Network</Link> — live telemetry &amp; bond health
              </li>
              <li>
                <Link to="/app/history">Settlement history</Link> — the full audit log
              </li>
              <li>
                <a href="/#faq">FAQ</a> — the unflattering questions too
              </li>
              <li>
                <Link to="/privacy">Privacy policy</Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
