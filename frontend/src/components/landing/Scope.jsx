const IN_SCOPE = [
  ["AI Agent — mock Spacecoin data", "Days 1–3"],
  ["Source Chain Contract — mock events", "Days 3–5"],
  ["Oracle Worker — usc-sdk proofs", "Days 5–8"],
  ["ASC — precompile verification", "Days 8–11"],
  ["Settlement Contract — bond release", "Days 11–13"],
  ["UI / demo dashboard", "Days 13–17"],
];
const OUT_SCOPE = [
  ["Multi-satellite monitoring", "post-MVP"],
  ["Complex ML fatigue/anomaly models", "post-MVP"],
  ["Multi-chain support beyond Spacecoin", "post-MVP"],
  ["Real user onboarding", "post-MVP"],
];

export default function Scope() {
  return (
    <section id="scope">
      <div className="wrap">
        <div className="eyebrow reveal">05 · MVP scope</div>
        <h2 className="reveal">Seventeen days. One satellite. The full loop.</h2>
        <p className="lede reveal">
          The prototype narrows to prove the mechanism end to end rather than the coverage — depth
          over breadth.
        </p>

        <div className="scope reveal">
          <div className="scope-col in">
            <h3>In scope</h3>
            {IN_SCOPE.map(([comp, day]) => (
              <div className="scope-row" key={comp}>
                <span className="comp">{comp}</span>
                <span className="day">{day}</span>
              </div>
            ))}
          </div>
          <div className="scope-col out">
            <h3>Out of scope — for now</h3>
            {OUT_SCOPE.map(([comp, day]) => (
              <div className="scope-row" key={comp}>
                <span className="comp">{comp}</span>
                <span className="day">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
