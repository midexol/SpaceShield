// Shared presentation helpers for protocol events (used by Network's recent-activity
// feed and the History timeline) so the two stay consistent. Pure functions only.
import { shortHash, formatEth, timeAgo } from "./format";

// Maps an event type to a Timeline marker color.
export function eventMarker(type) {
  if (type === "verified") return "verified";
  if (type === "registered" || type === "claimed") return "settled";
  return "status";
}

export function eventTitle(it, symbol = "") {
  switch (it.type) {
    case "status":
      return it.isOnline ? "Telemetry · ONLINE" : "Telemetry · OFFLINE";
    case "verified":
      return `Outage verified · ${shortHash(it.outageId)}`;
    case "registered":
      return `Settlement registered · ${shortHash(it.outageId)}`;
    case "claimed":
      return `Compensation claimed · ${formatEth(it.amount, { symbol })}`;
    default:
      return it.type;
  }
}

export function eventSub(it) {
  switch (it.type) {
    case "status":
      return `${it.confirmations ?? 0} confirmations · ${it.location ?? "—"}`;
    case "verified":
      return it.blockHeight ? `block height ${it.blockHeight}` : "precompile-verified";
    case "registered":
      return it.operator ? `operator ${shortHash(it.operator)}` : "settlement opened";
    case "claimed":
      return it.claimant ? `paid to ${shortHash(it.claimant)}` : "";
    default:
      return "";
  }
}

export function eventRight(it) {
  return it.ts ? timeAgo(it.ts) : `#${it.blockNumber ?? "?"}`;
}
