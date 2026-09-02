// Dashboard — personal mission control. Renders one of four states:
//   • no wallet          → connect prompt
//   • wallet, not deployed → run-the-deploy hint
//   • connected, no cover → "Get Protected" (escrow.lockCoverage)
//   • connected, covered  → coverage details, backing bond health, claimable
//     outages (settlement.claim, with a pro-rata preview that mirrors the
//     contract), personal payout history, and withdraw.
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import { parseEther, zeroAddress } from "viem";
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import { useNetwork } from "../hooks/useNetwork";
import { useSubscription } from "../hooks/useSubscription";
import { useBondHealth } from "../hooks/useBondHealth";
import { useClaimableOutages } from "../hooks/useClaimableOutages";
import { useEventFeed } from "../hooks/useEventFeed";
import { getContract } from "../lib/contracts";
import { formatEth, formatDateTime, formatDuration, shortHash, timeAgo, explorerTx } from "../lib/format";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import Icon from "../components/ui/Icon";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { chainId, net, deployed, satelliteId, satKey } = useNetwork();
  const symbol = net?.nativeSymbol || "";

  const sub = useSubscription();
  const bond = useBondHealth();
  const claim = useClaimableOutages();
  const feed = useEventFeed();

  useDocumentMeta(
    "Dashboard",
    "Your SpaceShield coverage, claimable outages, and automatic payouts — connect a wallet to view and manage your satellite-outage protection."
  );

  const escrow = getContract(chainId, "escrow");
  const settlement = getContract(chainId, "settlement");
  const asc = getContract(chainId, "asc");

  // The operator lockCoverage must be pointed at (registered on the ASC).
  const operatorRead = useReadContract({
    address: asc?.address,
    abi: asc?.abi,
    functionName: "satelliteOperator",
    args: satKey ? [satKey] : undefined,
    chainId,
    query: { enabled: Boolean(asc && satKey) },
  });
  const operator = operatorRead.data;
  const operatorValid = operator && operator !== zeroAddress;

  const [amount, setAmount] = useState("0.1");
  const [pending, setPending] = useState(null); // "subscribe" | "withdraw" | outageId
  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const busy = isWriting || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      sub.refetch?.();
      claim.refetch?.();
      bond.refetch?.();
      feed.refetch?.();
      setPending(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  useEffect(() => {
    if (writeError) setPending(null);
  }, [writeError]);

  const amtNum = Number(amount);
  const amtValid = Number.isFinite(amtNum) && amtNum > 0;

  const subscribe = () => {
    if (!escrow || !operatorValid || !amtValid) return;
    reset();
    setPending("subscribe");
    writeContract({
      address: escrow.address,
      abi: escrow.abi,
      functionName: "lockCoverage",
      args: [satelliteId, operator],
      value: parseEther(String(amount)),
      chainId,
    });
  };

  const withdraw = () => {
    if (!escrow) return;
    reset();
    setPending("withdraw");
    writeContract({
      address: escrow.address,
      abi: escrow.abi,
      functionName: "withdrawCoverage",
      args: [satelliteId],
      chainId,
    });
  };

  const claimOutage = (outageId) => {
    if (!settlement) return;
    reset();
    setPending(outageId);
    writeContract({
      address: settlement.address,
      abi: settlement.abi,
      functionName: "claim",
      args: [outageId],
      chainId,
    });
  };

  const bondRow = bond.rows.find((r) => r.satelliteId === satelliteId) || null;
  const myPayouts = feed.items.filter(
    (it) =>
      it.type === "claimed" &&
      it.claimant &&
      address &&
      it.claimant.toLowerCase() === address.toLowerCase()
  );

  const errBox = writeError ? (
    <div className="callout warn" style={{ marginTop: 14 }}>
      <strong>Transaction failed.</strong> {writeError.shortMessage || writeError.message}
    </div>
  ) : null;

  // ── State 1: no wallet ────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div>
        <div className="page-head">
          <h1>Dashboard</h1>
          <p className="lede">Your coverage, claims, and payouts — all in one place.</p>
        </div>
        <Card>
          <div className="empty-state">
            <div className="icon">
              <Icon name="shield" size={32} />
            </div>
            <h3>Connect to see your coverage</h3>
            <p>
              SpaceShield pays you automatically when your satellite goes dark. Connect a wallet to
              view coverage, claim compensation, and manage your subscription.
            </p>
            <div style={{ marginTop: 18 }}>
              <ConnectButton />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── State 2: connected but network not deployed ───────────────────────────
  if (!deployed) {
    return (
      <div>
        <div className="page-head">
          <h1>Dashboard</h1>
          <p className="lede">Your coverage, claims, and payouts — all in one place.</p>
        </div>
        <div className="callout warn mono">
          <strong>{net?.name || "This network"} isn't deployed.</strong>{" "}
          {net?.isLocal === false ? (
            <>
              Run <code>npx hardhat run scripts/deploy-testnet.js --network creditcoinTestnet</code>{" "}
              (needs a funded <code>CC3_TESTNET_PRIVATE_KEY</code> — see README's "What you need to
              do"), then wire the printed addresses into <code>VITE_CC_TESTNET_*</code> and reload.
              Or switch back to Hardhat Local in your wallet.
            </>
          ) : (
            <>
              Start a local node (<code>npx hardhat node</code>) and run{" "}
              <code>node scripts/deploy.js</code>, then reload and reconnect.
            </>
          )}
        </div>
      </div>
    );
  }

  const protectedFor = sub.since
    ? formatDuration(Math.floor(Date.now() / 1000) - sub.since)
    : "—";

  return (
    <div>
      {/* Status hero — the one thing this page needs to say at a glance */}
      <motion.div
        className={`dash-hero ${sub.isActive ? "active" : ""}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={`dash-hero-icon ${sub.isActive ? "active" : ""}`}>
          <Icon name="shield" size={30} />
        </div>
        <div className="dash-hero-body">
          <div className="dash-hero-eyebrow">Dashboard · {satelliteId || "—"}</div>
          <div className="dash-hero-status">
            {sub.isActive ? "You're covered" : "Not protected yet"}
          </div>
          <div className="dash-hero-sub">
            {sub.isActive
              ? "Compensation is automatic — no claim forms, nothing to track."
              : "Lock coverage below and get paid automatically the moment your satellite goes dark."}
          </div>
        </div>
        {sub.isActive ? (
          <div className="dash-hero-stats">
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-num">{protectedFor}</div>
              <div className="dash-hero-stat-lab">Protected for</div>
            </div>
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-num">
                {bondRow ? formatEth(bondRow.perUser, { symbol, maxFrac: 3 }) : "—"}
              </div>
              <div className="dash-hero-stat-lab">Max payout</div>
            </div>
          </div>
        ) : null}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <Card>
          <CardHead
            title={sub.isActive ? "Coverage details" : "Get protected"}
            right={sub.isActive ? <Tag tone="ok">covered</Tag> : <Tag tone="warn">not covered</Tag>}
          />

          {sub.isActive ? (
            <>
              <div className="kv">
                <span className="k">Covered since</span>
                <span className="v">{formatDateTime(sub.since)}</span>
              </div>
              <div className="kv">
                <span className="k">Protected for</span>
                <span className="v">{protectedFor}</span>
              </div>
              <div className="kv">
                <span className="k">Max payout / outage</span>
                <span className="v">
                  {bondRow ? formatEth(bondRow.perUser, { symbol, maxFrac: 4 }) : "—"}
                </span>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <button
                  className="btn ghost small"
                  onClick={withdraw}
                  disabled={busy}
                >
                  {pending === "withdraw" && busy ? "Withdrawing…" : "Withdraw coverage"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="hint" style={{ marginBottom: 14 }}>
                Lock coverage with the registered operator. Your stake keeps coverage active; payouts
                come from the operator's bond, not your stake.
              </p>
              <label className="field-label" htmlFor="cover-amt">
                Coverage stake
              </label>
              <div className="input-suffix">
                <input
                  id="cover-amt"
                  className="input"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.1"
                />
                <span className="suffix">{symbol}</span>
              </div>
              {!operatorValid ? (
                <p className="hint mono" style={{ marginTop: 10 }}>
                  No operator is registered for {satelliteId} yet — run the deploy script.
                </p>
              ) : (
                <p className="hint mono" style={{ marginTop: 10 }}>
                  Operator {shortHash(operator)} · payout{" "}
                  {bondRow ? formatEth(bondRow.perUser, { symbol, maxFrac: 4 }) : "—"} per outage
                </p>
              )}
              <div className="row" style={{ marginTop: 16 }}>
                <button
                  className="btn green"
                  onClick={subscribe}
                  disabled={busy || !operatorValid || !amtValid}
                >
                  {pending === "subscribe" && busy ? "Getting protected…" : "Get protected →"}
                </button>
              </div>
            </>
          )}
          {errBox}
        </Card>
      </motion.div>

      {/* Active-subscriber extras */}
      {sub.isActive ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
        >
          {/* Backing bond */}
          <Card style={{ marginTop: 22 }}>
            <CardHead
              title="Backing bond"
              right={
                bondRow ? (
                  <Tag tone={bondRow.healthy ? "ok" : "bad"}>
                    {bondRow.healthy ? "healthy" : "at risk"}
                  </Tag>
                ) : null
              }
            />
            {bondRow ? (
              <div className="grid cols-3">
                <div className="kv">
                  <span className="k">Bond balance</span>
                  <span className="v">{formatEth(bondRow.balance, { symbol, maxFrac: 3 })}</span>
                </div>
                <div className="kv">
                  <span className="k">Subscribers</span>
                  <span className="v">{bondRow.subscribers}</span>
                </div>
                <div className="kv">
                  <span className="k">Survivable outages</span>
                  <span className="v">
                    {bondRow.survivable === null ? "∞" : `${bondRow.survivable}×`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="hint">Backing bond details unavailable.</p>
            )}
          </Card>

          {/* Claimable outages */}
          <Card style={{ marginTop: 22 }}>
            <CardHead
              title="Claimable outages"
              right={<span className="hint mono">{claim.claimable.length} ready</span>}
            />
            {claim.claimable.length ? (
              <div className="stack">
                {claim.claimable.map((r) => {
                  const coveredSec = r.windowEnd - Math.max(claim.subStart, r.windowStart);
                  const fullSec = r.windowEnd - r.windowStart;
                  return (
                    <div className="claimrow" key={r.outageId}>
                      <div className="row between">
                        <div>
                          <div className="claim-amt">{formatEth(r.amount, { symbol, maxFrac: 4 })}</div>
                          <div className="hint mono">outage {shortHash(r.outageId)}</div>
                        </div>
                        <button
                          className="btn green small"
                          onClick={() => claimOutage(r.outageId)}
                          disabled={busy}
                        >
                          {pending === r.outageId && busy ? "Claiming…" : "Claim →"}
                        </button>
                      </div>
                      {r.partial ? (
                        <div style={{ marginTop: 8 }}>
                          <Tag tone="warn">
                            partial · covers {formatDuration(coveredSec)} of {formatDuration(fullSec)}
                          </Tag>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">
                  <Icon name="check" size={32} />
                </div>
                <p>
                  No outages to claim. When your satellite goes dark, compensation shows up here
                  automatically — trigger one on the Network page to see it.
                </p>
              </div>
            )}

            {/* Non-claimable rows for context */}
            {claim.rows.filter((r) => r.claimed || !r.eligible).length ? (
              <div className="substack">
                {claim.rows
                  .filter((r) => r.claimed || !r.eligible)
                  .map((r) => (
                    <div className="kv" key={r.outageId}>
                      <span className="k">outage {shortHash(r.outageId)}</span>
                      <span className="v">
                        {r.claimed ? (
                          <Tag tone="ok">claimed</Tag>
                        ) : (
                          <span className="hint">{r.reason}</span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}
            {errBox}
          </Card>

          {/* Personal payout history */}
          {myPayouts.length ? (
            <Card style={{ marginTop: 22 }}>
              <CardHead title="Your payouts" right={<span className="hint mono">{myPayouts.length}</span>} />
              <div className="stack">
                {myPayouts.map((it) => {
                  const link = explorerTx(net, it.txHash);
                  return (
                    <div className="kv" key={it.key}>
                      <span className="k">
                        {formatEth(it.amount, { symbol, maxFrac: 4 })}
                        {it.fullAmount && it.amount !== it.fullAmount ? (
                          <span className="hint"> of {formatEth(it.fullAmount, { symbol })}</span>
                        ) : null}
                      </span>
                      <span className="v row" style={{ gap: 10 }}>
                        <span className="hint">{it.ts ? timeAgo(it.ts) : `#${it.blockNumber}`}</span>
                        {link ? (
                          <a className="linkbtn" href={link} target="_blank" rel="noreferrer">
                            tx ↗
                          </a>
                        ) : (
                          <code className="inline">{shortHash(it.txHash)}</code>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}
