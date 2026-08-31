# SpaceShield — Working Prototype

> See `architecture.md` for system design and the decision log, and
> `CLAUDE.md` if you're an AI agent picking this project up fresh.

A runnable implementation of the PRD's architecture, proven three ways:

1. **`npm test`** — 16 passing Hardhat integration tests: the full happy
   path, plus failure modes (double-settlement, forged proofs, unregistered
   oracles, non-subscribers trying to claim, double-claims, withdrawn
   coverage losing eligibility, bond depletion + recovery, multi-oracle
   attestation thresholds, penalties routing to a treasury).
2. **A live multi-process run** — a real local chain, a real Python process
   (the AI Agent) talking HTTP to a real Node process (the Oracle Worker),
   submitting a real transaction, followed by a subscriber pulling their
   own compensation via a live on-chain eligibility check.
3. **A live (blocked-but-honest) network check** — the public-tracking
   client made a real HTTP request to CelesTrak from this sandbox, got a
   real `403` back, and fell back to a local fixture instead of silently
   pretending the check passed.

## Architecture correction: subscriber verification uses Spacecoin's real payment mechanism

An earlier iteration of this repo verified "who's affected by an outage"
against a Merkle root that an off-chain snapshot service had to publish —
real cryptography, but still a trust delegation to whoever published the
root. That's been replaced after checking how Spacecoin's payments actually
work, rather than assuming:

- **SPACE is an ERC-20 token deployed directly on Creditcoin**
  (`0x7ab7C6A935Ab2D1437398790C9C0660af62A80b9`, verifiable on Creditcoin's
  own Blockscout explorer) — confirmed via Spacecoin's official docs
  (docs.spacecoin.org).
- **Spacecoin's payment mechanism is a smart-contract escrow, on that same
  chain**: "Users lock $SPACE in a smart contract, operators submit
  cryptographic proof of service delivery, and the smart contract
  automatically verifies and releases payment."

That means Spacecoin's subscriber/payment records live on the *same chain*
as SpaceShield's own contracts — not a separate chain requiring an off-chain
publisher to snapshot and attest to. `SpacecoinEscrow.sol` models this
documented mechanism, and `SettlementContract.claim()` now checks live,
on-chain escrow state directly instead of verifying a Merkle proof against
a stale snapshot. No publisher, no allowlist, no staleness window.

**What's grounded vs. still illustrative:** the mechanism, the token
contract address, and "same chain as Creditcoin" are all independently
confirmed from official sources. The real *escrow contract's* own
address/ABI weren't discoverable from this sandbox (no live network access,
and it wasn't published anywhere found) — `SpacecoinEscrow.sol` is a
faithful model of the documented mechanism, not a verified copy of the real
deployed contract. See its docstring for the full citation trail.

**Resolved: pro-rata compensation, not a known tradeoff left open.**
Because eligibility is checked live at claim time rather than frozen at a
snapshot moment, someone who starts paying into escrow *after* an outage
was verified is a real edge case. Rather than either paying them in full or
excluding them entirely, `SettlementContract.claim()` pays proportionally
to how much of `COMPENSATION_WINDOW` they were actually subscribed for:
full payout if subscribed since before the outage, a linear fraction if
they joined mid-window, and nothing if they joined after the window fully
elapsed. This is a protocol parameter (`COMPENSATION_WINDOW`, currently a
placeholder `1 days`), not an implementation gap — see `architecture.md`
§5 for the full reasoning and the alternatives that were considered and
rejected.

## What's real vs. mocked

