# Getting a licence in the V27 app — option A (blocked) / option B (live)

Date: 2026-11-13 · deadline of the submission: **2026-11-14 23:59 UTC = 15/11 00:59 Paris**.

## The question

A visitor opens the app and wants a licence. `ledger.issue(account, category, identity)`
is reserved to the issuer (`issuer.demerit.testnet`), so nobody else can sign it.
Two ways out were proposed:

- **Option A** — a Vercel serverless function `/api/issue` that holds the issuer key in
  a Vercel environment variable, issues one demo licence per connected account,
  with a small maximum debit.
- **Option B** — no public issuance. Visitors read the licences that are already
  issued (demo accounts) and use the public check.

## Decision: option B, because option A cannot be done from here

Verified on 2026-11-13, 00:15–01:05 (Paris):

1. **The issuer private key is not on any reachable machine.**
   - `r630` (`/home/baptiste`): no `~/.near-credentials`, no `issuer.demerit.*` file.
   - `ms7d18` (workstation): `~/.near-credentials/accounts.json` *lists* the accounts
     (`issuer.demerit.testnet`, `ledger.demerit.testnet`, `lea.demerit.testnet`,
     `lea2.demerit.testnet`, `client.demerit.testnet`, `agent1.lea.demerit.testnet`,
     `platform.demerit.testnet`, `missions.demerit.testnet`, `demerit.testnet`,
     `registry.demerit.testnet`), but **no key file exists** for any of them in
     `~/.near-credentials/testnet/` (the directory holds only the other projects:
     `upfront`, `hireclaw`, `perish`, `bankkeeper`, `mandat26`…). The keys were on the
     Windows PC that ran `make testnet` (`C:\chemin\vers\near_demerit`).
   - The packaged delivery (`demerit-V27-pour-Baptiste.zip`) contains **no key**: only
     `fichiers.zip` (the design), `LISEZ-MOI.md`, `PR.md`, `publier.ps1`, `FICHIERS.txt`.
   - The git history contains no key either (no `out/`, no `.near-credentials`).
   Without the issuer key, `ledger.issue` can never be signed. No workaround exists:
   the key is the only signer of that call.
2. **No Vercel access from here.** A `~/.config/vercel/auth.json` was visible on
   `ms7d18` at 23:19 and had disappeared by 00:15 (the same cleanup wave that removed
   runner directories and units on this box, cf. `memory/2026-11-13.md`). No
   `vercel` CLI, no token in the environment, no token in the repo secrets.
3. **Even with the key**, option A is a 1 h+ job before the deadline: a serverless
   function that signs a NEAR transaction (Borsh + ed25519 + nonce + block hash),
   the 1-licence-per-account guard, the Vercel env var, the deploy, the UI wiring and
   an end-to-end test. There was no time before 15/11 00:59.

So the app ships **option B**, and option A stays documented below — it is a
one-variable change once somebody who holds the key is in front of a terminal.

## Option B, as shipped

- `web/licence-demo.js` (new): on the licence page, a card **“Demo licences — already
  issued on NEAR testnet”** lists the two real licences and reads their live state
  through the public JSON-RPC (free view calls, no wallet, no signature).
- The card is honest about the reason: the issuer holds the key, a visitor cannot get
  a licence signed on the spot; these two licences are real and readable on chain.
- The public check (`#/check`) still reads any account, live, for free.

### Proof, read from `ledger.demerit.testnet` on testnet (2026-11-13, ~00:40 Paris)

`status(account, category:"coursier")` via `https://rpc.testnet.fastnear.com`:

| Account | Licence | State | Points | Deposit locked / required | Coefficient | Allowed |
|---|---|---|---|---|---|---|
| `lea.demerit.testnet` | `demerit-1` | active | 12/12 | 0.17 Ⓝ / 0.125 Ⓝ | ×1.25 | ✅ |
| `lea2.demerit.testnet` | `demerit-2` | active | 6/12 | 0.06 Ⓝ / 0.125 Ⓝ | ×1.25 | ❌ under-deposit |

`lea2` is the same person with a new account: the record follows the identity, not
the account — the deposit is too low, so every platform refuses it
(`ERR_UNDER_BONDED`). That is the “one licence per person” rule, proven on chain.
`agent1.lea.demerit.testnet` and `client.demerit.testnet` have no licence of their own
(`ERR_NO_LICENSE`): the first is a delegated agent, the second a customer.

Explorer: <https://testnet.nearblocks.io/address/lea.demerit.testnet>

## Option A, ready to switch on (what to do, exactly)

The day the issuer key is available:

1. **Never** put the key in the repo, in `web/`, in a `.env` committed, or in a log.
   It lives only in the Vercel project environment variable
   `DEMERIT_ISSUER_SECRET_KEY` (ed25519 secret key of `issuer.demerit.testnet`).
2. Add `api/issue.js` at the repository root (Vercel Serverless Function, Node 20):
   - `POST` body `{ account_id, identity }` (the identity fingerprint is salted
     off-chain by the issuer; the function never stores it);
   - read `status(account, "coursier")` first → if a licence already exists,
     answer `409 { "error": "already licensed" }` (**one licence per account**);
   - attach the deposit (`required_bond`, `1.25 Ⓝ` at coefficient ×1.25) and sign
     `issue(account, category:"coursier", identity)` with the issuer key, then send it;
   - answer `{ "ok": true, "tx": "<hash>", "token_id": "demerit-<n>" }`.
   The page never holds a key; only the function does.
3. Add a small maximum debit per day on the function (a Vercel KV counter or the
   `fund` view of the contract) so a public endpoint cannot be drained.
4. Wire the app: the “Lock 1 Ⓝ and get my licence” button calls `POST /api/issue`
   and shows the transaction hash + explorer link.
5. Test with the shipped script’s dry-run flag — note: in the delivered zip the flag
   is `-Essai` (`publier.ps1 -Repo "<path>" -Essai`), **not** `-DryRun`; it stops
   after the local commit and pushes nothing. It also refuses to run on a dirty repo.

## Scripts in the repo (unchanged)

- `make build` / `make test` — contracts (Rust, wasm).
- `make web-v28` — headless check of the three public pages (`web/scripts/v27-check.mjs`).
- `make web-live-smoke` — headless check against the live testnet node.
