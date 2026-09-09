// Docs — technical reference, not a sales pitch (that's Vision). Contract
// addresses for whichever network is actually connected, and an honest
// integration-status tracker grouped the way a real capability audit reads:
// what's live and tested, what's a real open question waiting on someone
// else, and what's deliberately mocked with a documented reason. Every claim
// here is backed by something in this repo — architecture.md and README are
// the primary sources; this page is a friendlier front door to them.
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import { useNetwork } from "../hooks/useNetwork";
import { explorerAddr, shortAddr } from "../lib/format";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const LIVE = [
  {
    name: "Contract logic",
    role: "Bonding & settlement",
    detail:
      "Pull-based claims, pro-rata compensation, M-of-N oracle attestation, treasury-routed penalties, idempotent settlement.",
    evidence: "16/16 tests passing — npx hardhat test --no-compile",
  },
  {
    name: "Attestcoin Block Prover",
    role: "Outage proof verification",
    detail:
      "Real ABI pulled from the usc-sdk package, not guessed. Confirmed live on Creditcoin CC3-testnet — a real call gets a real, meaningful rejection of a fake proof.",
    evidence: 'node scripts/check-precompile.js — returns "Merkle proof validation failed"',
  },
  {
    name: "Creditcoin CC3-testnet deployment",
    role: "Settlement chain",
    detail: "All four contracts deployed and live, not a local simulation. See the table below.",
    evidence: "deployment.testnet.json",
  },
  {
    name: "Oracle Worker",
    role: "Public trigger attestation",
    detail:
      "An always-on backend holding the registered oracle's key. Independently re-checks a caller's precompile transaction — target address, arguments, success — before attesting to it.",
    evidence: "oracle-worker/worker.js — POST /attest",
  },
  {
    name: "AI Agent detection",
    role: "Outage cross-check",
    detail:
      "Cross-checks any status change against real NORAD/CelesTrak satellite-tracking data before it will ever raise an alarm.",
    evidence: "agent/monitor.py, agent/public_tracker.py",
  },
  {
    name: "Wallet-connected frontend",
    role: "This app",
    detail: "RainbowKit/wagmi, real reads and writes — no mocked state once a wallet is connected.",
    evidence: "frontend/src/lib/contracts.js",
  },
];

const NEEDS_CONFIRMATION = [
  {
    name: "Satellite telemetry source",
    role: "Detect step's data feed",
    detail:
      "Spacecoin's own docs describe only transaction hashes and payment proofs as on-chain — no satellite status feed. Outreach sent to their team; no reply yet.",
    evidence: "docs.spacecoin.org/network/how-it-works",
  },
  {
    name: "Real Attestcoin proof content",
    role: "Verify step's input",
    detail:
      "The proof shape is confirmed real. The content is still fabricated — there's no real Spacecoin transaction yet to build a genuine proof from.",
    evidence: "oracle-worker/proofBuilder.js",
  },
];

const MOCKED = [
  {
    name: "MockSpacecoinSource",
    role: "Satellite status",
    detail:
      "A real, permissionless contract — anyone can call reportStatus — standing in for telemetry Spacecoin doesn't publish on-chain yet (see above).",
    evidence: "contracts/MockSpacecoinSource.sol",
  },
  {
    name: "COMPENSATION_WINDOW",
    role: "SLA duration",
    detail: "An illustrative placeholder (1 day). A real deployment sets this from Spacecoin's actual SLA terms.",
    evidence: "contracts/SettlementContract.sol",
  },
];

