// Settings / Profile — wallet identity, network + contract addresses (with copy
// and explorer links), single-satellite selector, and notification toggles that
// are LOCAL-ONLY (persisted to localStorage; there is no backend yet).
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import { Card, CardHead } from "../components/ui/Card";
import { Tag } from "../components/ui/Badge";
import { useNetwork } from "../hooks/useNetwork";
import { shortAddr, copyToClipboard, explorerAddr } from "../lib/format";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import Icon from "../components/ui/Icon";

const NOTIF_KEY = "spaceshield.notifs";
const DEFAULT_NOTIFS = { outage: true, settlement: true, bondRisk: false };

function useLocalNotifs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...DEFAULT_NOTIFS, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}") };
    } catch {
      return DEFAULT_NOTIFS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [prefs]);
  return [prefs, setPrefs];
}

function CopyLine({ label, value, href }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v row" style={{ gap: 8 }}>
        <code className="inline">{shortAddr(value, 6)}</code>
        <button
          className="linkbtn"
          onClick={async () => {
            if (await copyToClipboard(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
        {href ? (
          <a className="linkbtn" href={href} target="_blank" rel="noreferrer">
            explorer ↗
          </a>
        ) : null}
      </span>
    </div>
  );
}

export default function Settings() {
  const { address, isConnected } = useAccount();
  const { net, deployed, satelliteId } = useNetwork();
  const [prefs, setPrefs] = useLocalNotifs();

  useDocumentMeta(
    "Settings",
    "Your wallet identity, the active network and contract addresses, and local notification preferences (stored in your browser only)."
  );

  const addrs = net?.addresses || {};
  const contractRows = [
    ["Escrow", addrs.escrow],
    ["ASC (Attestcoin)", addrs.asc],
    ["Settlement", addrs.settlement],
    ["Source (telemetry)", addrs.source],
  ];

  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
        <p className="lede">Your wallet, the active network, and local preferences.</p>
      </div>

      <div className="grid cols-2">
        {/* Wallet */}
        <Card>
          <CardHead
            title="Wallet"
            right={isConnected ? <Tag tone="ok">connected</Tag> : <Tag tone="warn">not connected</Tag>}
          />
          {isConnected ? (
            <CopyLine
              label="Address"
              value={address}
              href={explorerAddr(net, address)}
            />
          ) : (
            <div className="empty-state">
              <div className="icon">
                <Icon name="key" size={32} />
              </div>
              <p>Connect a wallet from the top bar to see your address.</p>
            </div>
          )}
        </Card>

        {/* Network */}
        <Card>
          <CardHead
            title="Network"
            right={deployed ? <Tag tone="ok">deployed</Tag> : <Tag tone="bad">not deployed</Tag>}
          />
          <div className="kv">
            <span className="k">Name</span>
            <span className="v">{net?.name || "Unknown"}</span>
          </div>
          <div className="kv">
            <span className="k">Chain ID</span>
            <span className="v">{net?.chainId ?? "—"}</span>
          </div>
          <div className="kv">
            <span className="k">RPC</span>
            <span className="v">
              <code className="inline">{net?.rpcUrl || "—"}</code>
            </span>
          </div>
          <div className="kv">
            <span className="k">Native token</span>
            <span className="v">{net?.nativeSymbol || "—"}</span>
          </div>
        </Card>
      </div>

      {/* Satellite selector */}
      <Card style={{ marginTop: 22 }}>
        <CardHead title="Satellite" right={<span className="hint mono">single-satellite MVP</span>} />
        <label className="field-label" htmlFor="sat-select">
          Monitored satellite
        </label>
        <select id="sat-select" className="select" value={satelliteId || ""} disabled>
          <option value={satelliteId || ""}>{satelliteId || "none"}</option>
        </select>
        <p className="hint mono" style={{ marginTop: 10 }}>
          Multi-satellite selection is post-MVP. The active satellite is fixed by the deployment.
        </p>
      </Card>

      {/* Contract addresses */}
      <Card style={{ marginTop: 22 }}>
        <CardHead title="Contracts" />
        {deployed ? (
          contractRows.map(([label, value]) => (
            <CopyLine key={label} label={label} value={value} href={explorerAddr(net, value)} />
          ))
        ) : (
          <div className="empty-state">
            <div className="icon">
              <Icon name="file" size={32} />
            </div>
            <p>No contract addresses on this network yet.</p>
          </div>
        )}
      </Card>

      {/* Notifications (local only) */}
      <Card style={{ marginTop: 22 }}>
        <CardHead
          title="Notifications"
          right={<Tag tone="warn">local only · no backend</Tag>}
        />
        <p className="hint mono" style={{ marginBottom: 14 }}>
          Preferences are stored in this browser only. Nothing is sent anywhere — wiring these to a
          real notifier is post-MVP.
        </p>
        {[
          ["outage", "Outage detected on my satellite"],
          ["settlement", "Compensation becomes claimable"],
          ["bondRisk", "Backing bond drops below the healthy floor"],
        ].map(([k, label]) => (
          <label className="toggle-row" key={k}>
            <span>{label}</span>
            <input type="checkbox" checked={!!prefs[k]} onChange={() => toggle(k)} />
          </label>
        ))}
      </Card>

      <div className="row" style={{ marginTop: 22, gap: 10 }}>
        <Link className="btn ghost small" to="/app/network">
          Network status
        </Link>
        <Link className="btn ghost small" to="/app/history">
          Settlement history
        </Link>
      </div>
    </div>
  );
}