| Piece | Status |
|---|---|
| Contract logic (bonding, pull-based settlement claims, live escrow-based subscriber verification, multi-oracle attestation, de-dup, confirmation gating, treasury-routed penalties) | **Real** — this is the actual code that would ship |
| Spacecoin's payment/escrow mechanism | **Modeled faithfully** from confirmed official documentation (`SpacecoinEscrow.sol`) — the real contract's address/ABI weren't independently locatable from this sandbox |
| Spacecoin's satellite-status/telemetry reporting | **Mocked** (`MockSpacecoinSource.sol`) — whether this is same-chain or cross-chain from Creditcoin is still an open question; see below |
| Attestcoin Block Prover precompile (`0x0FD2`) | **Mocked** (`MockBlockProver.sol`), installed at the real precompile address via `hardhat_setCode` so the ASC's call site never changes between test and production |
| Proof generation (`@gluwa/usc-sdk`) | **Mocked** (`oracle-worker/proofBuilder.js`) — fabricates a proof shaped to satisfy the mock verifier |
| AI Agent detection/cross-check/confirmation-floor logic | **Real** and independently runnable (`agent/monitor.py`) |
| Public tracking cross-check (CelesTrak) | **Real client** against the actual documented endpoint (`agent/public_tracker.py`); blocked from *this* sandbox specifically, auto-falls-back to a fixture, verified live |
| Affected-user / payout verification | **Real, live, same-chain** — `SettlementContract.claim()` checks `SpacecoinEscrow` directly; no snapshot, no publisher, no caller-supplied address list anywhere in the flow |
| Oracle decentralization | **Real M-of-N attestation** — `SpaceShieldASC.sol` requires `attestationThreshold` distinct registered oracles to each independently verify the same outage before it's registered for settlement |
| Bond depletion handling | **Real** — claims revert (not silently underpay) when a bond can't cover them, and become claimable again once the operator tops up |
| Treasury for penalties | **Real** — `penalize()` sends slashed funds to a configured treasury address |
| Bond-health monitoring | **Real, runnable** (`scripts/monitor_bonds.js`) |
| CI | **Real** (`.github/workflows/test.yml`) |
| Oracle Worker HTTP trigger → proof build → submit | **Real** and independently runnable (`oracle-worker/worker.js`) |

## Structure

```
contracts/
  MockSpacecoinSource.sol   — component 1: satellite status/telemetry (mocked)
  MockBlockProver.sol       — stand-in for the 0x0FD2 precompile, LOCAL ONLY
  SpacecoinEscrow.sol       — models Spacecoin's real, documented payment/escrow mechanism
  SpaceShieldASC.sol        — component 3: multi-oracle proof verification, registers settlements
  SettlementContract.sol    — component 4: bonds + pull-based claims checked live against escrow
agent/
  monitor.py                 — component 2: AI Agent (Python, matches PRD pseudocode)
  public_tracker.py          — real CelesTrak client (independent cross-check source)
  satellite_catalog.json     — satellite ID -> real NORAD catalog number mapping
  mock_norad.json             — fixture used when the live tracker is unreachable
  test_public_tracker.py      — unit tests for the tracker's parsing/decision logic
oracle-worker/
  worker.js                  — component 5: HTTP trigger -> proof -> submit
  proofBuilder.js             — shared proof construction (swap point for usc-sdk)
scripts/
  build.js                    — compiles contracts via npm-installed solc
  deploy.js                   — deploys the full stack + wires it together
  monitor_bonds.js              — bond-health check / alerting hook
test/
  spaceshield.test.js          — 16 end-to-end + failure-mode integration tests
.github/workflows/test.yml   — CI
```

## Why a manual solc build

This environment's network egress doesn't include
`binaries.soliditylang.org`, which is where Hardhat's own `compile` task
normally fetches the compiler from. `scripts/build.js` compiles with the
`solc` **npm package** instead (bundles its own wasm binary) and writes
ABI+bytecode to `artifacts-manual/`. Run `npx hardhat compile` normally if
your environment has open network access.

## Run the test suite

```bash
npm install
node scripts/build.js
npx hardhat test --no-compile
```

Expect 16 passing tests.

## Run it live

