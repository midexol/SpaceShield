# SpaceShield — Architecture

This document is the design reference. `README.md` is how to run things;
this is how the pieces fit together and why. `CLAUDE.md` is the handoff
note for continuing work.

## 1. System overview

SpaceShield answers one question automatically: when a Spacecoin satellite
goes down, who gets compensated, how much, and who decides that without a
human in the loop.

```
                    ┌─────────────────────┐
                    │  MockSpacecoinSource │  satellite status/telemetry
                    │  (component 1)       │  (mocked - see §3)
                    └──────────┬───────────┘
                               │ reads
                    ┌──────────▼───────────┐
                    │     AI Agent          │  agent/monitor.py
                    │  (component 2)        │  detect -> cross-check -> gate
                    └──────────┬───────────┘
                               │ HTTP trigger
                    ┌──────────▼───────────┐
                    │   Oracle Worker       │  oracle-worker/worker.js
                    │  (component 5)        │  build proof -> submit
                    └──────────┬───────────┘
                               │ verifyOutage(...) — real INativeQueryVerifier
                               │ struct shapes, see §4a
                    ┌──────────▼───────────┐        ┌─────────────────────┐
                    │   SpaceShieldASC      │◄───────┤ MockBlockProver      │
                    │  (component 3)        │        │ stand-in for the     │
                    │  M-of-N attestation    │        │ 0x0FD2 precompile    │
                    └──────────┬───────────┘        └─────────────────────┘
                               │ registerSettlement(...)
                    ┌──────────▼───────────┐        ┌─────────────────────┐
                    │  SettlementContract   │◄───────┤  CoverageVault        │
                    │  (component 4)        │  live  │  (SpaceShield's OWN   │
                    │  bonds + pro-rata      │  read  │   coverage contract,  │
                    │  pull-based claims     │        │   see §4)             │
                    └──────────┬───────────┘        └─────────────────────┘
                               │ claim() pulled by
                    ┌──────────▼───────────┐
                    │     Subscriber         │
                    └───────────────────────┘
```

## 2. Components, in the order data moves through them

1. **Satellite status source** (`contracts/MockSpacecoinSource.sol`) —
   records uptime/downtime with a confirmation counter. Mocked; see §3 for
   the open question about where this really lives.
2. **AI Agent** (`agent/monitor.py`) — polls the source, cross-checks
   against an independent public tracker (`agent/public_tracker.py`, a real
   CelesTrak client), and only triggers if both agree AND the confirmation
   count clears a floor. Never touches money or decides amounts. Its "live"
   tracker mode is not theoretical — see §3a, it has been run against real
   CelesTrak data and works.
3. **Oracle Worker** (`oracle-worker/worker.js`) — the only thing that talks
   to the chain on the detection side. Turns an agent trigger into a
   built proof (`oracle-worker/proofBuilder.js`) and submits it. The proof's
   *shape* is real (see §4a); the proof *content* is still fabricated
   because there's no real Spacecoin transaction yet to build a genuine one
   from.
4. **SpaceShieldASC** (`contracts/SpaceShieldASC.sol`) — verifies the proof
   via the Attestcoin Block Prover precompile (`0x0FD2`, mocked locally by
   `MockBlockProver.sol` deployed at that address via `hardhat_setCode`).
   Requires `attestationThreshold` distinct registered oracles to
   independently verify the same outage before finalizing — no single
   oracle key can settle alone once threshold > 1. On finalize, calls
   `SettlementContract.registerSettlement()`. Does not decide who gets
   paid or how much.
