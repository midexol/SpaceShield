import { useState } from "react";

const FAQS = [
  {
    q: "How does SpaceShield know my satellite is down?",
    a: "An AI agent watches Spacecoin's on-chain telemetry for your satellite. When status flips to offline, it doesn't trigger anything by itself — it waits for a confirmation-count floor (currently >5 consecutive reports) and cross-checks the outage against an independent public satellite tracker (CelesTrak). Only when both agree does it hand off to verification.",
  },
  {
    q: "What actually gets paid, and how do I claim it?",
    a: "You don't file anything. Once an outage clears verification, the settlement contract registers it as claimable and you pull your compensation with a single transaction — no forms, no case number, no adjuster. Payout is pro-rated to how long you'd been covered when the outage happened, paid out of the operator's pre-locked bond.",
  },
  {
    q: "What do Attestcoin and Creditcoin each do here?",
    a: "Three chains, three jobs. Spacecoin reports the raw outage. Attestcoin's Block Prover precompile (0x0FD2) cryptographically verifies that report — a Merkle inclusion proof plus a continuity check, done in a single atomic call, not a bridge. Creditcoin is where your coverage, the operator's bond, and the actual payout live.",
  },
  {
    q: "Do I have to do anything to be covered?",
    a: "Connect a wallet and lock coverage against a registered satellite operator — that's it. Your stake keeps coverage active; it isn't what pays you out. When an outage settles, eligibility and payout are both checked live against that on-chain coverage record, so there's nothing to keep track of separately.",
  },
  {
    q: "What stops a false-positive outage from triggering a payout?",
    a: "The same confirmation floor and public-tracker cross-check that gate detection, plus M-of-N attestation on-chain: a configurable number of independently registered oracles all have to verify the same outage before it's ever registered for settlement. No single key — human or automated — can finalize one alone.",
  },
  {
    q: "Is this settling real funds right now?",
    a: "Not yet. This targets Creditcoin's CC3 testnet (free tCTC) with mocked Spacecoin telemetry. The proof structure, the precompile call, and the settlement logic are the real code that would ship — the live satellite feed behind them is the piece still to connect.",
  },
  {
    q: "What happens if the operator's bond runs out?",
    a: "Claims revert rather than silently underpay — you're never shorted without knowing it. The outage stays registered and becomes claimable again the moment the operator tops up. Minimum-bond enforcement ahead of that point is explicitly post-MVP.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq">
      <div className="wrap">
        <div className="eyebrow reveal">06 · Questions</div>
        <h2 className="reveal">How it actually works, and where it's still a prototype.</h2>

        <div style={{ marginTop: 36 }} className="reveal">
          {FAQS.map((f, i) => (
            <div className={`faq-item ${open === i ? "open" : ""}`} key={f.q}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                {f.q}
                <span className="plus">+</span>
              </button>
              <div className="faq-a">
                <div className="faq-a-in">{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
