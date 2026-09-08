// Demo — an illustrative, wallet-free walkthrough of the full pipeline and
// the payout math, built for exactly one reason: Spacecoin hasn't gotten
// back to us yet on real satellite telemetry (see architecture.md §3), so
// there's no live "satellite goes dark" moment to point at. This page fakes
// that one input (a status toggle) and nothing else — the four pipeline
// stages mirror the real one (see Network's "Trigger outage" for the real,
// on-chain version), and the payout numbers below are computed with the
// exact formula SettlementContract.claim() uses, not made up.
import { useEffect, useRef, useState } from "react";
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const STAGES = [
  { key: "detect", num: "01", title: "AI Detection", sub: "Spacecoin telemetry" },
  { key: "prove", num: "02", title: "Proof Built", sub: "Attestcoin" },
  { key: "verify", num: "03", title: "Block Prover", sub: "Attestcoin precompile" },
  { key: "settle", num: "04", title: "Settlement", sub: "Creditcoin" },
];
const STAGE_NOTES = [
  "6/6 independent confirmations — status OFFLINE",
  "Merkle + continuity proof built from the outage event",
  "Proof accepted by the Block Prover precompile (0x…0FD2)",
  "Settlement registered — pro-rata payouts below are now claimable",
];
const DURATIONS = [1400, 1200, 1600, 1000]; // ms, illustrative pacing only

// The real formula from contracts/SettlementContract.sol's claim():
//   windowEnd = windowStart + COMPENSATION_WINDOW
//   effectiveStart = max(subStart, windowStart)
//   amount = fullAmount * (windowEnd - effectiveStart) / COMPENSATION_WINDOW
// COMPENSATION_WINDOW is a 1-day placeholder in the real contract too — see
// README's "Known gaps". Everything below is that same arithmetic, run on
// fabricated (but clearly labeled) timestamps instead of a real outage.
const COMPENSATION_WINDOW = 24 * 3600;
const FULL_AMOUNT = 0.05; // CTC per user, illustrative bond rate

const SUBSCRIBERS = [
  { name: "Subscriber A", subscribedHoursBefore: 72, note: "covered well before the outage" },
  { name: "Subscriber B", subscribedHoursBefore: -6, note: "joined 6h into the outage window" },
  { name: "Subscriber C", subscribedHoursBefore: -23, note: "joined 1h before the window closed" },
  { name: "Subscriber D", subscribedHoursBefore: -30, note: "joined after the window already closed" },
];

function payoutFor(subscribedHoursBefore) {
  const windowStart = 0;
  const windowEnd = COMPENSATION_WINDOW;
  const subStart = -subscribedHoursBefore * 3600; // negative "hours before" = joined after windowStart
  const effectiveStart = Math.max(subStart, windowStart);
  if (effectiveStart >= windowEnd) return { eligible: false, amount: 0, coveredHours: 0 };
  const coveredSeconds = windowEnd - effectiveStart;
  const amount = (FULL_AMOUNT * coveredSeconds) / COMPENSATION_WINDOW;
  return { eligible: true, amount, coveredHours: coveredSeconds / 3600 };
}

