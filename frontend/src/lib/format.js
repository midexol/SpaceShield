// Small formatting helpers shared across screens. Keep display logic here so the
// components stay about layout, not string-fiddling.
import { formatEther } from "viem";

export function shortAddr(addr, size = 4) {
  if (!addr) return "—";
  const s = String(addr);
  if (s.length <= size * 2 + 2) return s;
  return `${s.slice(0, size + 2)}…${s.slice(-size)}`;
}

export function shortHash(hash, size = 6) {
  if (!hash) return "—";
  const s = String(hash);
  if (s.length <= size * 2 + 2) return s;
  return `${s.slice(0, size + 2)}…${s.slice(-size)}`;
}

// Ether/native amount with trailing-zero trim. `wei` may be bigint | string | number.
export function formatEth(wei, { symbol = "", maxFrac = 4 } = {}) {
  if (wei === null || wei === undefined) return "—";
  let s;
  try {
    s = formatEther(typeof wei === "bigint" ? wei : BigInt(wei));
  } catch {
    return "—";
  }
  if (s.includes(".")) {
    const [int, frac] = s.split(".");
    const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
    s = trimmed ? `${int}.${trimmed}` : int;
  }
  return symbol ? `${s} ${symbol}` : s;
}

const SEC = 1,
  MIN = 60,
  HOUR = 3600,
  DAY = 86400;

export function timeAgo(unixSeconds) {
  if (!unixSeconds) return "—";
  const now = Math.floor(Date.now() / 1000);
  let diff = now - Number(unixSeconds);
  const future = diff < 0;
  diff = Math.abs(diff);
  let out;
  if (diff < MIN) out = `${Math.max(1, Math.floor(diff / SEC))}s`;
  else if (diff < HOUR) out = `${Math.floor(diff / MIN)}m`;
  else if (diff < DAY) out = `${Math.floor(diff / HOUR)}h`;
  else out = `${Math.floor(diff / DAY)}d`;
  return future ? `in ${out}` : `${out} ago`;
}

export function formatDateTime(unixSeconds) {
  if (!unixSeconds) return "—";
  const d = new Date(Number(unixSeconds) * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "0m";
  if (s < HOUR) return `${Math.round(s / MIN)}m`;
  if (s < DAY) return `${(s / HOUR).toFixed(1)}h`;
  return `${(s / DAY).toFixed(2)}d`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    return false;
  }
}

export function explorerTx(net, hash) {
  return net?.explorerUrl && hash ? `${net.explorerUrl.replace(/\/$/, "")}/tx/${hash}` : null;
}

export function explorerAddr(net, addr) {
  return net?.explorerUrl && addr
    ? `${net.explorerUrl.replace(/\/$/, "")}/address/${addr}`
    : null;
}
