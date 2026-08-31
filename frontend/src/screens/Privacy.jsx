import { Link } from "react-router-dom";
import Starfield from "../components/ui/Starfield";
import SiteNav from "../components/landing/SiteNav";
import Footer from "../components/landing/Footer";
import Icon from "../components/ui/Icon";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// Privacy policy — deliberately honest and specific to how this app actually
// works: no accounts, no backend, no trackers. Wallet activity is public
// on-chain data by nature; preferences live only in the browser. Kept in step
// with the app's real behavior (localStorage key, third-party connections).
export default function Privacy() {
  useDocumentMeta(
    "Privacy Policy",
    "How SpaceShield handles data: no accounts, no backend, no trackers. Your wallet address is public on-chain by nature; preferences stay in your browser."
  );

  return (
    <div className="landing-dark">
      <Starfield />
      <SiteNav />
      <main className="legal-page">
        <div className="wrap legal">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Home</Link>
                <Icon name="chevronRight" size={13} className="crumb-sep" />
              </li>
              <li>
                <span aria-current="page">Privacy</span>
              </li>
            </ol>
          </nav>

          <div className="legal-head">
            <div className="legal-badge">
              <Icon name="lock" size={15} /> Privacy
            </div>
            <h1>Privacy policy</h1>
            <p className="lede">
              The short version: SpaceShield has no accounts, no backend server, and no trackers.
              This page spells out exactly what that means for your data.
            </p>
            <p className="legal-meta mono">Effective 30 August 2026 · local demo build</p>
          </div>

          <section className="legal-sec">
            <h2>What SpaceShield is</h2>
            <p>
              SpaceShield is a prototype dApp: a marketing landing page plus a wallet-connected
              interface to on-chain smart contracts. It runs entirely in your browser. There is no
              company account system, no login, and no server that collects or stores information
              about you.
            </p>
          </section>

          <section className="legal-sec">
            <h2>No accounts, no backend</h2>
            <p>
              We do not ask you to sign up, and we do not operate a backend that receives your
              personal data. The site is static frontend code. It does not send your activity to us
              because there is no "us" server to send it to.
            </p>
          </section>

          <section className="legal-sec">
            <h2>Your wallet and on-chain data</h2>
            <p>
              When you connect a wallet, your public wallet address becomes visible to the app
              inside your browser so it can show your coverage, claims, and payouts. Any transaction
              you choose to send is recorded permanently on a public blockchain — that record is
              public by design, is not controlled by us, and cannot be deleted. We do not collect,
              store, or transmit your address to any server of ours.
            </p>
          </section>

          <section className="legal-sec">
            <h2>What's stored in your browser</h2>
            <p>
              Your notification preferences (the toggles on the Settings page) are saved in your
              browser's <code className="inline">localStorage</code> under the key{" "}
              <code className="inline">spaceshield.notifs</code>. They never leave your device and
              are not sent anywhere — wiring them to a real notifier is explicitly post-MVP. Clearing
              your browser's site data removes them.
            </p>
          </section>

          <section className="legal-sec">
            <h2>Cookies and analytics</h2>
            <p>
              None. SpaceShield sets no cookies and runs no analytics, advertising, session
              recording, or fingerprinting scripts. There is nothing tracking you across pages or
              across the web.
            </p>
          </section>

          <section className="legal-sec">
            <h2>Third parties you connect to</h2>
            <p>Using the app makes a few unavoidable technical connections, each governed by that provider's own policy:</p>
            <ul className="legal-list">
              <li>
                <strong>Your wallet provider</strong> (e.g. the WalletConnect / RainbowKit flow) —
                handles the connection and any signing you approve.
              </li>
              <li>
                <strong>The blockchain RPC endpoint</strong> — reads chain state and broadcasts your
                transactions; it can see your IP address and the requests your client makes.
              </li>
              <li>
                <strong>Google Fonts</strong> — serves the site's typefaces from a CDN, which sees
                your IP address as part of delivering those files.
              </li>
            </ul>
            <p>
              We don't share data with these parties beyond what's technically required to make a
              wallet, a blockchain, and a webpage work.
            </p>
          </section>

          <section className="legal-sec">
            <h2>Changes to this policy</h2>
            <p>
              As this prototype evolves toward a real deployment, this policy may change. The
              effective date at the top reflects the current version. Material changes to data
              handling would be reflected here.
            </p>
          </section>

          <section className="legal-sec">
            <h2>Questions</h2>
            <p>
              This is a hackathon prototype rather than a launched product, so there's no support
              desk. Questions about the design or this policy are best raised through the project's
              repository. You can also review the app's behavior directly — it's all client-side.
            </p>
            <div className="row" style={{ marginTop: 18, flexWrap: "wrap", gap: 10 }}>
              <Link className="btn green" to="/">
                Back to home →
              </Link>
              <Link className="btn ghost" to="/app/settings">
                See your local settings
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
