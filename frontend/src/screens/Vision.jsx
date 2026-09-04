// Vision — a plain-language explainer, not a marketing simulation. No wallet
// needed (same spirit as Network). Leads with "how does this actually work"
// in everyday terms, then an honest real-vs-pending status per stage. Deep
// technical evidence (exact error strings, call semantics, ABI sources)
// intentionally lives in architecture.md, not here — this page is for a
// reader deciding whether to trust the system, not auditing its code.
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const PAYOUT_STEPS = [
  {
    icon: "shield",
    title: "An operator locks a bond",
    body: "A satellite operator puts up collateral on Creditcoin — like a security deposit that guarantees the money to pay claims is actually there before any outage happens.",
  },
  {
    icon: "lock",
    title: "A subscriber locks coverage",
    body: "Anyone wanting outage protection locks stake into SpaceShield's own vault. That's what makes them \"covered\" and eligible for compensation later.",
  },
  {
    icon: "signal",
    title: "An outage is detected, independently",
    body: "An AI agent watches satellite status and cross-checks it against public tracking data before raising any alarm — one bad signal alone can never trigger a payout.",
  },
  {
    icon: "activity",
    title: "Independent verifiers agree",
    body: "The outage is proven cryptographically through Attestcoin, and multiple separate oracles each have to confirm it — like requiring more than one signature, so no single party can fake a claim.",
  },
  {
    icon: "signal",
    title: "Compensation becomes claimable",
    body: "Once verified, each subscriber's payout is calculated automatically — proportional to how long they were covered and how long the outage lasted. Nothing is auto-pushed: each subscriber claims their own payout directly to their wallet, whenever they want.",
  },
];

const STAGES = [
  {
    num: "1",
    icon: "signal",
    title: "Detect",
    subtitle: "Is the satellite actually down?",
    status: "needs",
    statusLabel: "Needs Spacecoin",
    today:
      "The satellite status this reads today is a stand-in — there's no real satellite feeding it yet. But the part that decides whether an outage is real is genuinely built and tested: an independent AI agent cross-checks any status change against public satellite-tracking data before it will ever raise an alarm.",
    vision:
      "Once Spacecoin shares real status data, this plugs in without a rebuild. Their own documentation confirms that data isn't published on any chain today — we're waiting to hear from their team directly on if or when that changes.",
  },
  {
    num: "2",
    icon: "lock",
    title: "Verify",
    subtitle: "Proving the outage really happened",
    status: "live",
    statusLabel: "Live today",
    today:
      "Real and tested against the actual Creditcoin network — not simulated. Attestcoin, Creditcoin's built-in proof-checker, genuinely accepts real proofs and rejects fake ones, confirmed by testing it live. Every check is its own public transaction, checkable by anyone, forever.",
    vision:
      "Multiple independent oracles have to agree before a payout is finalized — that's what keeps this trustworthy, standing in for a single all-in-one automatic check that the real chain doesn't allow.",
  },
  {
    num: "3",
    icon: "activity",
    title: "Settle",
    subtitle: "Money moves, automatically",
    status: "live",
    statusLabel: "Live today",
    today:
      "Fully working right now, on Creditcoin's live testnet: bonds, automatic payout math, and subscribers pulling their own compensation directly — no manual approval step, no human in the loop.",
    vision: "This is already the finished version. Nothing left to build here.",
  },
  {
    num: "4",
    icon: "shield",
    title: "Cover",
    subtitle: "Who's protected",
    status: "live",
    statusLabel: "Live · decision pending",
    today:
      "Subscribers lock funds directly with SpaceShield to get covered — this is SpaceShield's own product, separate from however Spacecoin bills for data service.",
    vision:
      "Could later also check someone's real Spacecoin usage as an extra signal for eligibility. That's a business decision, not something blocking the technology.",
  },
];

export default function Vision() {
  useDocumentMeta(
    "The Full Vision",
    "How SpaceShield's payout actually works, in plain terms, plus an honest real-vs-pending status for each stage."
  );

  return (
    <div>
      <div className="page-head">
        <h1>How this actually works</h1>
        <p className="lede">
          No jargon first — five steps, in order, from an operator locking a bond to a subscriber
          getting paid. The honest real-vs-pending breakdown for each stage is further down.
        </p>
      </div>

      <div className="stack" style={{ gap: 12, marginBottom: 28 }}>
        {PAYOUT_STEPS.map((s, i) => (
          <Card key={s.title}>
            <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
              <div
                className="row"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "var(--blue-tint, rgba(63,111,224,0.12))",
                  color: "var(--brand)",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <Icon name={s.icon} size={16} />
                  <strong style={{ fontSize: 14.5 }}>{s.title}</strong>
                </div>
                <p className="hint" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                  {s.body}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="page-head" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 20 }}>Stage by stage: what's real today</h2>
        <p className="lede" style={{ fontSize: 14 }}>
          Everything below already exists as real, tested code. This is what changes once
          Spacecoin's team confirms the one piece this project can't resolve alone.
        </p>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {STAGES.map((s) => (
          <Card key={s.num}>
            <CardHead
              title={
                <span className="row" style={{ gap: 10 }}>
                  <Icon name={s.icon} size={18} />
                  {s.num} · {s.title}
                  <span className="hint" style={{ fontWeight: 400 }}>
                    {s.subtitle}
                  </span>
                </span>
              }
              right={<Tag tone={s.status === "live" ? "ok" : "warn"}>{s.statusLabel}</Tag>}
            />
            <div className="grid cols-2">
              <div>
                <div className="field-label">Today</div>
                <p className="hint" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {s.today}
                </p>
              </div>
              <div>
                <div className="field-label">Full vision</div>
                <p className="hint" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {s.vision}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="callout mono" style={{ marginTop: 22 }}>
        Full technical evidence — exact test results, the precompile call-shape finding, ABI
        sources — is in <code>architecture.md</code>; concrete next steps are in README's "What
        you need to do."
      </div>
    </div>
  );
}
