// Network registry. The LOCAL Hardhat network is read straight from the repo's
// deployment.json (written by ../scripts/deploy.js); the Creditcoin CC3-testnet
// network is read from Vite env vars (see .env.example) and stays "not deployed"
// until you fill those in. This is the "Both, parameterized" setup.
//
// SECURITY NOTE: deployment.json contains `oraclePrivateKey`, a throwaway local
// Hardhat key. It is surfaced here ONLY as `demoOracleKey` and consumed ONLY by
// lib/demoTrigger.js, which hard-refuses to run on any chain except 31337. It is
// never present for the testnet network.
import deployment from "../../../deployment.json";

export const LOCAL_CHAIN_ID = 31337;
export const CC_TESTNET_CHAIN_ID = Number(
  import.meta.env.VITE_CC_TESTNET_CHAIN_ID || 102031
);

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

const local = {
  chainId: LOCAL_CHAIN_ID,
  name: "Hardhat Local",
  isLocal: true,
  rpcUrl: deployment.rpcUrl || "http://127.0.0.1:8545",
  explorerUrl: null,
  nativeSymbol: "ETH",
  satelliteId: deployment.satelliteId || "SAT-014",
  addresses: {
    escrow: deployment.escrowAddress || null,
    asc: deployment.ascAddress || null,
    settlement: deployment.settlementAddress || null,
    source: deployment.sourceAddress || null,
    treasury: deployment.treasuryAddress || null,
  },
  // LOCAL ONLY — see security note above.
  demoOracleKey: deployment.oraclePrivateKey || null,
  seedSubscriber: deployment.subscriberAddress || null,
};

const testnet = {
  chainId: CC_TESTNET_CHAIN_ID,
  name: import.meta.env.VITE_CC_TESTNET_NAME || "Creditcoin Testnet",
  isLocal: false,
  rpcUrl: clean(import.meta.env.VITE_CC_TESTNET_RPC),
  explorerUrl: clean(import.meta.env.VITE_CC_TESTNET_EXPLORER),
  nativeSymbol: "tCTC",
  satelliteId: import.meta.env.VITE_CC_TESTNET_SATELLITE_ID || "SAT-014",
  addresses: {
    escrow: clean(import.meta.env.VITE_CC_TESTNET_ESCROW),
    asc: clean(import.meta.env.VITE_CC_TESTNET_ASC),
    settlement: clean(import.meta.env.VITE_CC_TESTNET_SETTLEMENT),
    source: clean(import.meta.env.VITE_CC_TESTNET_SOURCE),
    treasury: null,
  },
  demoOracleKey: null,
  seedSubscriber: null,
};

export const NETWORKS = {
  [local.chainId]: local,
  [testnet.chainId]: testnet,
};

export const DEFAULT_CHAIN_ID = local.chainId;

export function getNetwork(chainId) {
  return NETWORKS[chainId] || null;
}

// True when every contract this app needs has an address on the given network.
export function isNetworkDeployed(net) {
  if (!net) return false;
  const a = net.addresses || {};
  return Boolean(a.escrow && a.settlement && a.asc && a.source);
}