function StatusGroup({ title, sub, rows }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <div className="section-title">
        {title}
        <span className="count-badge">{rows.length}</span>
      </div>
      <p className="section-sub">{sub}</p>
      <div className="status-table">
        <div className="status-table-head">
          <span>Integration</span>
          <span>Role</span>
          <span>What it means today</span>
        </div>
        {rows.map((r) => (
          <div className="status-row" key={r.name}>
            <div className="name">{r.name}</div>
            <div className="role">{r.role}</div>
            <div className="detail">
              {r.detail}
              <span className="evidence">
                Evidence: <code>{r.evidence}</code>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Docs() {
  const { net } = useNetwork();

  useDocumentMeta(
    "Docs",
    "How SpaceShield actually works, contract addresses for the connected network, and an honest, evidence-backed integration status."
  );

  const contracts = net
    ? [
        { label: "MockSpacecoinSource", addr: net.addresses?.source },
        { label: "CoverageVault", addr: net.addresses?.escrow },
        { label: "SettlementContract", addr: net.addresses?.settlement },
        { label: "SpaceShieldASC", addr: net.addresses?.asc },
      ]
    : [];

  const docsUrl = import.meta.env.VITE_DOCS_URL || "https://spaceshield-docs.vercel.app";

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Documentation</div>
        <h1>How SpaceShield actually works.</h1>
        <p className="lede">
          A technical reference, not a pitch — contract addresses, the real pipeline, and an
          honest status of every integration this protocol depends on.
        </p>
      </div>

      <div style={{ padding: "16px 20px", borderRadius: 12, marginBottom: 24, background: "rgba(47, 107, 79, 0.15)", border: "1px solid rgba(47, 107, 79, 0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, color: "var(--green)", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📚 SpaceShield Nextra 4 Documentation Site</span>
            <Tag variant="green">Nextra 4.6.1</Tag>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4, margin: "4px 0 0" }}>
            Explore full MDX specifications, Next.js architecture diagrams, and pagefind static full-text search.
          </p>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn small green"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <span>Open Nextra Docs</span>
          <Icon name="arrowRight" size={14} />
        </a>
      </div>

      <Card style={{ marginBottom: 28 }}>
        <CardHead title="The pipeline" />
        <div className="stack">
          {[
            ["1", "Detect", "AI agent cross-checks satellite status against public tracking data"],
            ["2", "Prove", "A cryptographic Merkle + continuity proof is built from the outage event"],
            ["3", "Verify", "The proof is checked directly against Attestcoin's real precompile"],
            ["4", "Settle", "M-of-N oracle attestation registers a claimable settlement on Creditcoin"],
          ].map(([num, title, body]) => (
            <div
              className="row"
              key={num}
              style={{ gap: 16, alignItems: "flex-start", padding: "12px 0", borderTop: num === "1" ? "none" : "1px solid var(--line)" }}
            >
              <span className="count-badge" style={{ marginLeft: 0, flexShrink: 0 }}>
                {num}
              </span>
              <div>
                <strong style={{ fontSize: 14.5 }}>{title}</strong>
                <p className="hint" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 34 }}>
        <CardHead
          title={`Contract addresses · ${net?.name || "—"}`}
          right={net?.isLocal === false ? <Tag flat>testnet</Tag> : <Tag flat>local</Tag>}
        />
        {contracts.length ? (
          <div className="stack">
            {contracts.map((c) => {
              const link = explorerAddr(net, c.addr);
              return (
                <div className="kv" key={c.label}>
                  <span className="k">{c.label}</span>
                  <span className="v row" style={{ gap: 10, justifyContent: "flex-end" }}>
                    {c.addr ? (
                      link ? (
                        <a className="linkbtn" href={link} target="_blank" rel="noreferrer">
                          {shortAddr(c.addr)} ↗
                        </a>
                      ) : (
                        <code className="inline">{shortAddr(c.addr)}</code>
                      )
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="hint">Connect a wallet to see addresses for the active network.</p>
        )}
      </Card>

      <div className="page-head" style={{ marginBottom: 24 }}>
        <div className="eyebrow">Integration status</div>
        <h2 style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>
          What's actually live
        </h2>
        <p className="lede" style={{ fontSize: 14 }}>
          Anything SpaceShield can't do yet is disabled or clearly labeled, with the reason shown —
          never replaced with a simulation presented as the real thing.
        </p>
      </div>

      <StatusGroup
        title="Live"
        sub="Verified against the real network or primary documentation, not just reasoned about."
        rows={LIVE}
      />
      <StatusGroup
        title="Needs confirmation"
        sub="The integration point exists; the answer depends on someone outside this repo."
        rows={NEEDS_CONFIRMATION}
      />
      <StatusGroup
        title="Mocked, by necessity"
        sub="Real code, fabricated input — documented here rather than hidden."
        rows={MOCKED}
      />

      <div className="callout mono">
        Full elimination trails, decision log, and open questions live in{" "}
        <code>architecture.md</code> and README's "Known gaps" — this page summarizes them, it
        doesn't replace them.
      </div>
    </div>
  );
}
