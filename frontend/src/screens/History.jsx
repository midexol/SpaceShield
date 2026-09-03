// History — the full, chronological settlement audit log. Every event expands to
// its place in the AI → Attestcoin → Creditcoin proof chain. When a wallet is
// connected, the user's own payouts are surfaced first in a dedicated section.
import { useState } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import { Card, CardHead } from "../components/ui/Card";
import Timeline from "../components/ui/Timeline";
import { useNetwork } from "../hooks/useNetwork";
import { useEventFeed } from "../hooks/useEventFeed";
import { eventMarker, eventTitle, eventSub, eventRight } from "../lib/eventView";
import { formatEth, formatDateTime, shortHash, shortAddr, explorerTx } from "../lib/format";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import Icon from "../components/ui/Icon";

const PRECOMPILE = "0x0000000000000000000000000000000000000FD2";

const FILTERS = [
  ["all", "All"],
  ["status", "Telemetry"],
  ["verified", "Verified"],
  ["settled", "Settled"],
];

// Which link in the chain this event represents.
function activeStep(type) {
  if (type === "status") return 0;
  if (type === "verified") return 1;
  return 2; // registered | claimed
}

function ProofChain({ it, net, symbol }) {
  const active = activeStep(it.type);
  const txLink = explorerTx(net, it.txHash);

  const steps = [
    {
      label: "AI Detected",
      text:
        it.type === "status"
          ? `Telemetry reported ${it.isOnline ? "ONLINE" : "OFFLINE"} at ${it.confirmations ?? 0} confirmations from ${it.location || "the coverage area"}.`
          : "The AI agent flagged the outage after crossing the confirmation floor and a second public-tracking cross-check.",
      hash: null,
    },
    {
      label: "Attestcoin Verified",
      text:
        active >= 1
          ? `Merkle + continuity proof checked by the Block Prover precompile itself, in its own top-level transaction — the oracle then reports that result on-chain.`
          : "Awaiting cryptographic verification.",
      hash:
        active >= 1
          ? [
              it.outageId ? `outageId ${shortHash(it.outageId)}` : null,
              it.blockHeight ? `block height ${it.blockHeight}` : null,
              `precompile ${shortHash(PRECOMPILE)}`,
            ]
              .filter(Boolean)
              .join("  ·  ")
          : null,
    },
    {
      label: "Creditcoin Settled",
      text:
        it.type === "registered"
          ? `Settlement registered — compensation window opens ${formatDateTime(it.windowStart)}.`
          : it.type === "claimed"
          ? `${formatEth(it.amount, { symbol })} paid to ${shortAddr(it.claimant)}${
              it.fullAmount ? ` of ${formatEth(it.fullAmount, { symbol })} full` : ""
            }.`
          : "No settlement recorded on this event.",
      hash: it.type === "claimed" || it.type === "registered" ? `tx ${shortHash(it.txHash)}` : null,
    },
  ];

  return (
    <div>
      {steps.map((s, i) => (
        <div className={`proof-step ${i === active ? "on" : "muted"}`} key={s.label}>
          <div className="pnum">{i + 1}</div>
          <div>
            <div className="plabel">{s.label}</div>
            <div className="ptext">{s.text}</div>
            {s.hash ? <div className="phash">{s.hash}</div> : null}
          </div>
        </div>
      ))}
      {txLink ? (
        <div style={{ marginTop: 12 }}>
          <a className="btn ghost small" href={txLink} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function History() {
  const { address, isConnected } = useAccount();
  const { net, deployed } = useNetwork();
  const symbol = net?.nativeSymbol || "";
  const feed = useEventFeed();
  const [filter, setFilter] = useState("all");

  useDocumentMeta(
    "Settlement History",
    "The full SpaceShield audit log — every detection, cryptographic verification, and on-chain settlement, each expandable to its complete proof chain."
  );

  const matches = (it) =>
    filter === "all"
      ? true
      : filter === "settled"
      ? it.type === "registered" || it.type === "claimed"
      : it.type === filter;

  const items = feed.items.filter(matches);

  const myPayouts = feed.items.filter(
    (it) =>
      it.type === "claimed" &&
      it.claimant &&
      address &&
      it.claimant.toLowerCase() === address.toLowerCase()
  );

  const toEntry = (it) => ({
    key: it.key,
    marker: eventMarker(it.type),
    title: eventTitle(it, symbol),
    sub: eventSub(it),
    right: eventRight(it),
    detail: <ProofChain it={it} net={net} symbol={symbol} />,
  });

  return (
    <div>
      <div className="page-head">
        <h1>History</h1>
        <p className="lede">
          Every detection, verification, and settlement — each one expands to its full proof chain.
        </p>
      </div>

      {!deployed ? (
        <div className="callout warn mono">
          <strong>{net?.name || "This network"} isn't deployed.</strong>{" "}
          {net?.isLocal === false ? (
            <>
              Run <code>scripts/deploy-testnet.js</code> against{" "}
              <code>--network creditcoinTestnet</code> (needs a funded key — see README), then wire
              the addresses into <code>VITE_CC_TESTNET_*</code>.
            </>
          ) : (
            <>
              Run the local node and <code>node scripts/deploy.js</code> to populate history.
            </>
          )}
        </div>
      ) : null}

      {isConnected && myPayouts.length ? (
        <Card style={{ marginBottom: 22 }}>
          <CardHead title="Your activity" right={<span className="hint mono">{myPayouts.length} payouts</span>} />
          <Timeline entries={myPayouts.map(toEntry)} />
        </Card>
      ) : null}

      <Card>
        <CardHead
          title="All events"
          right={
            <div className="chips">
              {FILTERS.map(([val, label]) => (
                <button
                  key={val}
                  className={`chip ${filter === val ? "on" : ""}`}
                  onClick={() => setFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        {items.length ? (
          <Timeline entries={items.map(toEntry)} />
        ) : (
          <div className="empty-state">
            <div className="icon">
              <Icon name="clock" size={32} />
            </div>
            <p>
              {feed.isLoading
                ? "Loading events…"
                : deployed
                ? "No events match this filter yet."
                : "Deploy the network to see history."}
            </p>
            {deployed ? (
              <Link className="btn ghost small" to="/app/network" style={{ marginTop: 12 }}>
                Trigger an outage →
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
