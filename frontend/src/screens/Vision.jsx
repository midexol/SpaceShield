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
    status: "live",
    statusLabel: "Live today",
    today:
      "The interface is real, not guessed — pulled directly from the usc-sdk package's own shipped ABI. Confirmed live on Creditcoin's real CC3-testnet: called directly, top-level, it returns a real, meaningful rejection of a fake proof (\"Merkle proof validation failed\") — proof the precompile itself genuinely works. What doesn't work is calling it FROM inside another contract: it only answers when it's a transaction's own direct target, never a call nested inside SpaceShieldASC's execution — tested both as `.call` and `.staticcall`, same result either way. So verification now happens off-chain, by each Oracle Worker, as its own top-level transaction against the real precompile; SpaceShieldASC records that transaction's hash as a public audit trail rather than re-checking the proof math itself.",
    vision:
      "This is close to the honest end-state already: a single atomic on-chain check nested inside settlement logic isn't possible given how the real precompile is gated, so decentralized oracle attestation (M-of-N, already built and tested) carries the trust weight instead — backed by a publicly verifiable off-chain transaction hash anyone can independently check against the real precompile.",
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
    "What SpaceShield looks like fully realized, stage by stage — honestly compared against what's real today, including a real-testnet finding that changed how on-chain verification works."
  );

  return (
    <div>
      <div className="page-head">
        <h1>The full vision</h1>
        <p className="lede">
          Everything below already exists as real, tested code. This page shows what changes once
          Spacecoin's team confirms the one piece this project can't resolve alone — stage by stage,
          honestly, not smoothed over for a demo.
        </p>
      </div>

      <div className="callout info" style={{ marginBottom: 22 }}>
        <strong>Why this page exists.</strong> Two of the four stages below were actually tested
        against Creditcoin's real CC3-testnet, not just reasoned about. One of them (Verify) produced a
        real finding that changed the architecture — the precompile IS live, but only answers top-level
        calls, not ones nested inside a contract — and the code below now reflects that correction, not
        a guess. Rather than hide that behind a polished simulation, this page says exactly where the
        line between "real" and "pending" currently sits.
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
        Full evidence trail — including the elimination test that found the precompile's top-level-only
        behavior — is in <code>architecture.md</code> §4 and §4a, and the concrete next steps are in
        README's "What you need to do."
      </div>
    </div>
  );
}
