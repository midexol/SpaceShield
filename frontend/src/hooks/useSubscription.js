// The connected wallet's coverage status for the active satellite, read live from
// SpacecoinEscrow (isActiveSubscriberByKey + subscriptionStartByKey) — the same
// two reads SettlementContract.claim() trusts at claim time.
import { useAccount, useReadContracts } from "wagmi";
import { getContract } from "../lib/contracts";
import { useNetwork } from "./useNetwork";

export function useSubscription() {
  const { address, isConnected } = useAccount();
  const { chainId, satKey, satelliteId } = useNetwork();
  const c = getContract(chainId, "escrow");
  const enabled = Boolean(c && satKey && address);

  const query = useReadContracts({
    contracts: enabled
      ? [
          {
            address: c.address,
            abi: c.abi,
            functionName: "isActiveSubscriberByKey",
            args: [satKey, address],
            chainId,
          },
          {
            address: c.address,
            abi: c.abi,
            functionName: "subscriptionStartByKey",
            args: [satKey, address],
            chainId,
          },
        ]
      : [],
    query: { enabled, refetchInterval: 10000 },
  });

  const [activeRes, startRes] = query.data || [];
  const isActive = Boolean(activeRes?.result);
  const since = startRes?.result ? Number(startRes.result) : 0;

  return {
    isConnected,
    address,
    isActive,
    since,
    satelliteId,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
