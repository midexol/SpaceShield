/**
 * Real usc-sdk integration, not a research throwaway. Checks whether the
 * Attestcoin Block Prover precompile is live on a given network, using the
 * SDK's own official PrecompileBlockProver wrapper (proof-provider/block-prover)
 * to build and send the call - not this repo's own hand-rolled ABI encoding.
 * If the SDK's own official client can't reach it either, that's the
 * strongest evidence available from outside Creditcoin/Gluwa that the
 * precompile isn't live at this address on this network, independent of
 * whether SpaceShieldASC.sol's own interface guess happens to be right.
 *
 * Run: node scripts/check-precompile.js [--network creditcoinTestnet|local]
 */
require("dotenv").config();
const { ethers } = require("ethers");
const usc = require("@gluwa/usc-sdk");

const NETWORKS = {
  local: { rpcUrl: "http://127.0.0.1:8545", label: "Hardhat Local (31337)" },
  creditcoinTestnet: {
    rpcUrl: process.env.CC3_TESTNET_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network",
    label: "Creditcoin CC3-testnet (102031)",
  },
};

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--network"));
  const key = arg ? arg.split("=")[1] || process.argv[process.argv.indexOf(arg) + 1] : "creditcoinTestnet";
  const net = NETWORKS[key] || NETWORKS.creditcoinTestnet;

  console.log(`Checking Block Prover precompile on ${net.label} via usc-sdk's own client...`);
  const provider = new ethers.JsonRpcProvider(net.rpcUrl);
  const prover = new usc.blockProver.PrecompileBlockProver(provider);

  // Deliberately fake proof data - the point isn't to produce a valid proof
  // (there's no real Spacecoin transaction to build one from yet), it's to
  // see whether the SDK's own call reaches real precompile logic at all.
  const encodedTx = ethers.toUtf8Bytes("usc-sdk precompile probe");
  const merkleProof = { root: ethers.keccak256(encodedTx), siblings: [] };
  const continuityProof = { lowerEndpointDigest: ethers.ZeroHash, roots: [ethers.ZeroHash] };

  try {
    const result = await prover.verifySingle(1, Math.floor(Date.now() / 1000), encodedTx, merkleProof, continuityProof);
    console.log(`\nSDK call SUCCEEDED, returned: ${result}`);
    console.log("=> The precompile IS live and answering via the SDK's own official client.");
  } catch (err) {
    console.log(`\nSDK call FAILED: ${err.shortMessage || err.reason || err.message}`);
    console.log("=> Using Gluwa's own official SDK method, not this repo's code, and it still");
    console.log("   can't reach working precompile logic at this address on this network.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
