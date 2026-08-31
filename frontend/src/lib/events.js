// Low-level on-chain event access via a viem public client (from wagmi's
// usePublicClient). Hooks build on top of these; screens never call them
// directly. Block timestamps are cached because viem logs carry a blockNumber
// but not a timestamp, and History needs real times.
import { ABIS } from "./contracts";

export async function getEvents(
  publicClient,
  { address, abiKey, eventName, args, fromBlock = 0n }
) {
  if (!publicClient || !address) return [];
  try {
    return await publicClient.getContractEvents({
      address,
      abi: ABIS[abiKey],
      eventName,
      args,
      fromBlock,
      toBlock: "latest",
    });
  } catch (err) {
    // A missing/undeployed contract or an empty chain shouldn't crash the UI.
    console.warn(`getEvents(${eventName}) failed:`, err?.shortMessage || err?.message || err);
    return [];
  }
}

const tsCache = new Map(); // key: `${chainId}:${blockNumber}` -> unix seconds

export async function blockTimestamps(publicClient, chainId, blockNumbers) {
  const unique = [...new Set(blockNumbers.map((b) => b?.toString()).filter(Boolean))];
  const out = new Map();
  await Promise.all(
    unique.map(async (bnStr) => {
      const key = `${chainId}:${bnStr}`;
      if (tsCache.has(key)) {
        out.set(bnStr, tsCache.get(key));
        return;
      }
      try {
        const block = await publicClient.getBlock({ blockNumber: BigInt(bnStr) });
        const ts = Number(block.timestamp);
        tsCache.set(key, ts);
        out.set(bnStr, ts);
      } catch {
        out.set(bnStr, 0);
      }
    })
  );
  return out; // Map<blockNumberString, unixSeconds>
}
