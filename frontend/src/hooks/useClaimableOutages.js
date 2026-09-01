// Outages the connected wallet can (or can't yet) claim for the active satellite.
// Mirrors SettlementContract.claim()'s exact eligibility + pro-rata math so the
// Dashboard preview equals what the chain will actually pay: eligibility is live
// (isActiveSubscriberByKey), payout is perUser × coveredWindowFraction, capped at
// the operator's remaining bond, minus anything already claimed.
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { getEvents } from "../lib/events";
import { getContract, ABIS } from "../lib/contracts";
import { useNetwork } from "./useNetwork";

const FALLBACK_WINDOW = 86400n; // COMPENSATION_WINDOW = 1 days

export function useClaimableOutages() {
  const { address } = useAccount();
  const { chainId, net, deployed, satKey } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const escrow = getContract(chainId, "escrow");
  const settlement = getContract(chainId, "settlement");
  const enabled = Boolean(publicClient && deployed && escrow && settlement && satKey && address);

  const query = useQuery({
    queryKey: ["claimable", chainId, address, net?.addresses?.settlement],
    enabled,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // Compensation window (constant) + live coverage state, read once.
      const [windowRaw, isActive, subStartRaw] = await Promise.all([
        publicClient
          .readContract({ address: settlement.address, abi: ABIS.settlement, functionName: "COMPENSATION_WINDOW" })
          .catch(() => FALLBACK_WINDOW),
        publicClient.readContract({
          address: escrow.address,
          abi: ABIS.escrow,
          functionName: "isActiveSubscriberByKey",
          args: [satKey, address],
        }),
        publicClient.readContract({
          address: escrow.address,
          abi: ABIS.escrow,
          functionName: "subscriptionStartByKey",
          args: [satKey, address],
        }),
      ]);
      const windowSec = BigInt(windowRaw || FALLBACK_WINDOW);
      const subStart = BigInt(subStartRaw || 0n);

      // All registered outages, filtered client-side to this satellite
      // (satelliteKey isn't an indexed topic on OutageRegistered).
      const regs = await getEvents(publicClient, {
        address: settlement.address,
        abiKey: "settlement",
        eventName: "OutageRegistered",
      });
      const mine = regs.filter((e) => e.args?.satelliteKey === satKey);

      const rows = await Promise.all(
        mine.map(async (e) => {
          const outageId = e.args.outageId;
          const operator = e.args.operator;
          const windowStart = BigInt(e.args.windowStart);

          const [claimed, bond] = await Promise.all([
            publicClient.readContract({
              address: settlement.address,
              abi: ABIS.settlement,
              functionName: "hasClaimed",
              args: [outageId, address],
            }),
            publicClient.readContract({
              address: settlement.address,
              abi: ABIS.settlement,
              functionName: "bonds",
              args: [operator],
            }),
          ]);
          const balance = bond[0];
          const perUser = bond[1];
          const windowEnd = windowStart + windowSec;
          const effectiveStart = subStart > windowStart ? subStart : windowStart;

          let eligible = true;
          let reason = "";
          let amount = 0n;

          if (!isActive || subStart === 0n) {
            eligible = false;
            reason = "Coverage not active for this satellite";
          } else if (effectiveStart >= windowEnd) {
            eligible = false;
            reason = "Coverage started after the compensated window closed";
          } else {
            const coveredDuration = windowEnd - effectiveStart;
            const proratedOwed = (perUser * coveredDuration) / windowSec;
            amount = proratedOwed > balance ? balance : proratedOwed;
            if (amount === 0n) {
              eligible = false;
              reason = "Operator bond depleted — retry after top-up";
            }
          }

          const partial = eligible && effectiveStart > windowStart;

          return {
            outageId,
            operator,
            windowStart: Number(windowStart),
            windowEnd: Number(windowEnd),
            claimed: Boolean(claimed),
            eligible,
            reason,
            amount, // bigint wei
            fullAmount: perUser, // bigint wei
            partial,
            bondBalance: balance,
          };
        })
      );

      rows.sort((a, b) => b.windowStart - a.windowStart);
      return { rows, isActive: Boolean(isActive), subStart: Number(subStart) };
    },
  });

  const data = query.data || { rows: [], isActive: false, subStart: 0 };
  const claimable = data.rows.filter((r) => r.eligible && !r.claimed && r.amount > 0n);

  return {
    rows: data.rows,
    claimable,
    isActive: data.isActive,
    subStart: data.subStart,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
