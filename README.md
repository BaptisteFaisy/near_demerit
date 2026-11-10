# Demerit

Reputation you can lose, not sell.

NEAR Hackathon 2026 — Ticket 10 "NFTs That Do Something" (Deadline: Nov 14, 2026, 23:59 UTC).

## What it does

- **Non-transferable licence (Soulbound NEP-171)**: professional licence token locked to an identity; transfers fail with `ERR_SOULBOUND`.
- **Lazy point scale**: points, cap, and status are computed deterministically on read from timestamps; zero background jobs or keepers.
- **Automatic suspension at zero**: reaching zero points suspends the holder across every checking platform, then restores a probationary licence.
- **Persistent record via identity fingerprint**: a salted hash carries prior suspensions, invalidations, and bonus-malus coefficient even if a fresh account is registered.
- **Professional bond & direct client compensation**: bonded NEAR funds an indemnity credited instantly to the wronged client upon a severe report.
- **Bonus-malus pricing**: a clean track record relaxes the required bond down to 50%; confirmed violations push it up to 350%.
- **Fleet delegations**: holders delegate work to employee accounts or AI agents; the holder's bond answers for delegated failures.
- **Appeals & supervised platforms**: contested reports can be reversed by the issuer; platforms lose their approval after three overturned strikes.

## Why NEAR

- **Named human-readable accounts**: licence tokens and checks map directly to recognizable identities (e.g. `lea.near`).
- **Sub-accounts and function-call access keys**: ideal native substrate for delegating authority to worker agents (e.g. `agent1.lea.near`).
- **Low cross-contract call costs**: platforms can afford an asynchronous `is_allowed` check on every single mission assignment.
- **Free open view calls**: any third party or wallet checks credentials at block timestamp with zero gas or transaction cost.

## "Do X -> See Y" (Workflow)

All steps execute deterministically without secrets.

| # | Command | What it does | Expected output | Approx. time |
|---|---|---|---|---|
| 1 | `make setup` | Installs wasm target, fetches crates, runs build | Toolchain ready, `BUILD OK` | ~1-3 min first run |
| 2 | `make build` | Compiles `demerit` and `missions` contracts to wasm32 | `BUILD OK` (`target/.../release/*.wasm`) | ~15 s |
| 3 | `make test` | Runs the unit tests (rules engine + contract with simulated clock) | `18 passed; 0 failed` | ~10 s |
| 4 | `make demo` | Runs the 9-step sandbox scenario (1 month = 2 s) | Formatted table, `DEMO OK (9/9)` | ~50 s |
| 5 | `make attack` | Executes 7 unauthorized / abusive operations | 7 rejected transactions, `ATTACK OK (7/7)` | ~20 s |
| 6 | `make sim` | Simulates 5 autonomous agents over 24 months | Summary table, `SIM OK (5/5)` + invariant I2 | ~30 s |
| 7 | `make web` | Serves the public query and dashboard page locally | HTTP server listening on `http://127.0.0.1:8080` | instant |
| 8 | `make web-smoke`| Headless validation of the static web interface | `WEB OK` | ~5 s |

## Sandbox binary

`make demo` and `make attack` run a real NEAR node in-process
(`near-workspaces` 0.24 + `near-sandbox`). The first run downloads `neard`.
If that download is blocked on your network, install a local sandbox and let
the Makefile pick it up:

```
npm i -g near-sandbox@0.3.5           # or: cargo install near-sandbox
export NEAR_SANDBOX_BIN_PATH=$(npm root -g)/near-sandbox/near-sandbox
```

No secret, no wallet, no testnet account is needed for any of the steps below.

## Architecture

The project contains two contracts, a shared deterministic rules module, and an integration harness:

```text
near-demerit/
├── contracts/
│   ├── demerit/      # Core registry: NEP-171, scale, bond, identity dossiers, delegations
│   └── missions/     # Demo platform: posts gigs, checks is_allowed, records outcomes
├── demo/             # Sandbox runner (demo 9 steps, attack suite, 5-agent sim)
├── docs/             # ABI, specifications, architectural decisions, threat model
└── web/              # Dependency-free static dashboard (HTML/CSS/JS)
```

## What is On-Chain / What is Off-Chain

- **On-chain**: point balances, probation caps, timestamp anchors, bonded balances, guarantee fund, recorded mission IDs, platform approvals, delegations, and NEP-297 events.
- **Off-chain**: the identity salt (held by the issuer), the legal KYC / identity verification process, and the client-side dashboard (`web/`).

## Standards & Invariants

- **Standards**: NEP-171 (read-only views: `nft_token`, `nft_metadata`), NEP-181 (enumeration), NEP-393 (non-transferable token patterns), and NEP-297 (events).
- **Core Invariant I2 (Conservation of Funds)**:
  $$\sum \text{bonds} + \text{fund} + \sum \text{credits} + \sum \text{in-flight mission rewards} = \sum \text{deposits} - \sum \text{withdrawals}$$
  Verified after every mutation in tests and sandbox scenarios.

## Threat Model Summary

Security relies on strict non-transferability, off-chain salted identity anchors, bounded penalties per report, and economic skin-in-the-game. Recreating an account preserves past infractions, unauthorized callers cannot record outcomes, and front-running bond withdrawals is blocked by minimum required balances. See `docs/THREAT-MODEL.md` for the full matrix.

## Limits & Trade-Offs

- **French driving licence is a model**: used as an algorithmic reference, not an official legal sanction system.
- **Private key sale**: selling the underlying NEAR account cannot be prevented on-chain, but the buyer inherits the bonded record and the issuer can revoke.
- **Off-chain KYC**: the integrity of unique dossiers depends on the issuer's off-chain identity verification.

## Roadmap & Status

- **Delivered (Level M / V1 Core)**: pure rules engine, `demerit` and `missions` contracts, NEP-171 read-only views, lazy point updates, sandbox demo, attack test suite, robot simulation, static web viewer.
- **Roadmap / Not built yet (Level MAX)**:
  - Decentralized peer jury with hash-commit-reveal voting (`EF-17`).
  - Automated client credibility deposits (`EF-17`).
  - Cross-chain attestations using NEAR Chain Signatures (`EF-19`).
  - ZK-proof of unique personhood replacing issuer salt (`EF-19`).
  - Dynamic on-chain SVG generative badge (`EF-19`).
  - Staking yields routing bonded collateral to the guarantee fund.

## Stack & AI Disclosure

- **Stack**: Rust, `near-sdk` 5.30.1 (`legacy` feature flag), `near-workspaces` 0.24 + `near-sandbox`, zero-dependency static web.
- **AI Disclosure**: Contract scaffolding, pure rules test vectors, and documentation drafts were generated with AI agents (ZeroClaw), then reviewed, adapted, and executed by the human author.
- **Repository isolation**: self-contained repository with zero hardcoded private keys or deployment secrets.

## Licence

MIT (see [LICENSE](LICENSE)). Complete specification available at [docs/SPEC.md](docs/SPEC.md).
