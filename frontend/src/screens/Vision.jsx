// Vision — a transparency page, not a marketing simulation. No wallet needed
// (same spirit as Network). For each stage of the pipeline, it says plainly
// what's real today vs. what changes once Spacecoin and Creditcoin's teams
// confirm the remaining pieces — pulled straight from architecture.md and
// README's "What you need to do", not softened for presentation.
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const STAGES = [
  {
    num: "1",
    icon: "signal",
    title: "Detect",
    subtitle: "Spacecoin telemetry",
    status: "needs",
    statusLabel: "Needs Spacecoin",
    today:
      "MockSpacecoinSource reports fabricated satellite status — there is no real satellite behind it. The AI Agent's detection, cross-check, and confirmation-floor logic (agent/monitor.py) is real code, independently tested, and already watches whatever this contract says.",
    vision:
      "Real Spacecoin satellite status flows in automatically. Whether that's the same on-chain read pattern used today or something else depends on one open question: is Spacecoin's telemetry reporting same-chain (like its payments turned out to be) or on a genuinely separate chain? That needs an answer from Spacecoin's team, not more code here.",
  },
  {
    num: "2",
    icon: "lock",
    title: "Verify",
    subtitle: "Attestcoin precompile",
    status: "needs",
    statusLabel: "Needs Creditcoin",
    today:
      "The interface is real, not guessed — pulled directly from the usc-sdk package's own shipped ABI. But a real call against Creditcoin's live CC3-testnet, made from this app's own deployed contracts, reverted: nothing at the precompile address currently answers to it.",
    vision:
      "A real Merkle inclusion proof plus a continuity proof, checked natively in a single atomic call — no bridge, no separate attestation service, no trusting the Oracle Worker's word for it. The contract code doesn't need to change; it already speaks the confirmed real interface. It just needs the precompile to actually be there.",
  },
  {
    num: "3",
    icon: "activity",
    title: "Settle",
    subtitle: "Creditcoin bonds",
    status: "live",
    statusLabel: "Live today",
    today:
      "Fully real, right now: operator bonds, pull-based claims, live coverage checks, pro-rata compensation math, M-of-N oracle attestation, treasury-routed penalties. 16/16 tests passing, and genuinely deployed on Creditcoin's real testnet — not a simulation.",
    vision: "This is already what it looks like. Nothing changes here.",
  },
  {
    num: "4",
    icon: "shield",
    title: "Cover",
    subtitle: "SpaceShield's own vault",
    status: "live",
    statusLabel: "Live · decision pending",
    today:
      "CoverageVault is SpaceShield's own product — subscribers lock stake directly with SpaceShield, independent of however Spacecoin bills for data. That's a deliberate choice, not a placeholder: Spacecoin's real payment contract turned out to be a pay-per-byte data escrow with no concept of \"coverage\" at all.",
    vision:
      "Could optionally also check Spacecoin's real payment activity as a secondary eligibility signal, layered on top. That's a product decision about what \"actively a customer\" should mean — open, and not blocked on anyone else to make.",
  },
];

export default function Vision() {
  useDocumentMeta(
    "The Full Vision",
    "What SpaceShield looks like fully realized, stage by stage — honestly compared against what's real today, including two things that were tested against Creditcoin's real testnet and don't work yet."
  );

  return (
    <div>
      <div className="page-head">
        <h1>The full vision</h1>
        <p className="lede">
          Everything below already exists as real, tested code. This page shows what changes once
          Spacecoin and Creditcoin's teams confirm the two pieces this project can't resolve alone —
          stage by stage, honestly, not smoothed over for a demo.
        </p>
      </div>

      <div className="callout info" style={{ marginBottom: 22 }}>
        <strong>Why this page exists.</strong> Two of the four stages below were actually tested
        against Creditcoin's real CC3-testnet, not just reasoned about — and one of them doesn't work
        yet. Rather than hide that behind a polished simulation, this page says exactly where the line
        between "real" and "pending" currently sits.
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {STAGES.map((s) => (
          <Card key={s.num}>
            <CardHead
              title={
                <span className="row" style={{ gap: 10 }}>
                  <Icon name={s.icon} size={18} />
                  {s.num} · {s.title}
                  <span className="hint mono" style={{ fontWeight: 400 }}>
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
        Full evidence trail — including the exact revert from the real testnet call — is in{" "}
        <code>architecture.md</code> §4 and §4a, and the concrete next steps are in README's "What you
        need to do."
      </div>
    </div>
  );
}
