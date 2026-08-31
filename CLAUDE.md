# CLAUDE.md — Handoff Notes

You're picking up SpaceShield: an automated satellite-outage compensation
protocol (Spacecoin satellites -> Attestcoin proof verification ->
Creditcoin settlement). This file is for a fresh agent with zero prior
context. Read this first, then `architecture.md` for design, then
`README.md` for how to run things.

## Read these in order

1. **This file** — orientation, what's real vs. mocked, how to verify
   nothing's broken before you touch anything.
2. **`architecture.md`** — system design, trust boundaries, decision log
   (why things are built the way they are, not just what they are).
3. **`README.md`** — how to run the test suite and the live multi-process
   demo, plus the authoritative "Known gaps" list.

## First thing to do: verify the baseline

Before changing anything, confirm the current state actually works:

```bash
npm install
node scripts/build.js
npx hardhat test --no-compile        # expect 16 passing
python3 -m unittest agent/test_public_tracker.py -v   # expect 6 passing
```

If either of those doesn't pass cleanly, something broke between sessions
— don't build on top of a broken baseline, fix it first.

## Critical context that isn't obvious from the code alone

- **This sandbox's network egress is allowlisted to package registries
  only** (npm, pypi, github). `celestrak.org` and Creditcoin/Spacecoin's
  real endpoints are NOT reachable from here. This is why:
  - `scripts/build.js` compiles with the `solc` npm package instead of
    `npx hardhat compile` (which needs `binaries.soliditylang.org`).
  - Tests run with `npx hardhat test --no-compile`, not plain `npx hardhat
    test` (the latter tries to compile first and will fail here).
  - `agent/public_tracker.py`'s live CelesTrak calls will get a real
    network-layer rejection here, and that's expected — the code is real
    and correct, verified by mocked-HTTP unit tests instead.
  - If you're running in a *different* environment with open network
    access, all of this "just works" — try `npx hardhat compile` and
    `--tracker-mode live` for real.

- **Hardhat node backgrounding**: each `bash_tool` call in this environment
  is a fresh shell — a `npx hardhat node &` started in one call is dead by
  the next call. Any live multi-process demo (node + deploy + oracle
  worker + agent) has to happen in ONE shell invocation with everything
  backgrounded inside it. See the "Run it live" section in README for the
  working pattern — copy it, don't rebuild it from scratch.

- **Nonce management bug to remember**: raw `ethers.Wallet` +
  `JsonRpcProvider` (as opposed to Hardhat's own signer plumbing via
  `ethers.getSigners()`) has been observed to reuse stale nonces across
  back-to-back deploys against a local node. `scripts/deploy.js` manages
  nonces explicitly with a counter for exactly this reason — don't remove
  that and go back to automatic nonce detection in that file.

- **The `solc` compiler needs `viaIR: true`** (`scripts/build.js`) —
  without it, `SpaceShieldASC.sol` hits a "stack too deep" error. Don't
  remove this if you add contracts with several local variables in one
  function.

## Where things actually stand (as of this handoff)

**Fully real and tested:**
- All contract logic: bonding, pull-based claims, live escrow-based
  subscriber verification, pro-rata compensation, M-of-N oracle
  attestation, treasury-routed penalties, idempotent settlement.
- The AI Agent's detection/cross-check/confirmation-floor logic.
- The public tracker client (real CelesTrak integration, verified via
  mocked-HTTP tests since live calls are blocked here).
- The Oracle Worker's HTTP trigger -> proof -> submit flow.
- CI (`.github/workflows/test.yml`) and bond-health monitoring
  (`scripts/monitor_bonds.js`).

**Deliberately mocked, with a documented real-world grounding:**
- `MockSpacecoinSource.sol` — satellite status/telemetry. Whether this
  should be same-chain (like payments turned out to be) or genuinely
  cross-chain is an OPEN QUESTION — see `architecture.md` §3. Don't resolve
  this by guessing; it needs actual information about Spacecoin's telemetry
  architecture that isn't available from this sandbox.
