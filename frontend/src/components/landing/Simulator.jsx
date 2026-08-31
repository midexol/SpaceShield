// Marketing simulator — a faithful React port of the prototype's runSimulation.
// Deliberately illustrative (fake timers/values); the real, on-chain version lives
// in the app's Network → Trigger Outage flow. Kept here so the landing still tells
// the story at a glance.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../../lib/animations";

const STAGES = [
  {
    num: "1",
    tag: "SPACECOIN",
    h: "Outage recorded",
    p: "SatelliteStatusChanged emits isOnline=false after the confirmation threshold is crossed.",
    label: "status",
  },
  {
    num: "2",
    tag: "AI AGENT",
    h: "Cross-checked",
    p: "RPC status compared against public tracking data before anything is triggered.",
    label: "confirmations",
  },
  {
    num: "3",
    tag: "ATTESTCOIN",
    h: "Proof verified",
    p: "Merkle + continuity proof checked synchronously by the Block Prover precompile.",
    label: "proof",
  },
  {
    num: "4",
    tag: "CREDITCOIN",
    h: "Bond settled",
    p: "Compensation released from the operator's locked bond directly to affected users.",
    label: "payout",
  },
];
const REVEALED = ["OFFLINE", "6/6 confirmed", "VALID (0x0FD2)", "3.20 CTC → 118 users"];
const DURATIONS = [2600, 4200, 5100, 3100];
const TOTAL = DURATIONS.reduce((a, b) => a + b, 0);

export default function Simulator() {
  const [status, setStatus] = useState(() => STAGES.map(() => "idle"));
  const [vals, setVals] = useState(() => STAGES.map(() => "•••"));
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [receipt, setReceipt] = useState("idle"); // idle | awaiting | settled
  const timers = useRef([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
    },
    []
  );

  const run = () => {
    if (running) return;
    setRunning(true);
    setReceipt("awaiting");
    setStatus(STAGES.map(() => "idle"));
    setVals(STAGES.map(() => "•••"));
    setProgress(0);
    setElapsed(0);

    const reduced = prefersReducedMotion();
    const dur = reduced ? Math.max(300, TOTAL / 6) : TOTAL;
    const scale = dur / TOTAL;
    const start = performance.now();

    const timer = setInterval(() => {
      const e = (performance.now() - start) / 1000;
      setElapsed(e);
      setProgress(Math.min(100, ((e * 1000) / dur) * 100));
    }, 80);
    timers.current.push(timer);

    let cumulative = 0;
    DURATIONS.forEach((raw, i) => {
      const d = raw * scale;
      cumulative += d;
      const to = setTimeout(() => {
        setStatus((prev) => prev.map((s, idx) => (idx < i ? "done" : idx === i ? "active" : s)));
        setVals((prev) => prev.map((v, idx) => (idx === i ? REVEALED[i] : v)));
      }, cumulative - d);
      timers.current.push(to);
    });

    const end = setTimeout(() => {
      clearInterval(timer);
      setStatus(STAGES.map(() => "done"));
      setProgress(100);
      setElapsed(TOTAL / 1000);
      setReceipt("settled");
      setRunning(false);
    }, cumulative + 200);
    timers.current.push(end);
  };

  return (
    <section id="simulate" className="tight">
      <div className="wrap">
        <div className="eyebrow reveal">02 · Watch it happen</div>
        <h2 className="reveal">Four stages. One transaction chain.</h2>
        <p className="lede reveal">
          This is a simulated run — timings and values are illustrative, not a live testnet call.
          For the real pipeline against live contracts,{" "}
          <Link to="/app/network" style={{ color: "var(--green)", borderBottom: "1px solid var(--green)" }}>
            launch the app and trigger an outage
          </Link>
          .
        </p>

        <div className="sim-shell reveal">
          <div className="sim-head">
            <div className="sim-title">SETTLEMENT PIPELINE · SAT-014 / Cross River, NG</div>
            <div className="sim-timer">
              ELAPSED <span className="tval">{elapsed.toFixed(1)}s</span>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="stages">
            {STAGES.map((st, i) => (
              <div className={`stage ${status[i] === "idle" ? "" : status[i]}`} key={st.num}>
                <div className="stage-num">
                  <span className="ring">{status[i] === "done" ? "✓" : st.num}</span> {st.tag}
                </div>
                <h4>{st.h}</h4>
                <p>{st.p}</p>
                <div className="val">
                  {st.label}: <span>{vals[i]}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="sim-footer">
            <div className="sim-receipt">
              {receipt === "idle" && <>No claims filed. No case number.</>}
              {receipt === "awaiting" && <>Awaiting confirmation from Spacecoin chain…</>}
              {receipt === "settled" && (
                <>
                  Settled in {(TOTAL / 1000).toFixed(1)}s.{" "}
                  <span className="settled pop">No claims filed.</span>
                </>
              )}
            </div>
            <button className="btn" onClick={run} disabled={running}>
              {running ? "Simulating…" : receipt === "settled" ? "Run again →" : "Simulate outage →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
