export default function Problem() {
  return (
    <section id="problem">
      <div className="wrap">
        <div className="eyebrow reveal">01 · The trust gap</div>
        <h2 className="reveal">
          Decentralized infrastructure still fails <em>centrally</em> when it comes to
          accountability.
        </h2>
        <p className="lede reveal">
          Spacecoin sells $2/month satellite internet into markets with no fallback connection.
          When a satellite drops, the user has no recourse today — and the three usual answers all
          reintroduce the thing DePIN was supposed to remove.
        </p>

        <div className="split reveal">
          <div className="panel bad">
            <h3>What exists today</h3>
            <ul>
              <li>
                <strong>Manual claims</strong> — slow, costly to process, and requires a user who
                already lost connectivity to file a report.
              </li>
              <li>
                <strong>Centralized refunds</strong> — someone has to decide what counts as a
                "real" outage. That someone is a trust bottleneck.
              </li>
              <li>
                <strong>No compensation</strong> — the default. Users absorb 100% of the downtime
                risk on infrastructure they don't control.
              </li>
            </ul>
          </div>
          <div className="panel good">
            <h3>What SpaceShield does instead</h3>
            <ul>
              <li>
                <strong>Monitors</strong> on-chain uptime data plus public satellite tracking,
                cross-checked before anything triggers.
              </li>
              <li>
                <strong>Verifies</strong> the outage cryptographically via Attestcoin's Block Prover
                precompile — a proof, not an opinion.
              </li>
              <li>
                <strong>Settles</strong> compensation automatically from a pre-locked operator bond.
                No claim, no case number, no wait.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
