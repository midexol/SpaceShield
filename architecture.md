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
                               │ verifyOutage(...)
                    ┌──────────▼───────────┐        ┌─────────────────────┐
                    │   SpaceShieldASC      │◄───────┤ MockBlockProver      │
                    │  (component 3)        │        │ stand-in for the     │
                    │  M-of-N attestation    │        │ 0x0FD2 precompile    │
                    └──────────┬───────────┘        └─────────────────────┘
                               │ registerSettlement(...)
                    ┌──────────▼───────────┐        ┌─────────────────────┐
                    │  SettlementContract   │◄───────┤  SpacecoinEscrow      │
                    │  (component 4)        │  live  │  (real, documented    │
                    │  bonds + pro-rata      │  read  │   Spacecoin payment   │
                    │  pull-based claims     │        │   mechanism, modeled) │
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
   count clears a floor. Never touches money or decides amounts.
3. **Oracle Worker** (`oracle-worker/worker.js`) — the only thing that talks
   to the chain on the detection side. Turns an agent trigger into a
   built proof (`oracle-worker/proofBuilder.js`, mocked - real version is a
   `@gluwa/usc-sdk` call) and submits it.
4. **SpaceShieldASC** (`contracts/SpaceShieldASC.sol`) — verifies the proof
   via the Attestcoin Block Prover precompile (`0x0FD2`, mocked locally by
   `MockBlockProver.sol` deployed at that address via `hardhat_setCode`).
   Requires `attestationThreshold` distinct registered oracles to
   independently verify the same outage before finalizing — no single
   oracle key can settle alone once threshold > 1. On finalize, calls
   `SettlementContract.registerSettlement()`. Does not decide who gets
   paid or how much.
5. **SpacecoinEscrow** (`contracts/SpacecoinEscrow.sol`) — models
   Spacecoin's real, documented on-chain payment mechanism (see §4). This
   is what makes someone a "subscriber": a live, on-chain, unforgeable fact,
   not a registration step SpaceShield controls.
6. **SettlementContract** (`contracts/SettlementContract.sol`) — holds
   operator bonds; `registerSettlement()` marks an outage claimable but
   pays no one; `claim()` is pulled by each subscriber individually, who
   is checked live against `SpacecoinEscrow` and paid pro-rata based on how
   long they've been subscribed relative to `COMPENSATION_WINDOW` (see §5).

## 3. Open question: where does satellite telemetry actually live?

Confirmed, from official Spacecoin docs and independent sources: **the
payment layer (SPACE token + escrow) lives on Creditcoin itself** — same
chain as SpaceShield's own contracts. That's why `SpacecoinEscrow` can be
read directly instead of needing cross-chain proof.

**Not confirmed either way:** whether satellite status/outage reporting is
*also* same-chain, or comes from a genuinely separate telemetry system.
Two scenarios, both currently supported by the architecture:

| If telemetry reporting is... | Then... |
|---|---|
| Same-chain (on Creditcoin, like payments) | The whole Attestcoin precompile layer (`SpaceShieldASC`'s call to `0x0FD2`) is unnecessary overhead — `MockSpacecoinSource`-equivalent could be listened to directly with normal same-chain event listening, no proof needed |
| Cross-chain (a separate telemetry chain) | The precompile layer is required exactly as built — this is what it's for |

**Decision: build for the cross-chain case (current code), because it's a
strict superset** — a same-chain telemetry source can still go through a
proof-verification step (it'd just always trivially succeed, or the step
gets removed later), but a genuinely cross-chain telemetry source has no
way to get verified without something like the precompile. Building for
the harder case first and simplifying later is safer than the reverse.

**Who can resolve this:** someone with access to Spacecoin's actual
satellite-to-chain reporting mechanism / their team directly. Not
resolvable by more reasoning from outside.

## 4. Subscriber verification: why escrow reads replaced Merkle snapshots

Original design (see git history) used a Merkle root an off-chain snapshot
service had to publish — real cryptography, but still a trust delegation
to whoever published the root.

Replaced after confirming (via docs.spacecoin.org and independent sources):
- SPACE is an ERC-20 on Creditcoin (`0x7ab7C6A935Ab2D1437398790C9C0660af62A80b9`)
- Spacecoin's payment mechanism is a smart-contract escrow, on that same
  chain: lock payment → operator proves service delivery → contract
  releases payment

Since it's the same chain, `SettlementContract.claim()` can just read
`SpacecoinEscrow` directly. No publisher, no snapshot staleness, no
allowlist SpaceShield itself controls.

**Fidelity note:** the mechanism and token address are confirmed from real
sources. The actual deployed escrow contract's address/ABI were not
independently locatable — `SpacecoinEscrow.sol` models the documented
mechanism faithfully but is not a verified copy of the real contract.

## 5. Compensation model: pro-rata, and why

Checking eligibility *live* (§4) creates an edge case: someone who starts
paying into escrow after an outage was already verified would, under a
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

- `SpacecoinEscrow` tracks `subscriptionStart` per (satellite, user) — the
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
| Oracle Worker | Whether to submit a proof | The precompile call has to actually succeed against real chain data — a fabricated proof is rejected (see `MockBlockProver`'s toy check; real precompile is cryptographically real) |
| A single oracle (if threshold=1) | Could submit whenever it wants | `attestationThreshold` > 1 requires independent agreement from multiple registered oracles |
| Anyone claiming compensation | Whether they're a real subscriber | Checked live against `SpacecoinEscrow`, which SpaceShield doesn't control — you actually have to have paid Spacecoin |
| Contract owner | Who's a registered operator/oracle | Still a single-key trust point — not solved, see README's gap list |
| Whoever computes `COMPENSATION_WINDOW`, bond sizing | Protocol parameters | Governance question, not a code question |

## 7. What does NOT exist yet (see README for full gap list)

No frontend dashboard, no persistence layer for the Oracle Worker beyond
contract-level idempotency, no real Spacecoin/Creditcoin testnet
deployment, no audit. This document describes the system that's built and
tested locally — README.md's "Known gaps" section is the authoritative
list of what's left.
