// A merged, chronological feed of every protocol event, used by History (and the
// "recent activity" cards on Network). Fetches the four event types, resolves each
// log's block timestamp, and normalizes them into a single sortable shape.
//
// Note: SatelliteStatusChanged.satelliteId is an INDEXED string, so its topic is a
// hash, not the readable id — but the other fields (isOnline, confirmations, …) are
// available, and in this single-satellite demo we label everything with the active
// network's satelliteId. OutageVerified/OperatorRegistered carry the string plainly.
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { getEvents, blockTimestamps } from "../lib/events";
import { getContract } from "../lib/contracts";
import { useNetwork } from "./useNetwork";

export function useEventFeed() {
  const { chainId, net, deployed, satelliteId } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const source = getContract(chainId, "source");
  const asc = getContract(chainId, "asc");
  const settlement = getContract(chainId, "settlement");
  const enabled = Boolean(publicClient && deployed && source && asc && settlement);

  const query = useQuery({
    queryKey: ["eventFeed", chainId, net?.addresses?.settlement],
    enabled,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const [statusEv, verifiedEv, registeredEv, claimedEv] = await Promise.all([
        getEvents(publicClient, { address: source.address, abiKey: "source", eventName: "SatelliteStatusChanged" }),
        getEvents(publicClient, { address: asc.address, abiKey: "asc", eventName: "OutageVerified" }),
        getEvents(publicClient, { address: settlement.address, abiKey: "settlement", eventName: "OutageRegistered" }),
        getEvents(publicClient, { address: settlement.address, abiKey: "settlement", eventName: "CompensationClaimed" }),
      ]);

      const all = [
        ...statusEv.map((e) => ({ type: "status", e })),
        ...verifiedEv.map((e) => ({ type: "verified", e })),
        ...registeredEv.map((e) => ({ type: "registered", e })),
        ...claimedEv.map((e) => ({ type: "claimed", e })),
      ];

      const tsMap = await blockTimestamps(
        publicClient,
        chainId,
        all.map((x) => x.e.blockNumber)
      );

      const items = all.map(({ type, e }) => {
        const a = e.args || {};
        return {
          key: `${type}-${e.transactionHash}-${e.logIndex}`,
          type,
          ts: tsMap.get(e.blockNumber?.toString()) || 0,
          blockNumber: e.blockNumber,
          logIndex: e.logIndex,
          txHash: e.transactionHash,
          satelliteId,
          outageId: a.outageId ?? null,
          operator: a.operator ?? null,
          claimant: a.claimant ?? null,
          amount: a.amount ?? null,
          fullAmount: a.fullAmount ?? null,
          isOnline: a.isOnline ?? null,
          confirmations: a.confirmations != null ? Number(a.confirmations) : null,
          location: a.location ?? null,
          blockHeight: a.blockHeight != null ? a.blockHeight.toString() : null,
          windowStart: a.windowStart != null ? Number(a.windowStart) : null,
        };
      });

      items.sort(
        (x, y) =>
          Number(y.blockNumber - x.blockNumber) || y.logIndex - x.logIndex
      );
      return items;
    },
  });

  return { items: query.data || [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}
