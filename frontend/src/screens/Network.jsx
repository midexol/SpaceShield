// Network — the public, no-wallet transparency page: live satellite telemetry,
// per-operator bond health (the browser port of monitor_bonds.js), protocol
// totals, and a recent-activity feed. It also hosts the Trigger Outage button,
// which runs the REAL pipeline against the local chain (31337 only).
import { useState } from "react";
import { Card, CardHead } from "../components/ui/Card";
import { Metric } from "../components/ui/Stat";
import { Tag } from "../components/ui/Badge";
import Timeline from "../components/ui/Timeline";
import PipelineModal from "../components/ui/PipelineModal";
import { useNetwork } from "../hooks/useNetwork";
import { useSatelliteStatus } from "../hooks/useSatelliteStatus";
import { useBondHealth, HEALTHY_FLOOR } from "../hooks/useBondHealth";
import { useEventFeed } from "../hooks/useEventFeed";
import { canTrigger } from "../lib/demoTrigger";
import { formatEth, timeAgo } from "../lib/format";
import { eventMarker, eventTitle, eventSub, eventRight } from "../lib/eventView";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import Icon from "../components/ui/Icon";

export default function Network() {
  const { chainId, net, deployed, satelliteId } = useNetwork();
  const symbol = net?.nativeSymbol || "";
  const status = useSatelliteStatus();
  const bond = useBondHealth();
  const feed = useEventFeed();
  const [modalOpen, setModalOpen] = useState(false);

  useDocumentMeta(
    "Network",
    "A live, public view of the SpaceShield constellation — satellite telemetry, operator bond health, and settlement activity. No wallet required."
  );

  const triggerable = canTrigger(chainId, net);
  const recent = feed.items.slice(0, 8);

  const onComplete = () => {
    status.refetch?.();
    bond.refetch?.();
    feed.refetch?.();
  };

  return (
    <div>
      <div className="page-head">
        <h1>Network</h1>
        <p className="lede">
          A live, public view of the SpaceShield constellation — telemetry, operator bonds, and
          settlement activity. No wallet required.
        </p>
      </div>

      {!deployed ? (
        <div className="callout warn mono">
          <strong>{net?.name || "This network"} isn't deployed.</strong> Start a local node
          (<code>npx hardhat node</code>) and run <code>node scripts/deploy.js</code>, then reload.
        </div>
      ) : null}

      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <Card>
          <Metric
            value={bond.isLoading ? "…" : String(bond.rows.length)}
            label="Satellites monitored"
            sub="registered operators"
          />
        </Card>
        <Card>
          <Metric
            value={bond.isLoading ? "…" : String(bond.totals.subscribers)}
            label="Active subscribers"
            sub="across all satellites"
          />
        </Card>
        <Card>
          <Metric
            value={bond.isLoading ? "…" : formatEth(bond.totals.bond, { maxFrac: 3 })}
            label={`Bonds locked (${symbol})`}
            sub="operator collateral"
          />
        </Card>
      </div>

      <div className="grid cols-2">
        {/* Satellite telemetry + Trigger Outage */}
        <Card>
          <CardHead
            title={`Satellite · ${satelliteId || "—"}`}
            right={
              status.status ? (
                <Tag tone={status.status.isOnline ? "ok" : "bad"}>
                  {status.status.isOnline ? "ONLINE" : "OFFLINE"}
                </Tag>
              ) : (
                <Tag tone="warn">no data</Tag>
              )
            }
          />
          {status.status ? (
            <>
              <div className="kv">
                <span className="k">Confirmations</span>
                <span className="v">{status.status.confirmations}</span>
              </div>
              <div className="kv">
                <span className="k">Last contact</span>
                <span className="v">{timeAgo(status.status.lastContact)}</span>
              </div>
              <div className="kv">
                <span className="k">Coverage area</span>
                <span className="v">{status.status.location || "—"}</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="icon">
                <Icon name="signal" size={32} />
              </div>
              <p>{deployed ? "Waiting for telemetry…" : "Deploy the network to see telemetry."}</p>
            </div>
          )}

          <div className="stack" style={{ marginTop: 18 }}>
            {triggerable ? (
              <>
                <button className="btn green" onClick={() => setModalOpen(true)}>
                  Trigger outage →
                </button>
                <p className="hint mono">
                  Runs the real detect → prove → verify → settle pipeline on the local chain.
                </p>
              </>
            ) : (
              <div className="callout info">
                <strong>Live trigger is local-only.</strong> On {net?.name || "this network"} the
                outage pipeline is driven by the off-chain oracle-worker, not the browser.
              </div>
            )}
          </div>
        </Card>

        {/* Bond health per operator */}
        <Card>
          <CardHead title="Bond health" right={<span className="hint mono">healthy ≥ {HEALTHY_FLOOR}× outages</span>} />
          {bond.rows.length ? (
            <div className="stack">
              {bond.rows.map((r) => (
                <div className="bondrow" key={r.satelliteId + r.operator}>
                  <div className="row between">
                    <strong>{r.satelliteId}</strong>
                    <Tag tone={r.healthy ? "ok" : "bad"}>{r.healthy ? "healthy" : "at risk"}</Tag>
                  </div>
                  <div className="kv">
                    <span className="k">Bond balance</span>
                    <span className="v">{formatEth(r.balance, { symbol, maxFrac: 4 })}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Per-user payout</span>
                    <span className="v">{formatEth(r.perUser, { symbol, maxFrac: 4 })}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Subscribers</span>
                    <span className="v">{r.subscribers}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Survivable outages</span>
                    <span className="v">{r.survivable === null ? "∞" : `${r.survivable}×`}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">
                <Icon name="shield" size={32} />
              </div>
              <p>{bond.isLoading ? "Reading bonds…" : "No registered operators yet."}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card style={{ marginTop: 22 }}>
        <CardHead
          title="Recent activity"
          right={<span className="hint mono">{feed.items.length} events</span>}
        />
        {recent.length ? (
          <Timeline
            entries={recent.map((it) => ({
              key: it.key,
              marker: eventMarker(it.type),
              title: eventTitle(it, symbol),
              sub: eventSub(it),
              right: eventRight(it),
            }))}
          />
        ) : (
          <div className="empty-state">
            <div className="icon">
              <Icon name="activity" size={32} />
            </div>
            <p>
              {deployed
                ? "No events yet. Trigger an outage to see the pipeline fire."
                : "Deploy the network to see activity."}
            </p>
          </div>
        )}
      </Card>

      <PipelineModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        network={net}
        chainId={chainId}
        onComplete={onComplete}
      />
    </div>
  );
}
