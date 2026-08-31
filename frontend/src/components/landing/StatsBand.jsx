// The hero's old stat-grid, relocated. It used to load-bearing-share the fold
// with the headline, CTAs, and trust badges; now it gets its own beat right
// after Hero and reveals on scroll like every other below-the-fold section
// (via the global .reveal-stagger observer in lib/animations.js), instead of
// firing on mount. Numerals are set in the serif that only the headline used
// before — mono is reserved for the qualifier line, so the three type roles
// (serif/sans/mono) each carry a distinct level of the fact: the number, the
// plain-English claim, then the technical footnote.
const STATS = [
  { num: "2.6B", lab: "Underserved users targeted", qual: "Spacecoin's stated addressable population" },
  { num: "~15s", lab: "Detection to settlement", qual: "One precompile call, one block" },
  { num: "0x0FD2", lab: "Block Prover precompile", qual: "Native to Creditcoin, not a bridge" },
  { num: "0", lab: "Manual claims filed", qual: "Settlement requires no user action" },
];

export default function StatsBand() {
  return (
    <section className="stats-band">
      <div className="wrap">
        <div className="stats-band-grid reveal-stagger">
          {STATS.map((s) => (
            <div className="stat-lg" key={s.lab}>
              <div className="stat-lg-num">{s.num}</div>
              <div className="stat-lg-lab">{s.lab}</div>
              <div className="stat-lg-qual">{s.qual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