- `SpacecoinEscrow.sol` — models Spacecoin's real, documented payment
  mechanism (confirmed via docs.spacecoin.org + the real SPACE token
  contract address on Creditcoin) but is not a verified copy of Spacecoin's
  actual deployed escrow contract, which wasn't independently locatable.
- `MockBlockProver.sol` — stand-in for Creditcoin's native precompile at
  `0x0FD2`, installed at that exact address locally via `hardhat_setCode`
  so the real ASC code never has to change.
- `oracle-worker/proofBuilder.js` — fabricates a proof shaped to satisfy
  the mock verifier; swapping this for a real `@gluwa/usc-sdk` call is the
  entire migration path to production.

**Not built at all:**
- Any frontend dashboard/app for subscribers, operators, or oracle
  operators to actually use this. See "On the frontend" below — there IS a
  separate marketing/demo landing page, but it's not connected to the
  contracts and isn't a functional app.
- Persistence for the Oracle Worker beyond the contracts' own idempotency.
- A real testnet deployment.
- A security audit or legal review (out of scope for an engineering
  session regardless of environment).

## On the frontend

There are two genuinely separate things people might mean by "the app" in
this project, and they are NOT connected to each other:

1. **`spaceshield-prototype.html`** (delivered earlier in this
   conversation, not in this zip) — a single-page marketing/demo landing
   site in a specific visual design language, with an animated settlement
   *simulator* (fake timers, fake data, illustrative only). It has no wallet
   connection, no real contract calls, and was never meant to. Sections:
   hero, problem statement, simulator, architecture explainer, MVP scope,
   FAQ, footer.
2. **This repo** — the actual contracts, agent, and oracle worker. No UI
   at all; everything is exercised via Hardhat tests or the CLI-based live
   demo in README.

**If asked to build a real, functional app**, these are two different
follow-on projects that would both need to exist and then be wired
together: a wallet-connected frontend calling these real contracts, replacing
the fake-data landing page simulator. Plausible pages for that real app,
roughly in priority order if this ever gets built:
- **Subscriber dashboard** — connect wallet, see coverage status
  (`escrow.isActiveSubscriber`), lock/withdraw coverage, see claimable
  outages and claim them (`settlement.claim`).
- **Operator dashboard** — bond management (lock/top-up), see bond health,
  see registered satellites and pending settlements.
- **Oracle/admin console** — for whoever runs oracle infrastructure:
  registered oracles, attestation threshold, manual trigger/monitoring.
- **Public transparency page** — no wallet needed: live bond health per
  satellite (reuses `scripts/monitor_bonds.js`'s logic), settlement
  history, uptime stats. This is the one closest in spirit to the existing
  marketing landing page and could plausibly reuse its visual design.

None of this exists yet. Don't assume a dashboard exists because the
landing page LOOKS like a product site — it's a pitch artifact, not
connected to anything.

## If you're asked to keep closing gaps

Check README.md's "Known gaps" section first — it's kept current and is
the single source of truth for what's left. As of this handoff, the
highest-value remaining items in rough priority order:

1. Resolve the same-chain-vs-cross-chain telemetry question (needs real
   information, not more reasoning — flag this clearly if asked to "just
   solve it").
2. Real Spacecoin/Creditcoin testnet integration (needs actual network
   access this sandbox doesn't have — if you're in an environment WITH
   access, this is the highest-value real next step).
3. Persistence/retry-queue for the Oracle Worker.
4. Multi-satellite load testing.
5. A real frontend, per "On the frontend" above.

## Style/process notes worth preserving

- Every mock in this codebase has a docstring explaining exactly what's
  real, what's illustrative, and what would need to change for production
  — keep that pattern. A mock without that context is a liability for the
  next person (or agent) touching it.
- Tests were written to prove failure modes, not just happy paths (forged
  proofs, double-claims, bond depletion, disagreeing oracles, withdrawn
  coverage). Keep adding failure-mode tests alongside new features, not
  after.
- When a research finding changes the architecture (see `architecture.md`
  §4 and §5 for two examples), update the code AND the docs in the same
  pass — don't let README/architecture.md drift from what the contracts
  actually do.
