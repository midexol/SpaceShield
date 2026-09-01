// Bond health per operator — the browser port of scripts/monitor_bonds.js.
// Rebuilds each satellite's active-subscriber set by replaying the escrow's
// CoverageLocked/CoverageWithdrawn logs (the escrow deliberately exposes no
// enumeration), then reads each operator's bond and computes how many full
// per-user payouts it can survive. Healthy floor is 3, same as the ops script.
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { getEvents } from "../lib/events";
import { getContract, ABIS } from "../lib/contracts";
import { satelliteKey } from "../lib/demoTrigger";
import { useNetwork } from "./useNetwork";

export const HEALTHY_FLOOR = 3;

export function useBondHealth() {
  const { chainId, net, deployed } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const escrow = getContract(chainId, "escrow");
  const asc = getContract(chainId, "asc");
  const settlement = getContract(chainId, "settlement");
  const enabled = Boolean(publicClient && deployed && escrow && asc && settlement);

  const query = useQuery({
    queryKey: ["bondHealth", chainId, net?.addresses?.settlement],
    enabled,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // 1) Active subscribers per satelliteKey via event replay.
      const [locked, withdrawn] = await Promise.all([
        getEvents(publicClient, { address: escrow.address, abiKey: "escrow", eventName: "CoverageLocked" }),
        getEvents(publicClient, { address: escrow.address, abiKey: "escrow", eventName: "CoverageWithdrawn" }),
      ]);
      const ordered = [
        ...locked.map((e) => ({ e, kind: "lock" })),
        ...withdrawn.map((e) => ({ e, kind: "withdraw" })),
      ].sort(
        (a, b) =>
          Number(a.e.blockNumber - b.e.blockNumber) || a.e.logIndex - b.e.logIndex
      );
      const bySatKey = new Map();
      for (const { e, kind } of ordered) {
        const k = e.args.satelliteKey;
        if (!bySatKey.has(k)) bySatKey.set(k, new Set());
        const set = bySatKey.get(k);
        if (kind === "lock") set.add(e.args.user);
        else set.delete(e.args.user);
      }

      // 2) Operators per satellite via OperatorRegistered (satelliteId is not
      //    indexed, so the real string is available here).
      const regs = await getEvents(publicClient, {
        address: asc.address,
        abiKey: "asc",
        eventName: "OperatorRegistered",
      });

      const seen = new Set();
      const rows = [];
      for (const ev of regs) {
        const satelliteId = ev.args.satelliteId;
        const operator = ev.args.operator;
        if (seen.has(satelliteId)) continue; // last registration wins in-contract; dedupe here
        seen.add(satelliteId);

        const satKey = satelliteKey(satelliteId);
        const count = BigInt(bySatKey.get(satKey)?.size ?? 0);

        const bond = await publicClient.readContract({
          address: settlement.address,
          abi: ABIS.settlement,
          functionName: "bonds",
          args: [operator],
        });
        const balance = bond[0];
        const perUser = bond[1];
        const oneFullPayout = perUser * count;
        const survivable = oneFullPayout > 0n ? balance / oneFullPayout : null; // null → effectively ∞
        const healthy = oneFullPayout === 0n || survivable >= BigInt(HEALTHY_FLOOR);

        rows.push({
          satelliteId,
          operator,
          balance,
          perUser,
          subscribers: Number(count),
          survivable: survivable === null ? null : Number(survivable),
          healthy,
        });
      }
      return rows;
    },
  });

  const rows = query.data || [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.bond += r.balance;
      acc.subscribers += r.subscribers;
      return acc;
    },
    { bond: 0n, subscribers: 0 }
  );

  return { rows, totals, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}
