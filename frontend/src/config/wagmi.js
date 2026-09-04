// wagmi + RainbowKit configuration. Two chains: a parameterized Creditcoin
// CC3-testnet (default — the real, publicly reachable one) and the local
// Hardhat node (only reachable if you're personally running one). Chain order
// matters: wagmi's useChainId() falls back to chains[0] whenever no wallet is
// connected yet, and RainbowKit's connect flow treats chains[0] as the chain
// it expects/prompts for — so the real network has to be listed first, or
// "Connect Wallet" pushes visitors toward a localhost RPC that doesn't exist
// for them. Injected wallets (MetaMask) work without a WalletConnect
// projectId; if you provide one via VITE_WALLETCONNECT_PROJECT_ID the
// WalletConnect QR option lights up too.
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { NETWORKS, LOCAL_CHAIN_ID, CC_TESTNET_CHAIN_ID } from "./networks";

const localNet = NETWORKS[LOCAL_CHAIN_ID];
const testNet = NETWORKS[CC_TESTNET_CHAIN_ID];

export const hardhatLocal = defineChain({
  id: LOCAL_CHAIN_ID,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [localNet.rpcUrl] } },
});

export const creditcoinTestnet = defineChain({
  id: CC_TESTNET_CHAIN_ID,
  name: testNet.name,
  nativeCurrency: { name: "Test CTC", symbol: "tCTC", decimals: 18 },
  // viem requires a non-empty http url; use a clearly-invalid placeholder when
  // the testnet RPC hasn't been configured yet (network shows as "not deployed").
  rpcUrls: { default: { http: [testNet.rpcUrl || "https://rpc.not-configured.invalid"] } },
  blockExplorers: testNet.explorerUrl
    ? { default: { name: "Explorer", url: testNet.explorerUrl } }
    : undefined,
  testnet: true,
});

const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "spaceshield-local-demo";

export const wagmiConfig = getDefaultConfig({
  appName: "SpaceShield",
  projectId,
  chains: [creditcoinTestnet, hardhatLocal],
  ssr: false,
});
