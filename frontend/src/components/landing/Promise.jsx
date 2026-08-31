// Response-time promise — a compact band restating the protocol's timing
// commitment. The ~15s figure is the design target demonstrated end-to-end by
// the local pipeline (one precompile call, one block); it's labeled as such
// rather than presented as a live-network SLA.
const STEPS = [
  { t: "< 1 block", l: "Outage confirmed", d: "once the on-chain confirmation threshold is crossed" },
  { t: "1 tx", l: "Proof verified", d: "Merkle + continuity checked by the 0x0FD2 precompile" },
  { t: "~15s", l: "Compensation settled", d: "paid pro-rata from the operator's bond, end to end" },
];

export default function PromiseBand() {
  return (
    <section className="promise-band">
      <div className="wrap">
        <div className="promise-head">
          <div className="eyebrow reveal">The promise</div>
          <h2 className="reveal">
            From blackout to payout in <em>about fifteen seconds</em> — with zero claim forms.
          </h2>
          <p className="lede reveal">
            No ticket queue, no adjuster, no "please allow 5-7 business days." The moment an outage
            clears verification, settlement fires on its own.
          </p>
        </div>

        <div className="promise-grid reveal">
          {STEPS.map((s) => (
            <div className="promise-step" key={s.l}>
              <div className="pt">{s.t}</div>
              <div className="pl">{s.l}</div>
              <div className="pd">{s.d}</div>
            </div>
          ))}
        </div>

        <p className="promise-foot mono">
          Design target, demonstrated end-to-end on the local pipeline. Live-network timing depends
          on block times and oracle attestation — see the <a href="#faq">honest caveats</a>.
        </p>
      </div>
    </section>
  );
}
