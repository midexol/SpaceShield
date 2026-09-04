// The Trigger Outage modal. Opening it immediately runs the real pipeline
// (lib/demoTrigger) — locally with the deployment's throwaway key, or on
// Creditcoin testnet with the connected wallet plus the Oracle Worker for
// the one step that needs a registered oracle — and animates each stage
// from the actual tx/receipt progress, no fake timers. Closing is disabled
// while a run is in flight. On success it calls onComplete(result) so the
// Network page can refetch its live reads.
import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { runTriggerOutage, runTriggerOutageTestnet, TRIGGER_STAGES } from "../../lib/demoTrigger";
import { LOCAL_CHAIN_ID } from "../../config/networks";
import { shortHash, explorerTx } from "../../lib/format";

const initStages = () => TRIGGER_STAGES.map(() => ({ status: "idle", note: "" }));

export default function PipelineModal({ open, onClose, network, chainId, onComplete }) {
  const [stages, setStages] = useState(initStages);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);
  const activeIdxRef = useRef(0);
  const isLocal = chainId === LOCAL_CHAIN_ID;
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: isLocal ? undefined : chainId });
  const publicClient = usePublicClient({ chainId: isLocal ? undefined : chainId });

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true; // set synchronously so StrictMode double-mount can't double-run
    setStages(initStages());
    setResult(null);
    setError(null);
    setRunning(true);

    const onStage = (i, patch) => {
      activeIdxRef.current = i;
      setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    };

    const run = isLocal
      ? runTriggerOutage({ network, chainId, onStage })
      : (address
          ? runTriggerOutageTestnet({ network, chainId, walletClient, publicClient, onStage })
          : Promise.reject(new Error("Connect a wallet first.")));

    run
      .then((res) => {
        setResult(res);
        setRunning(false);
        onComplete?.(res);
      })
      .catch((err) => {
        const msg = err?.shortMessage || err?.message || String(err);
        setError(msg);
        setRunning(false);
        setStages((prev) =>
          prev.map((s, idx) =>
            idx === activeIdxRef.current ? { ...s, status: "failed", note: msg } : s
          )
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) startedRef.current = false; // re-arm for the next open
  }, [open]);

  if (!open) return null;

  const doneCount = stages.filter((s) => s.status === "done").length;
  const progress = (doneCount / stages.length) * 100;
  const txLink = result ? explorerTx(network, result.txHash) : null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Trigger outage pipeline">
        <div className="modal-head">
          <h3>Live outage pipeline</h3>
          <button className="modal-close" onClick={onClose} disabled={running} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="callout warn mono" style={{ marginBottom: 16 }}>
            {isLocal ? (
              <>
                <strong>Local demo · chain 31337.</strong> Runs as the deployment's throwaway
                oracle key. Every stage below is a real transaction against your Hardhat node.
              </>
            ) : (
              <>
                <strong>{network?.name || "Creditcoin testnet"}.</strong> Your wallet signs every
                step it's able to (reporting the outage, and the real Attestcoin precompile call —
                neither needs special permission). Only the final step, which needs a registered
                oracle, is handled by the Oracle Worker — it independently re-checks your
                precompile transaction before attesting to it. Approve each prompt in your wallet.
              </>
            )}
          </div>

          <div className="sim-shell flush">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="stages">
              {TRIGGER_STAGES.map((st, i) => {
                const s = stages[i];
                const cls = s.status === "idle" ? "" : s.status;
                return (
                  <div className={`stage ${cls}`} key={st.key}>
                    <div className="stage-num">
                      <span className="ring">{s.status === "done" ? "✓" : st.num}</span>
                      {st.sub}
                    </div>
                    <h4>{st.title}</h4>
                    <p>{s.note || "Waiting…"}</p>
                    {st.key === "detect" && s.confirmations != null ? (
                      <div className="val">confirmations: {s.confirmations}</div>
                    ) : null}
                    {s.merkleProof ? (
                      <div className="val">merkle root: {shortHash(s.merkleProof.root)}</div>
                    ) : null}
                    {s.continuityProof ? (
                      <div className="val">
                        continuity: {shortHash(s.continuityProof.lowerEndpointDigest)} ·{" "}
                        {s.continuityProof.roots.length} root{s.continuityProof.roots.length === 1 ? "" : "s"}
                      </div>
                    ) : null}
                    {s.outageId ? <div className="val">outageId: {shortHash(s.outageId)}</div> : null}
                    {s.txHash ? <div className="val">tx: {shortHash(s.txHash)}</div> : null}
                  </div>
                );
              })}
            </div>
            <div className="sim-footer">
              <div className="sim-receipt">
                {running ? (
                  <span>
                    <span className="spin">◍</span> Running pipeline…
                  </span>
                ) : null}
                {result ? (
                  <span className="settled pop">
                    ✓ Settlement registered — now claimable on your Dashboard
                  </span>
                ) : null}
                {error ? <span style={{ color: "var(--rust)" }}>✕ {error}</span> : null}
              </div>
              <div className="row">
                {txLink ? (
                  <a className="btn ghost small" href={txLink} target="_blank" rel="noreferrer">
                    View tx ↗
                  </a>
                ) : null}
                <button className="btn small" onClick={onClose} disabled={running}>
                  {result || error ? "Close" : "Running…"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
