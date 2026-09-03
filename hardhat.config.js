require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// CC3_TESTNET_PRIVATE_KEY is optional — without it, `creditcoinTestnet` is
// still a valid network target for read-only tasks (balance checks, etc.),
// it just has no deployer account. See scripts/deploy-testnet.js and
// README.md's "Real testnet deployment" section for the funding + deploy
// flow this key is for.
const CC3_TESTNET_PRIVATE_KEY = process.env.CC3_TESTNET_PRIVATE_KEY;

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // SpaceShieldASC.sol hits "stack too deep" without this — same
      // setting scripts/build.js already uses for the manual solc path.
      viaIR: true,
    },
  },
  networks: {
    // Real, live, confirmed reachable — see README.md's "Real testnet
    // deployment" section for how this was verified (chain ID matches
    // Creditcoin's own documented CC3-testnet exactly).
    creditcoinTestnet: {
      url: process.env.CC3_TESTNET_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network",
      chainId: 102031,
      accounts: CC3_TESTNET_PRIVATE_KEY ? [CC3_TESTNET_PRIVATE_KEY] : [],
    },
  },
};