```bash
# 1. local chain
npx hardhat node

# 2. deploy + wire everything (contracts, oracle registration, and userA
#    paying into SpacecoinEscrow to become a real subscriber), prints
#    deployment.json
node scripts/deploy.js

# 3. bond health check any time
node scripts/monitor_bonds.js

# 4. start the Oracle Worker (reads addresses from deployment.json)
SPACESHIELD_RPC_URL=http://127.0.0.1:8545 \
SOURCE_ADDRESS=<from deployment.json> \
ASC_ADDRESS=<from deployment.json> \
ORACLE_PRIVATE_KEY=<from deployment.json> \
node oracle-worker/worker.js

# 5. report a few outages on-chain, then run the agent once
python3 agent/monitor.py --satellite SAT-014 \
  --source-address <from deployment.json> \
  --oracle-worker-url http://127.0.0.1:4001 --once

# 6. the subscriber claims - read outageId from SettlementContract's
#    OutageRegistered event, then settlement.claim(outageId). No proof
#    argument: eligibility is checked live against SpacecoinEscrow.
```

## Data acquisition — what's live-capable right now

`agent/public_tracker.py` is a real client against CelesTrak's actual public
GP-data endpoint, no API key required. Blocked from this sandbox, confirmed
with a real request:

```
[agent] CelesTrak unreachable (CelesTrak returned HTTP 403) — falling back to local fixture
```

`agent/test_public_tracker.py` proves the parsing/decision logic is correct
against CelesTrak's real documented JSON schema (6/6 passing). CelesTrak
confirms a satellite is still a tracked, cataloged object in orbit — not
that its comms link is up. Real, independent, narrower than "internet is
working."

## Oracle decentralization — M-of-N attestation

`SpaceShieldASC.sol` requires `attestationThreshold` distinct registered
oracle addresses to each independently verify the same outage before it's
registered for settlement. Default threshold is 1; `setAttestationThreshold(2)`
means no single Oracle Worker key can finalize alone. Proven with dedicated
tests.

## Known gaps — what's genuinely not done, and why

**Things closed since the last pass:** affected-user trust now uses
Spacecoin's real on-chain payment mechanism instead of an off-chain
publisher (a strictly stronger trust model than the Merkle-snapshot version
that preceded it); gas/DoS on large subscriber lists (pull claims, O(1)
regardless of count); single-oracle trust bottleneck (M-of-N attestation);
penalized funds going nowhere (treasury); no CI; no monitoring hook.

**Open architectural question, not resolved here:** is satellite
uptime/telemetry reporting *also* same-chain on Creditcoin (like the
payment layer turned out to be), or does it come from a genuinely separate
system that needs the Attestcoin cross-chain precompile? The PRD's original
design assumed the latter. Research confirms Spacecoin's *payments* are
same-chain; it doesn't confirm or rule out whether outage/status reporting
is same-chain too. If it turns out to be same-chain, the entire
`MockBlockProver`/precompile layer could potentially be simplified away the
same way the subscriber registry was — but that's a real unknown, not
something to guess at further without more information about Spacecoin's
specific telemetry architecture.

**Things that still need real external infrastructure or people:**

- **Real Spacecoin RPC/contract integration** for satellite status —
  `MockSpacecoinSource.sol` stands in; needs Spacecoin's actual endpoint
  and event schema.
- **The real SpacecoinEscrow contract's address/ABI** — this repo models
  the documented mechanism faithfully but hasn't verified against the
  actual deployed contract.
- **Real Attestcoin proof pipeline (`@gluwa/usc-sdk`)** against
  Creditcoin's testnet and hosted Proof Builder service.
- **Security audit.** Nothing here has had one.
- **Legal/regulatory review.** This automatically moves money based on an
  algorithm's read of network state.
- **Real testnet deployment** against Creditcoin's actual CC3-testnet.

**Smaller items still open:**

- Oracle Worker has no persistence/retry queue beyond the contract's own
  idempotency.
- Multi-satellite support is architecturally fine (everything's keyed by
  `satelliteId`) but never load-tested with more than one.
- No chain-reorg invalidation path if Spacecoin reorgs after a proof was
  already submitted.
- `COMPENSATION_WINDOW` is an illustrative placeholder (`1 days`) — a real
  deployment should set this from Spacecoin's actual SLA terms.
- No frontend/app exists connected to these contracts. See `CLAUDE.md`'s
  "On the frontend" section for what pages a real app would need and why
  the earlier marketing/demo landing page isn't that app.
