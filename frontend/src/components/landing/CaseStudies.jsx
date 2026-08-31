import { Link } from "react-router-dom";
import Icon from "../ui/Icon";

// Illustrative scenarios — deliberately hypothetical walk-throughs of how the
// pipeline behaves, including when it correctly does nothing. Numbers mirror the
// local demo deployment (SAT-014) so they line up with the simulator; they are
// NOT real customers, pilots, or live outages, and the section says so plainly.
const CASES = [
  {
    tag: "Regional blackout",
    sat: "SAT-014 · Cross River, NG",
    setup:
      "A satellite serving a rural coverage cell drops offline during peak evening hours. 118 subscribers on $2/month plans lose their only connection.",
    detect: "AI agent sees isOnline=false at 6/6 confirmations; the public-tracking cross-check agrees.",
    verify: "Merkle + continuity proof verified by the 0x0FD2 precompile inside the settlement tx.",
    settle: "3.20 CTC released pro-rata from the operator's bond — about 0.027 CTC to each of 118 users.",
    outcome: "No tickets filed. Affected users are compensated before the satellite is back online.",
  },
  {
    tag: "Brief flicker, no payout",
    sat: "SAT-014 · below threshold",
    setup:
      "Telemetry reports a 40-second dip, but only 2 of the required 6 confirmations arrive before the satellite recovers.",
    detect: "The confirmation floor (>5) is never crossed, so the second cross-check never fires.",
    verify: "No proof is built — there is nothing to verify.",
    settle: "No settlement. The bond is untouched.",
    outcome: "The guardrail against false positives holds: transient blips don't drain the bond.",
  },
  {
    tag: "Bond under pressure",
    sat: "SAT-014 · repeat outages",
    setup:
      "An unreliable operator racks up three verified outages in a week while its subscriber count keeps climbing.",
    detect: "Each outage is detected and cross-checked independently.",
    verify: "All three clear the precompile; every settlement is idempotent, so none double-pays.",
    settle: "Pro-rata payouts shrink the bond; health slips from healthy to at-risk on the Network page.",
    outcome: "Bond health is public in real time — an unreliable operator's economics are visible to everyone.",
  },
];

export default function CaseStudies() {
  return (
    <section id="cases">
      <div className="wrap">
        <div className="eyebrow reveal">04 · In practice</div>
        <h2 className="reveal">Three scenarios, start to finish.</h2>
        <p className="lede reveal">
          Walk-throughs of how the pipeline behaves — including when it deliberately does nothing.
          These are hypothetical examples chosen to show the mechanism, not real customers or live
          outages.
        </p>

        <div className="cases-note reveal">
          <Icon name="shield" size={15} />
          <span>
            Illustrative only — figures mirror the local demo (SAT-014), not a production deployment.
          </span>
        </div>

        <div className="cases-grid">
          {CASES.map((c) => (
            <article className="case-card reveal" key={c.tag}>
              <div className="case-top">
                <span className="case-tag">{c.tag}</span>
                <span className="case-sat mono">{c.sat}</span>
              </div>
              <p className="case-setup">{c.setup}</p>
              <div className="case-flow">
                <div className="case-step">
                  <span className="cs-k">Detect</span>
                  <span className="cs-v">{c.detect}</span>
                </div>
                <div className="case-step">
                  <span className="cs-k">Verify</span>
                  <span className="cs-v">{c.verify}</span>
                </div>
                <div className="case-step">
                  <span className="cs-k">Settle</span>
                  <span className="cs-v">{c.settle}</span>
                </div>
              </div>
              <div className="case-outcome">{c.outcome}</div>
            </article>
          ))}
        </div>

        <div className="cases-cta reveal">
          <Link className="btn green" to="/app/network">
            See it live on the Network page →
          </Link>
          <a className="btn ghost" href="#simulate">
            Replay the simulator
          </a>
        </div>
      </div>
    </section>
  );
}
