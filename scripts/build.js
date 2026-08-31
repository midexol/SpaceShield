const fs = require("fs");
const path = require("path");
const solc = require("solc");

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts-manual");

const files = fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".sol"));

const sources = {};
for (const f of files) {
  sources[f] = { content: fs.readFileSync(path.join(CONTRACTS_DIR, f), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

let hasError = false;
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === "error") {
      hasError = true;
      console.error(err.formattedMessage);
    } else {
      console.warn(err.formattedMessage);
    }
  }
}
if (hasError) process.exit(1);

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
for (const file of Object.keys(output.contracts)) {
  for (const contractName of Object.keys(output.contracts[file])) {
    const c = output.contracts[file][contractName];
    const artifact = {
      contractName,
      abi: c.abi,
      bytecode: "0x" + c.evm.bytecode.object,
      deployedBytecode: "0x" + c.evm.deployedBytecode.object,
    };
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, `${contractName}.json`),
      JSON.stringify(artifact, null, 2)
    );
    console.log(`built ${contractName} (${c.evm.bytecode.object.length / 2} bytes)`);
  }
}
