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
   (why things are built the way they are, not just what they are — read
   §4 and §4a especially, they document two real corrections made after
   research changed what was previously guessed at).
3. **`README.md`** — how to run the test suite and the live multi-process
   demo, plus the authoritative "Known gaps" and "What you need to do"
   lists.

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

- **Do not assume network egress is restricted.** An earlier version of
  this file claimed CelesTrak and Creditcoin/Spacecoin's real endpoints
  were unreachable "from this sandbox." That was true of one specific
  environment, not of every environment this repo runs in — a later
  session had full open network access, live-tested CelesTrak
  (`agent/public_tracker.py` against real satellite data), found and read
  Spacecoin's actual deployed payment contract on Creditcoin's own
  explorer, confirmed a real, live Creditcoin CC3-testnet RPC, and pulled
  the real Attestcoin precompile ABI from the `usc-sdk` npm package —
  which turned out to contradict a guess this codebase had shipped with
  (see `architecture.md` §4 and §4a). **Check for yourself before assuming
  either way** — try a real HTTP request to `celestrak.org` or the RPC
  below before deciding you're blocked:
  ```bash
  curl -s "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON"
  ```
  If that returns real data, you have real network access — use it. Don't
  build another mock or guess at an interface when you could just look the
  real thing up.
- `scripts/build.js` compiles with the `solc` npm package instead of
  `npx hardhat compile`. This was originally a network-access workaround;
  it's now kept as the default because it's faster, not because
  `npx hardhat compile` doesn't work — it does (`viaIR: true` is set in
  `hardhat.config.js` for exactly this purpose), if you have
  `binaries.soliditylang.org` reachable.
- Tests run with `npx hardhat test --no-compile`, not plain `npx hardhat
  test` — this one's still true regardless of network access, because the
  no-compile flag is what lets tests run against the manually-built
  `artifacts-manual/` output instead of triggering a second, redundant
  Hardhat-native compile.

- **Hardhat node backgrounding**: each fresh shell invocation in some
  environments does not persist background processes across calls — a
  `npx hardhat node &` started in one call can be dead by the next. Any
  live multi-process demo (node + deploy + oracle worker + agent) may need
  to happen in ONE shell invocation with everything backgrounded inside
  it, depending on your environment. See the "Run it live" section in
  README for the working pattern.

- **Nonce management bug to remember**: raw `ethers.Wallet` +
  `JsonRpcProvider` (as opposed to Hardhat's own signer plumbing via
  `ethers.getSigners()`) has been observed to reuse stale nonces across
  back-to-back deploys against a local node. `scripts/deploy.js` manages
  nonces explicitly with a counter for exactly this reason — don't remove
  that and go back to automatic nonce detection in that file.
  `scripts/deploy-testnet.js` (a real Creditcoin CC3-testnet deploy
  script, genuinely different from `deploy.js` — see its header) doesn't
  need this trick since it only ever has one signer.

- **The `solc`/hardhat compiler needs `viaIR: true`** — without it,
  `SpaceShieldASC.sol` hits a "stack too deep" error. Set in both
  `scripts/build.js` and `hardhat.config.js`. Don't remove this if you add
  contracts with several local variables in one function.

## Where things actually stand (as of this handoff)

**Fully real and tested:**
- All contract logic: bonding, pull-based claims, live coverage-based
  subscriber verification, pro-rata compensation, M-of-N oracle
  attestation, treasury-routed penalties, idempotent settlement.
- The AI Agent's detection/cross-check/confirmation-floor logic.
- The public tracker client — real CelesTrak integration, live-verified
  against real satellite data (catalog 25544 / ISS), not just
  mocked-HTTP-tested.
- The Oracle Worker's HTTP trigger -> proof -> submit flow, now importing
  real generated contract ABIs instead of hand-typed fragments (a
  hand-typed ASC ABI fragment here previously drifted from the real
  contract signature and nobody would have caught it until a real tx
  reverted — don't reintroduce hand-typed ABI strings, import from
  `artifacts-manual/`).
- CI (`.github/workflows/test.yml`) and bond-health monitoring
  (`scripts/monitor_bonds.js`).
- **The frontend** — a full wallet-connected dApp (RainbowKit/wagmi),
  not just a marketing page. See "On the frontend" below; the old version
  of this section describing "no functional app exists" is gone because
  it stopped being true.
- **CoverageVault.sol** (was `SpacecoinEscrow.sol`) — SpaceShield's own
  coverage contract. Its mechanics were always real; only its *name and
  docstring* were wrong (claimed to model a Spacecoin contract it didn't
  actually match — see `architecture.md` §4).
- **The Attestcoin precompile interface** in `SpaceShieldASC.sol` — the
  real `INativeQueryVerifier.verify` struct-based ABI, confirmed from the
  `usc-sdk` package, not a guess. See `architecture.md` §4a; this touched
  `MockBlockProver.sol`, both proof builders (oracle-worker and frontend
  `demoTrigger.js`), and test fixtures too — they all had to move together.