5. **CoverageVault** (`contracts/CoverageVault.sol`) — SpaceShield's own
   coverage-registration contract (see §4 for why it is not, and should not
   pretend to be, a model of Spacecoin's contract). This is what makes
   someone a "subscriber": a live, on-chain, unforgeable fact, not a
   registration step routed through a third party.
6. **SettlementContract** (`contracts/SettlementContract.sol`) — holds
   operator bonds; `registerSettlement()` marks an outage claimable but
   pays no one; `claim()` is pulled by each subscriber individually, who
   is checked live against `CoverageVault` and paid pro-rata based on how
   long they've been subscribed relative to `COMPENSATION_WINDOW` (see §5).

## 3. Satellite telemetry: not published on-chain today, confirmed from Spacecoin's own docs

**Resolved, with real primary-source evidence — not from Spacecoin's team
directly (that outreach is still open, see below), but from their own
published documentation and public track record.**

`docs.spacecoin.org/network/how-it-works` describes exactly two things as
being recorded on-chain: transaction hashes for satellite data
transmissions, and cryptographic proof of service delivery submitted to a
smart contract for payment release. Satellite operational status —
up/down, health, connectivity — is not described as part of that record
anywhere in the doc. This is corroborated by Spacecoin's own public
announcements: the CTC-0 satellite's October 2025 milestone (the first
end-to-end blockchain message relayed through space, validated on
Creditcoin's testnet — widely covered, e.g.
[Spacecoin's own writeup](https://medium.com/@_spacecoin/spacecoin-routes-first-end-to-end-blockchain-transaction-through-space-4f0fc924faee))
is framed entirely around proving a *data relay transaction* happened, not
around publishing the satellite's live status. Nothing found — not the
docs, not the announcement coverage — describes a telemetry feed, oracle,
or status contract.

**What this means for SpaceShield:** the architecture this repo already
has — an off-chain AI agent (`agent/`) that independently monitors real
public tracking data (CelesTrak) and cross-checks it, rather than trusting
a single on-chain telemetry source — isn't a placeholder for a same-chain
read that would make it redundant. It's addressing a real gap: Spacecoin
doesn't currently publish the data SpaceShield would need to read
directly, on any chain. The Attestcoin precompile layer's job was always
narrower than "read telemetry" — it's for proving the *payment/service*
side of an outage claim, which is confirmed on-chain (§4), while detection
itself has to stay off-chain until/unless Spacecoin publishes telemetry
some other way.

**Still open:** whether Spacecoin has an unpublished or upcoming telemetry
mechanism isn't something documentation can rule out — only their team can
say that for certain. An outreach message covering both this question and
the Attestcoin proof-builder question (§4a) is drafted, ready to post in
Spacecoin's Discord (`discord.gg/spacecoin`, verified live and active —
1,761 members — via Discord's own invite API) or Telegram
(`t.me/Spacecoin_org`); no reply as of this writing, and it isn't confirmed
whether it's been sent yet. Update this section once they actually answer
— don't let a documentation-level inference harden into "confirmed by the
team" without actually hearing back.

### 3a. Correction: this sandbox's network egress claim was environment-specific, not universal

Earlier notes (see `CLAUDE.md`'s original handoff) stated CelesTrak and
Creditcoin's real endpoints were unreachable from "this sandbox." That was
true of whatever environment those notes were written in — it is not true
of every environment this repo runs in. Confirmed directly, from a session
with open network access:

- `celestrak.org`'s real GP-data endpoint — reachable, returns real
  satellite data. `agent/public_tracker.py` run live against catalog number
  25544 (ISS, which `agent/satellite_catalog.json` already maps SAT-014 to
  for exactly this reason) returned a real, fresh, plausible result with
  zero code changes needed — the fixture-fallback design was already
  correct, it just had nothing to fall back from once the network worked.
- `binaries.soliditylang.org` — reachable, meaning `npx hardhat compile`
  now works directly (with `viaIR: true` added to `hardhat.config.js` — see
  the same "stack too deep" issue `scripts/build.js` already worked around).
  `scripts/build.js`'s manual-solc path still works and is still the faster
  default; this is a second, real option, not a replacement.
- Creditcoin's CC3-testnet RPC (`https://rpc.cc3-testnet.creditcoin.network`)
  — reachable, real, chain ID 102031 (matches what was previously an
  unverified placeholder in `frontend/.env.example`). Now wired into
  `hardhat.config.js` as the `creditcoinTestnet` network.
- `@gluwa/usc-sdk` (the real Attestcoin/Proof Builder SDK) — a real,
  installable npm package. Its shipped ABI is what corrected §4a below.

**What this does not change:** whether telemetry is same-chain or
cross-chain is still unconfirmed (this section), and a real testnet
deployment still needs a funded key nobody but you can provide — see
README.md's "What you need to do" section. Network access being open
doesn't manufacture funded accounts or answer product questions.

## 4. Subscriber verification: CoverageVault is SpaceShield's own contract, not a model of Spacecoin's

This section used to describe a "correction": replacing an off-chain
Merkle-snapshot publisher with live reads against a contract that claimed
to model Spacecoin's real payment mechanism, based on one line of
documentation (`docs.spacecoin.org/usdspace-token/token-overview-and-utility`):
*"Users lock $SPACE in a smart contract, operators submit cryptographic
proof of service delivery, and the smart contract automatically verifies
and releases payment."* That inference produced `SpacecoinEscrow.sol` — a
per-satellite coverage-locking contract with an `isActiveSubscriberByKey`
read and a `subscriptionStartByKey` timestamp.

**With real network access, the actual contract was found and read.**
Spacecoin's real payment escrow is `TokenPaymentEscrow`, verified source on
Creditcoin mainnet's own Blockscout explorer:
- Proxy: `0xC130F5D76f0b4Ce8FE2ceA0D2C2b8f53A39a5cd0`
- Implementation: `0xDbbdB0E6853fB0092e8da4Ed1C22A109C26612c8`
- Also has code at the same proxy address on CC3-testnet (confirmed via
  `eth_getCode`), though the SPACE token itself does not — mainnet only.

It is a **prepaid, usage-metered data-payment escrow**, not a subscription
contract:

- Clients `deposit()` SPACE into a balance (or `depositWithPermit`/
  `depositWithAuthorization` for gasless EIP-2612/EIP-3009 deposits).
- "Nodes" — `bytes32` identities, each mapped to a payout wallet via
  `registerNode` — claim payment from that balance via
  `claimBatch(receipts, signatures)`: EIP-712-signed
  `Receipt{clientAddress, nodeAddress, requestUUID, dataAmount, totalPrice}`
  tuples. Pay-per-byte, not pay-per-month.
- Withdrawals go through a 5-day `initiateWithdrawal` → `executeWithdrawal`
  timelock (`WITHDRAWAL_DELAY`).
- There is no satellite ID, no "coverage" flag, no subscription-start
  timestamp anywhere in it.

**Why that means it can't answer "is this address covered":** a client can
hold a healthy balance while their link has been down for weeks (they
just haven't been billed through it yet), or a near-zero balance despite
perfect service (everything claimed promptly by the node). Balance is not
an eligibility signal, and there is no query on this contract that means
"this address currently has active satellite service."

**The fix:** rather than force-fit outage eligibility onto data that
doesn't mean what SpaceShield needs it to mean, `SpacecoinEscrow.sol` was
renamed to `CoverageVault.sol` and its docstring stopped claiming to model
Spacecoin's contract. The mechanics (`lockCoverage`, `withdrawCoverage`,
`isActiveSubscriberByKey`, `subscriptionStartByKey`) are unchanged, because
they were always describing SpaceShield's own coverage logic correctly —
only the name and the framing were wrong. `submitServiceProof` (which
existed only to mirror the incorrect documented mechanism, and was never
called by anything else in this system) was removed.

**Still genuinely open, and a product question, not an engineering one:**
should SpaceShield's coverage additionally read `TokenPaymentEscrow` — e.g.
requiring a minimum recent claimed-data balance as a weak "still an active
customer" signal, layered on top of SpaceShield's own coverage lock? That
would connect the two systems, but it's a judgment call about what "active
customer" should mean for an insurance product, not something to guess at
from outside.

### 4a. Correction: the Attestcoin precompile interface was also a guess, and also wrong

Separately from subscriber verification, `SpaceShieldASC.sol`'s call to the
Block Prover precompile at `0x0FD2` used a guessed signature:
`verify(uint64,uint64,bytes,bytes,bytes)` — chain key, height, encoded tx,
and two raw `bytes` blobs standing in for "a Merkle proof" and "a
continuity proof."

The real interface, pulled directly from `@gluwa/usc-sdk`'s shipped ABI
(`block-prover/block_prover.json`, interface `INativeQueryVerifier` — the
same package Creditcoin's own Proof Builder tooling uses) is structured,
not flat:

```solidity
struct MerkleProofEntry { bytes32 hash; bool isLeft; }
struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }

function verify(
    uint64 chainKey,
    uint64 height,
    bytes calldata encodedTransaction,
    MerkleProof calldata merkleProof,
    ContinuityProof calldata continuityProof
) external view returns (bool);
```

The guessed flat-bytes signature would have reverted against the real
precompile on every single call — `abi.decode` on a selector mismatch
doesn't silently degrade, it fails. This has been corrected everywhere the
shape mattered, all in the same pass so nothing drifts:
`SpaceShieldASC.sol` (real interface + `abi.encodeCall`, not a hand-typed
signature string), `MockBlockProver.sol` (matches the real shape exactly,
so the exact same calldata that works locally is what would be sent on
real Creditcoin), `oracle-worker/proofBuilder.js` and
`frontend/src/lib/demoTrigger.js` (both build struct-shaped proofs now),
`oracle-worker/worker.js` (was also carrying its own separately hand-typed,
independently-drifted ABI fragment for both the ASC and the telemetry
source — now imports the real generated ABIs from `artifacts-manual/`
instead, which makes this exact class of silent drift impossible going
forward), and `test/spaceshield.test.js`'s malformed-proof fixture.

**Update — the precompile IS live. The real constraint was call context, not
existence.** First test: `SpaceShieldASC.verifyOutage()`, called for real
against CC3-testnet with a real funded oracle key, reverted with
`"precompile call failed"`. That looked like "nothing's there." It wasn't —
it was testing the wrong thing.

Three follow-up calls isolated the actual variable:

1. `usc-sdk`'s own official `PrecompileBlockProver.verifySingle()` — a
   direct, top-level call from an EOA — reached real verification logic and
   returned a *specific* rejection: `"Merkle proof validation failed"`. Not
   silence. A real answer, correctly rejecting a fake proof.
2. A hand-rolled script calling `0x0FD2` directly (same top-level shape, our
   own ABI, no SDK involved) got the identical `"Merkle proof validation
   failed"`. Rules out "it's an SDK-specific trick."
3. `SpaceShieldASC.verifyOutage()` was changed from `.call()` to
   `.staticcall()` (matching `verify`'s declared `view` mutability) and
   redeployed. Still `"precompile call failed"` — ruling out call-vs-
   staticcall as the variable too.

**Conclusion, confirmed by elimination: the precompile only answers calls
where it is the transaction's direct target (top-level, `tx.to ==
0x0FD2`), not calls nested inside another contract's execution — regardless
of `.call` vs `.staticcall`.** This is a real constraint of Creditcoin's
implementation, not a bug in this repo's ABI or call style.

**This means `SpaceShieldASC.sol`'s core design assumption didn't hold on
real Creditcoin: a contract cannot call the Block Prover precompile
internally.** The fix has been made, not just diagnosed. The precompile is
now invoked directly by an off-chain caller — the Oracle Worker, using its
own key (`oracle-worker/precompileClient.js`, mirroring what `usc-sdk`'s
`verifyAndEmitSingle()` is shaped for on real Creditcoin: a top-level
transaction that emits `TransactionVerified(chainKey, height,
transactionIndex)` on success, or reverts on a bad proof). `verifyOutage()`
was rewritten to drop the internal precompile call and the now-meaningless
`MerkleProof`/`ContinuityProof` parameters entirely; it takes
`(satelliteId, blockHeight, encodedTx, precompileTxHash)` and trusts the
oracle's report that verification succeeded off-chain — backed by
`precompileTxHash` being a real, independently-checkable transaction hash,
not re-verified proof math inside the same call. The existing M-of-N
oracle attestation threshold carries more of the trust load under this
model (multiple independent oracles each doing their own top-level
precompile call and reporting success), which is a smaller adjustment
than it might sound like — the trust model already assumed oracles could
lie about *whether* to submit; it just also assumed the contract could
independently catch a lie. It still can, just one hop removed: by
requiring several oracles to independently make an identical report
rather than checking their proof math directly. All 16 tests pass against
this corrected flow (see `test/spaceshield.test.js`'s `attestOutage()`
helper, which mirrors the Oracle Worker's exact two-step call pattern),
and `frontend/src/lib/demoTrigger.js`'s local "Trigger Outage" button runs
the identical two-step flow from the browser.

Reproducible commands (both against `0x0FD2`, `chainKey=1`, a fabricated
proof — expected to reject, the point is *how* it fails):
```bash
node scripts/check-precompile.js --network creditcoinTestnet   # via usc-sdk, top-level: rejects with a real reason
# vs. calling SpaceShieldASC.verifyOutage() (nested): fails at the call boundary, never reaches verification
```

## 5. Compensation model: pro-rata, and why

Checking eligibility *live* (§4) creates an edge case: someone who starts
locking coverage after an outage was already verified would, under a
flat-compensation model, either get a full payout they didn't really "earn"
the whole outage for, or need to be excluded entirely (reintroducing a
snapshot). Three options were on the table:

1. **Snapshot before outage** — freeze the subscriber list at outage
   detection time. Simple, but requires defining a verifiable "block
   before outage" cutoff and reintroduces the staleness problem this whole
   redesign was meant to remove.
2. **Continuous-subscription requirement** — only pay subscribers who were
   continuously subscribed through the *entire* outage window. Locks out
   otherwise-legitimate people who joined mid-outage.
3. **Pro-rata** — pay proportionally to how much of the compensation
   window someone was actually subscribed for.

**Chosen: pro-rata** (`SettlementContract.sol`, `COMPENSATION_WINDOW`
constant, currently `1 days` as an illustrative placeholder — a real
deployment should set this from Spacecoin's actual SLA terms). Mechanics:

- `CoverageVault` tracks `subscriptionStart` per (satellite, user) — the
  timestamp their current unbroken coverage period began (reset on
  withdraw+relock, not on every top-up while already active).
- `SettlementContract.registerSettlement()` records `windowStart` = the
  block timestamp the outage was finalized.
- `claim()` computes `effectiveStart = max(subscriptionStart, windowStart)`
  and pays `fullAmount * (windowEnd - effectiveStart) / COMPENSATION_WINDOW`.
- Subscribed since before the outage → full payout. Joined exactly at the
  midpoint → half. Joined after the window fully elapsed → reverts,
  ineligible.

This is a **protocol parameter, not an implementation bug** — tested
explicitly in `test/spaceshield.test.js` (full payout for pre-existing
subscribers, prorated payout for mid-window joiners, rejection for
post-window joiners).

## 6. Trust boundaries — what has to be correct, and who's checking it

| Actor | Can lie/be wrong about | What stops it from mattering |
|---|---|---|
| AI Agent | Whether an outage is real | Doesn't touch money directly; Oracle Worker still needs a real proof the precompile accepts |
| Oracle Worker | Whether to submit a proof | The precompile call has to actually succeed against real chain data — a fabricated proof is rejected (see `MockBlockProver`'s toy check, now matching the real precompile's actual interface — see §4a; real precompile is cryptographically real) |
| A single oracle (if threshold=1) | Could submit whenever it wants | `attestationThreshold` > 1 requires independent agreement from multiple registered oracles |
| Anyone claiming compensation | Whether they're a real subscriber | Checked live against `CoverageVault` — SpaceShield's own contract, so this line is now "checked live against SpaceShield's own on-chain record," not a claim about reading someone else's system |
| Contract owner | Who's a registered operator/oracle | Still a single-key trust point — not solved, see README's gap list |
| Whoever computes `COMPENSATION_WINDOW`, bond sizing | Protocol parameters | Governance question, not a code question |

## 7. What does NOT exist yet (see README for full gap list)

No persistence layer for the Oracle Worker beyond contract-level
idempotency, no completed real Spacecoin/Creditcoin testnet deployment
(infrastructure for one now exists — `scripts/deploy-testnet.js`,
`hardhat.config.js`'s `creditcoinTestnet` network — but it hasn't been run;
it needs a funded key only you can provide), no audit. This document
describes the system that's built and tested locally —
README.md's "Known gaps" and "What you need to do" sections are the
authoritative lists of what's left.