export default function Demo() {
  const [online, setOnline] = useState(true);
  const [running, setRunning] = useState(false);
  const [stageStatus, setStageStatus] = useState(() => STAGES.map(() => "idle"));
  const [settled, setSettled] = useState(false);
  const [claiming, setClaiming] = useState(null); // subscriber name mid-claim
  const [claimed, setClaimed] = useState(() => new Set());
  const timers = useRef([]);

  useDocumentMeta(
    "Demo",
    "An illustrative walkthrough of SpaceShield's detection, proof, and pro-rata payout pipeline — no wallet needed, built while real Spacecoin telemetry is still pending."
  );

  useEffect(
    () => () => timers.current.forEach((t) => clearTimeout(t)),
    []
  );

  const triggerOutage = () => {
    if (running) return;
    setOnline(false);
    setSettled(false);
    setClaimed(new Set());
    setClaiming(null);
    setRunning(true);
    setStageStatus(STAGES.map(() => "idle"));

    let cumulative = 0;
    DURATIONS.forEach((d, i) => {
      cumulative += d;
      const to = setTimeout(() => {
        setStageStatus((prev) => prev.map((s, idx) => (idx < i ? "done" : idx === i ? "active" : s)));
      }, cumulative - d);
      timers.current.push(to);
    });
    const end = setTimeout(() => {
      setStageStatus(STAGES.map(() => "done"));
      setSettled(true);
      setRunning(false);
    }, cumulative + 200);
    timers.current.push(end);
  };

  const restore = () => {
    setOnline(true);
  };

  const reset = () => {
    setOnline(true);
    setSettled(false);
    setClaimed(new Set());
    setClaiming(null);
    setStageStatus(STAGES.map(() => "idle"));
  };

  const claim = (name) => {
    if (claiming) return;
    setClaiming(name);
    const to = setTimeout(() => {
      setClaimed((prev) => new Set(prev).add(name));
      setClaiming(null);
    }, 700);
    timers.current.push(to);
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Illustrative demo</div>
        <h1>See it work, without waiting on Spacecoin.</h1>
        <p className="lede">
          Real satellite telemetry isn't available yet — Spacecoin's team hasn't confirmed if or
          when it will be (see the Docs page). Everything on this page is fabricated in one place
          only: whether the satellite is online. The pipeline stages and the payout math below are
          the real thing, computed live, not canned strings.
        </p>
      </div>

      <div className="callout warn mono" style={{ marginBottom: 22 }}>
        <strong>Illustrative, not live.</strong> No wallet, no transaction, no real chain — for
        that, use Network's "Trigger outage" instead. This page exists only because there's no real
        outage to point a camera at yet.
      </div>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title={`Satellite · SAT-014`}
          right={<Tag tone={online ? "ok" : "bad"} flat>{online ? "ONLINE" : "OFFLINE"}</Tag>}
        />
        <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div
            className={`dash-hero-icon ${!online ? "active" : ""}`}
            style={{ borderColor: online ? undefined : "var(--rust)", color: online ? undefined : "var(--rust)" }}
          >
            <Icon name="signal" size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p className="hint" style={{ margin: 0 }}>
              {online
                ? "Toggle this offline to watch the full detect → prove → verify → settle pipeline run."
                : running
                ? "Pipeline running — watch each stage below."
                : "Outage settled. Bring it back online, or replay from scratch."}
            </p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            {online ? (
              <button className="btn green" onClick={triggerOutage} disabled={running}>
                Simulate outage →
              </button>
            ) : (
              <button className="btn ghost" onClick={restore} disabled={running}>
                Bring back online
              </button>
            )}
            {settled ? (
              <button className="btn ghost small" onClick={reset}>
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead title="Pipeline" right={<span className="hint mono">{settled ? "settled" : running ? "running…" : "idle"}</span>} />
        <div className="stages" style={{ margin: "0 -22px -22px", borderTop: "1px solid var(--line)" }}>
          {STAGES.map((st, i) => {
            const s = stageStatus[i];
            return (
              <div className={`stage ${s === "idle" ? "" : s}`} key={st.key}>
                <div className="stage-num">
                  <span className="ring">{s === "done" ? "✓" : st.num}</span> {st.sub}
                </div>
                <h4>{st.title}</h4>
                <p>{s === "idle" ? "Waiting…" : STAGE_NOTES[i]}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Payout breakdown"
          right={<span className="hint mono">{FULL_AMOUNT} CTC full rate · 24h window</span>}
        />
        {!settled ? (
          <div className="empty-state">
            <div className="icon">
              <Icon name="activity" size={32} />
            </div>
            <p>Trigger the outage above to see who gets paid, and how much.</p>
          </div>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 14 }}>
              Nothing here is pushed automatically — settlement only makes an amount{" "}
              <strong>claimable</strong>. Each subscriber pulls their own share directly from the
              operator's bond, same as the real Dashboard's "Claim →" button.
            </p>
            <div className="status-table">
              <div className="status-table-head">
                <span>Subscriber</span>
                <span>Coverage</span>
                <span>Payout</span>
              </div>
              {SUBSCRIBERS.map((s) => {
                const p = payoutFor(s.subscribedHoursBefore);
                const isClaimed = claimed.has(s.name);
                const isClaiming = claiming === s.name;
                return (
                  <div className="status-row" key={s.name}>
                    <div className="name">{s.name}</div>
                    <div className="role">{s.note}</div>
                    <div className="detail">
                      {p.eligible ? (
                        <>
                          <div className="row between" style={{ gap: 12 }}>
                            <div>
                              <strong>{p.amount.toFixed(4)} CTC</strong>
                              <span className="evidence">
                                Covered <code>{p.coveredHours.toFixed(1)}h</code> of the 24h window
                                · {p.amount.toFixed(4)} = {FULL_AMOUNT} × {p.coveredHours.toFixed(1)}{" "}
                                / 24
                              </span>
                            </div>
                            {isClaimed ? (
                              <Tag tone="ok" flat>claimed</Tag>
                            ) : (
                              <button
                                className="btn green small"
                                onClick={() => claim(s.name)}
                                disabled={Boolean(claiming)}
                              >
                                {isClaiming ? "Claiming…" : "Claim →"}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <Tag tone="bad" flat>not eligible</Tag>
                          <span className="evidence">Joined after the compensation window had already closed</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
