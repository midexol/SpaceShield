// Live satellite telemetry: MockSpacecoinSource.getStatus(satelliteId).
// Polls every 8s so the Network page reflects a Trigger Outage in near-real-time.
import { useReadContract } from "wagmi";
import { getContract } from "../lib/contracts";
import { useNetwork } from "./useNetwork";

export function useSatelliteStatus() {
  const { chainId, satelliteId } = useNetwork();
  const c = getContract(chainId, "source");
  const enabled = Boolean(c && satelliteId);

  const query = useReadContract({
    address: c?.address,
    abi: c?.abi,
    functionName: "getStatus",
    args: satelliteId ? [satelliteId] : undefined,
    chainId,
    query: { enabled, refetchInterval: 8000 },
  });

  const d = query.data;
  const status = d
    ? {
        isOnline: Boolean(d[0]),
        lastContact: Number(d[1]),
        confirmations: Number(d[2]),
        location: d[3],
      }
    : null;

  return {
    status,
    satelliteId,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
