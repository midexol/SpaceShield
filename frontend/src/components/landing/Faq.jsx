import { useState } from "react";

const FAQS = [
  {
    q: "Is this settling real funds right now?",
    a: "No. This is a prototype targeting Creditcoin testnet (free tCTC) and mock Spacecoin data. The precompile call and proof structure are real; the satellite feed behind them is not, yet.",
  },
  {
    q: "What stops a false-positive outage from triggering a payout?",
    a: "A confirmation-count floor (currently >5) plus a second, independent public-tracking check. Both have to agree before the AI agent triggers verification at all.",
  },
  {
    q: "Who decides what counts as an outage?",
    a: "No one, by design — that's the gap this replaces. The threshold is a fixed parameter in the contract, not a person reviewing a claim.",
  },
  {
    q: "What happens if the operator's bond runs out?",
    a: "Not solved in this MVP. Bond replenishment and minimum-bond enforcement are explicitly post-MVP — worth flagging rather than glossing over.",
  },
  {
    q: "Has any of this been audited?",
    a: "No. Seventeen days is a hackathon build timeline, not an audit timeline. Treat every contract here as unaudited until stated otherwise.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq">
      <div className="wrap">
        <div className="eyebrow reveal">06 · Questions</div>
        <h2 className="reveal">The unflattering ones too.</h2>

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