- **Creditcoin CC3-testnet deployment infrastructure**
  (`hardhat.config.js`'s `creditcoinTestnet` network, chain ID 102031,
  confirmed real and live; `scripts/deploy-testnet.js`) — the
  infrastructure is real and ready; it has NOT actually been run, because
  that needs a funded private key nobody but the project owner can
  provide. Don't mark this "done" — it's "ready," which is different.

**Deliberately mocked, with a documented real-world grounding:**
- `MockSpacecoinSource.sol` — satellite status/telemetry. Whether this
  should be same-chain (like payments turned out to be) or genuinely
  cross-chain is an OPEN QUESTION — see `architecture.md` §3. Don't resolve
  this by guessing; it needs actual information about Spacecoin's telemetry
  architecture, which is a different question from "is the network
  reachable" — real network access doesn't answer this one.
- `MockBlockProver.sol` — stand-in for Creditcoin's native precompile at
  `0x0FD2`, installed at that exact address locally via `hardhat_setCode`.
  Now speaks the confirmed-real ABI, but whether the real precompile is
  actually live at that address on CC3-testnet with this interface is
  still unverified — `eth_getCode` there returns empty, which is
  *consistent* with a genuine precompile (they're native VM logic, not
  deployed bytecode) but doesn't prove it. Only a real `verifyOutage()`
  call against testnet would confirm it either way.
- `oracle-worker/proofBuilder.js` — the proof *shape* is now real
  (struct-based, matching the confirmed interface); the proof *content* is
  still fabricated, because there's no real Spacecoin transaction yet to
  build a genuine proof from. Swapping this function's body for a real
  `usc-sdk` `ProofBuilder` call, once telemetry is real, is the remaining
  migration step.

**Not built, or intentionally left as a decision point:**
- Persistence for the Oracle Worker beyond the contracts' own idempotency.
- A real testnet deployment (infrastructure exists, hasn't been run — see
  above).
- Whether `CoverageVault` should read Spacecoin's real `TokenPaymentEscrow`
  (found at `0xC130F5D76f0b4Ce8FE2ceA0D2C2b8f53A39a5cd0` on Creditcoin
  mainnet, source verified) as an additional signal is a genuine product
  decision, not an engineering task — don't build this speculatively.
- A security audit or legal review (out of scope for an engineering
  session regardless of environment).

## On the frontend

The frontend is real and substantial — do not describe it as absent or as
"just a marketing page." Two routes, both live:

1. **`/` (Landing)** — marketing site: hero, problem statement, a
   deliberately-labeled illustrative simulator (fake timers, clearly
   captioned as such — the REAL pipeline lives at `/app/network`'s
   "Trigger outage," not here), architecture explainer, case studies, FAQ,
   footer. Dark theme, blue accent, its own design system in
   `frontend/src/index.css` under `.landing-dark`.
2. **`/app/*` (the dApp)** — wallet-connected, RainbowKit/wagmi, light
   theme: Dashboard (coverage status, claimable outages, real
   `lockCoverage`/`claim`/`withdrawCoverage` transactions), Network (public
   transparency page — bond health, telemetry, and a real
   "Trigger outage" button that runs the actual detect→prove→verify→settle
   pipeline as real transactions on the local chain), History (full audit
   log with expandable proof chains), Settings.

Both share one token-based CSS system (`frontend/src/index.css`) — the
landing page's dark palette is a scoped override (`.landing-dark`), not a
separate stylesheet, so most re-theming work is a token change, not a
per-component rewrite. Read the file's own comments before restyling
anything; there's real design reasoning recorded there (e.g. why certain
elements deliberately have no glow/blur effects, why the brand wordmark
uses a dedicated `--brand-font` distinct from the rest of the type system).

## If you're asked to keep closing gaps

Check README.md's "Known gaps" and "What you need to do" sections first —
they're kept current and are the single source of truth for what's left.
As of this handoff, in rough priority order:

1. Get `scripts/deploy-testnet.js` actually run (needs a funded key from
   the project owner — you cannot generate testnet funds yourself).
2. Resolve the same-chain-vs-cross-chain telemetry question (needs real
   information from Spacecoin's team, not more reasoning — flag this
   clearly if asked to "just solve it").
3. Decide (with the project owner, not unilaterally) whether
   `CoverageVault` should integrate `TokenPaymentEscrow` as a secondary
   signal.
4. Persistence/retry-queue for the Oracle Worker.
5. Multi-satellite load testing.

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
  §4, §4a, and §5 for three examples — two of them corrections of earlier
  guesses that turned out wrong once real data was available), update the
  code AND the docs in the same pass — don't let README/architecture.md
  drift from what the contracts actually do. Two of this codebase's
  biggest mistakes were plausible-sounding guesses (a contract's real
  behavior, a precompile's real ABI) presented with the same confidence as
  verified facts — when you don't actually have network access or a
  primary source to check something against, say so explicitly rather
  than writing a docstring that reads as confirmed.
