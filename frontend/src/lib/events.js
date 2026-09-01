// Low-level on-chain event access via a viem public client (from wagmi's
// usePublicClient). Hooks build on top of these; screens never call them
// directly. Block timestamps are cached because viem logs carry a blockNumber
// but not a timestamp, and History needs real times.
import { ABIS } from "./contracts";

// getEvents used to re-scan from block 0 on every single poll (every 8-12s,
// across 5 independent hooks). That's fine against a local Hardhat chain
// with a few dozen blocks; against a real chain with real history it means
// repeatedly re-fetching the whole event log forever, which is exactly the
// kind of load a shared public RPC rate-limits (and rightly so). This cache
// makes each poll after the first one incremental: only the blocks mined
// since the last successful fetch are actually requested, merged onto what
// was already fetched. Keyed per chain+contract+event+args so switching
// networks or accounts never serves another context's cached logs.
const logCache = new Map(); // key -> { logs: Log[], lastBlock: bigint }

function cacheKey(chainId, address, eventName, args) {
  const argsKey = args
    ? JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    : "";
  return `${chainId}:${address}:${eventName}:${argsKey}`;
}

export async function getEvents(
  publicClient,
  { address, abiKey, eventName, args, fromBlock = 0n }
) {
  if (!publicClient || !address) return [];
  const chainId = publicClient.chain?.id ?? "unknown";
  const key = cacheKey(chainId, address, eventName, args);
  const cached = logCache.get(key);

  try {
    const latest = await publicClient.getBlockNumber();
    if (cached) {
      if (cached.lastBlock >= latest) return cached.logs; // already caught up
      const newLogs = await publicClient.getContractEvents({
        address,
        abi: ABIS[abiKey],
        eventName,
        args,
        fromBlock: cached.lastBlock + 1n,
        toBlock: latest,
      });
      const merged = newLogs.length ? [...cached.logs, ...newLogs] : cached.logs;
      logCache.set(key, { logs: merged, lastBlock: latest });
      return merged;
    }

    const logs = await publicClient.getContractEvents({
      address,
      abi: ABIS[abiKey],
      eventName,
      args,
      fromBlock,
      toBlock: latest,
    });
    logCache.set(key, { logs, lastBlock: latest });
    return logs;
  } catch (err) {
    // A missing/undeployed contract or an empty chain shouldn't crash the UI.
    // On failure, prefer stale cached data over nothing — and don't advance
    // lastBlock, so the next successful poll retries the same range instead
    // of silently skipping blocks a failed request never actually covered.
    console.warn(`getEvents(${eventName}) failed:`, err?.shortMessage || err?.message || err);
    return cached?.logs || [];
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
