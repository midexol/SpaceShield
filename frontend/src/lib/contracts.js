// Central contract access: ABIs come from the repo's manually-built artifacts
// (single source of truth, imported directly), addresses come from the network
// registry. `getContract(chainId, name)` hands a { address, abi } pair straight
// to viem/wagmi, or null when that contract isn't deployed on that chain.
import EscrowArtifact from "../../../artifacts-manual/SpacecoinEscrow.json";
import SettlementArtifact from "../../../artifacts-manual/SettlementContract.json";
import AscArtifact from "../../../artifacts-manual/SpaceShieldASC.json";
import SourceArtifact from "../../../artifacts-manual/MockSpacecoinSource.json";
import { getNetwork } from "../config/networks";

export const ABIS = {
  escrow: EscrowArtifact.abi,
  settlement: SettlementArtifact.abi,
  asc: AscArtifact.abi,
  source: SourceArtifact.abi,
};

export function getContract(chainId, name) {
  const net = getNetwork(chainId);
  if (!net) return null;
  const address = net.addresses?.[name] || null;
  const abi = ABIS[name] || null;
  if (!address || !abi) return null;
  return { address, abi };
}
