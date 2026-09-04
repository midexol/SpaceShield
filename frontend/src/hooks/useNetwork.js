// Resolves the active chain to its SpaceShield network entry. `useChainId()`
// returns the connected wallet's chain, or the first configured chain
// (Creditcoin CC3-testnet — see config/wagmi.js's chain ordering) when no
// wallet is connected — which is exactly what we want for the public/no-wallet
// reads on the Network page.
import { useChainId } from "wagmi";
import { getNetwork, isNetworkDeployed } from "../config/networks";
import { satelliteKey } from "../lib/demoTrigger";

export function useNetwork() {
  const chainId = useChainId();
  const net = getNetwork(chainId) || null;
  const satelliteId = net?.satelliteId || null;
  return {
    chainId,
    net,
    deployed: isNetworkDeployed(net),
    satelliteId,
    satKey: satelliteId ? satelliteKey(satelliteId) : null,
  };
}
