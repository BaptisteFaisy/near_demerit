#!/usr/bin/env bash
# Deploy Demerit to NEAR testnet, seed a readable scenario, print the addresses.
#
#   bash scripts/testnet.sh              # real run
#   bash scripts/testnet.sh --dry-run    # print every command, send nothing
#
# Idempotent: existing accounts are kept, existing contracts are redeployed.
# Keys stay in ~/.near-credentials (near-cli-rs keychain); nothing secret is
# written to the repository. `out/` is git-ignored.
set -euo pipefail

ROOT="${ROOT:-demerit.testnet}"
NETWORK="${NETWORK:-testnet}"
RPC="${RPC:-https://rpc.testnet.near.org}"
WASM_DIR="${WASM_DIR:-target/wasm32-unknown-unknown/release}"
OUT="${OUT:-out/testnet.json}"
# Read-only views go through this helper: JSON in, JSON out, no CLI banner.
VIEW_PY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/view.py"
CATEGORY="coursier"
# One simulated month on testnet: 10 minutes, so regeneration (6 months) and
# suspension (6 months) are observable within an hour instead of half a year.
MONTH_NS=600000000000
BOND="0.1 NEAR"
REWARD="0.05 NEAR"
DEPOSIT="0.02 NEAR"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1


REGISTRY="ledger.$ROOT"
PLATFORM="platform.$ROOT"
ISSUER="issuer.$ROOT"
LEA="lea.$ROOT"
LEA2="lea2.$ROOT"
CLIENT="client.$ROOT"
AGENT="agent1.lea.$ROOT"

log() { printf '\033[1;34m->\033[0m %s\n' "$*"; }
# near-cli-rs sometimes signs against a reference block that has aged out
# ("Transaction has expired") or hits a flaky RPC: the transaction was never
# applied, so re-signing and re-sending is safe. Anything else fails at once.
TRANSIENT='Transaction has expired|[Nn]once|timed out|timeout|error sending request|Connection|Too Many Requests|429|Exceeded'
run() {
  if [ "$DRY" = 1 ]; then printf 'DRY %s\n' "$*"; return 0; fi
  local attempt out
  for attempt in 1 2 3 4; do
    if out=$("$@" 2>&1); then printf '%s\n' "$out"; return 0; fi
    printf '%s\n' "$out"
    printf '%s' "$out" | grep -Eq "$TRANSIENT" || return 1
    log "transient failure (attempt $attempt/4), retrying in 5 s"
    sleep 5
  done
  return 1
}

# Scenario signers must keep enough liquid NEAR for gas and deposits; a run that
# stopped halfway can leave them short, so top up from the root when needed.
ensure_balance() { # <account> <minimum NEAR>
  local have delta
  [ "$DRY" = 1 ] && { log "DRY: ensure $1 >= $2 NEAR"; return 0; }
  have=$(balance_near "$1")
  delta=$(python3 -c "print(round(max(0.0, $2 - float('$have')), 3))")
  if [ "$delta" = "0.0" ]; then log "$1 holds $have NEAR (>= $2)"; return 0; fi
  log "topping up $1: $have -> $2 NEAR (+$delta from $ROOT)"
  transfer_near "$ROOT" "$1" "$delta NEAR"
}

# Existence and balance straight from the RPC: no CLI subcommand to guess.
rpc() {
  curl -s -m 20 "$RPC" -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"$1\",\"params\":$2}"
}

exists() { rpc query "{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}" | grep -q '"amount"'; }

balance_near() {
  rpc query "{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}" \
    | python3 -c 'import json,sys; print(round(int(json.load(sys.stdin).get("result",{}).get("amount",0))/1e24, 3))' 2>/dev/null || echo 0
}

# The faucet rate-limits by IP (429 "retry in N hours"); keep trying.
create_root() {
  if [ "$DRY" = 1 ]; then log "DRY: faucet create $ROOT"; return 0; fi
  if exists "$ROOT"; then log "$ROOT already exists"; return 0; fi
  local attempt
  for attempt in $(seq 1 40); do
    log "faucet: creating $ROOT (attempt $attempt)"
    if near account create-account sponsor-by-faucet-service "$ROOT" \
        autogenerate-new-keypair save-to-keychain network-config "$NETWORK" create; then
      return 0
    fi
    sleep 60
  done
  echo "faucet never answered for $ROOT" >&2
  return 1
}

transfer_near() { # <from> <to> <amount>
  run near tokens "$1" send-near "$2" "$3" network-config "$NETWORK" sign-with-keychain send
}

create_sub() { # <name> <balance> [parent]
  local id="$1.$ROOT" parent="${3:-$ROOT}"
  if exists "$id"; then log "$id already exists"; return 0; fi
  log "creating $id with $2 (signed by $parent)"
  run near account create-account fund-myself "$id" "$2" \
    autogenerate-new-keypair save-to-keychain sign-as "$parent" \
    network-config "$NETWORK" sign-with-keychain send
}

deploy() { # <account> <wasm>
  log "deploying $2 on $1"
  run near contract deploy "$1" use-file "$WASM_DIR/$2" without-init-call \
    network-config "$NETWORK" sign-with-keychain send
}

call() { # <signer> <contract> <method> <json> <deposit> [gas]
  local gas="${6:-290.0 Tgas}"
  run near contract call-function as-transaction "$2" "$3" json-args "$4" \
    prepaid-gas "$gas" attached-deposit "$5" sign-as "$1" \
    network-config "$NETWORK" sign-with-keychain send
}

view() { # <contract> <method> <json> — clean JSON via the RPC helper
  local attempt
  for attempt in 1 2 3; do
    if python3 "$VIEW_PY" "$1" "$2" "$3" "$RPC"; then return 0; fi
    sleep 3
  done
  return 1
}

rules_json() {
  python3 - "$MONTH_NS" <<'PY'
import json, sys
month = int(sys.argv[1])
print(json.dumps({
    "max_points": 12, "probation_points": 6, "probation_gain": 2,
    "light_loss": 1, "medium_loss": 3, "severe_loss": 6,
    "regen_points": 1, "regen_after_months": 6, "full_regen_after_months": 24,
    "stage_points": 4, "stage_streak": 5, "suspension_months": 6,
    "month_seconds": month,
    "severe_compensation": "20000000000000000000000",
    "fund_share_pct": 20,
    "contest_window_seconds": 604800,
    "contest_deposit": "20000000000000000000000",
    "platform_strike_limit": 3,
}))
PY
}

# NEAR the root still has to spend: storage is 1 NEAR per 100 kB (registry wasm
# 321 kB = 3.3, platform 181 kB = 2.0) plus the scenario. Accounts already
# funded by an interrupted run are not paid twice, and 0.5 covers gas.
required_balance() {
  local plan name bal need=0.5
  for plan in registry:3.6 missions:2.3 issuer:0.5 lea:0.6 lea2:0.4 client:0.6; do
    name="${plan%%:*}.$ROOT"
    bal="${plan##*:}"
    exists "$name" || need=$(python3 -c "print(round($need + $bal, 2))")
  done
  echo "$need"
}

main() {
  [ -f "$WASM_DIR/demerit.wasm" ] || { echo "run 'make build' first" >&2; exit 1; }
  create_root
  if [ "$DRY" != 1 ]; then
    local root_balance needed
    root_balance=$(balance_near "$ROOT")
    needed=$(required_balance)
    log "root balance: $root_balance NEAR (still needs about $needed)"
    if ! python3 -c "import sys; sys.exit(0 if float('$root_balance') >= float('$needed') else 1)"; then
      echo "FATAL: $ROOT holds $root_balance NEAR; at least $needed are needed" >&2
      echo "       (registry wasm 321 kB = 3.3 NEAR, platform 181 kB = 2.0 NEAR)" >&2
      exit 1
    fi
  fi
  # Storage is 1 NEAR per 100 kB: the registry wasm costs ~3.3, the platform ~1.9.
  create_sub ledger "3.6 NEAR"
  create_sub platform "2.3 NEAR"
  create_sub issuer "0.5 NEAR"
  create_sub lea "0.6 NEAR"
  create_sub lea2 "0.4 NEAR"
  create_sub client "0.6 NEAR"
  create_sub agent1.lea "0.3 NEAR" "lea.$ROOT"
  ensure_balance "$LEA" "0.6"
  ensure_balance "$CLIENT" "0.5"
  ensure_balance "$ISSUER" "0.4"
  deploy "$REGISTRY" demerit.wasm
  deploy "$PLATFORM" missions.wasm
  init_contracts
  seed
  verify
  write_addresses
}

init_contracts() {
  log "initialising the registry (issuer = $ISSUER)"
  call "$ISSUER" "$REGISTRY" new '{}' '0 NEAR' || log "registry already initialized"
  log "initialising the platform"
  call "$ISSUER" "$PLATFORM" new \
    "{\"registry\":\"$REGISTRY\",\"category\":\"$CATEGORY\",\"min_points\":null}" '0 NEAR' || log "platform already initialized"
  log "creating the category $CATEGORY (1 month = $((MONTH_NS / 1000000000)) s)"
  call "$ISSUER" "$REGISTRY" create_category \
    "{\"id\":\"$CATEGORY\",\"rules\":$(rules_json),\"base_bond\":\"100000000000000000000000\"}" '0 NEAR' || log "category already exists"
  log "approving the platform"
  call "$ISSUER" "$REGISTRY" approve_platform \
    "{\"category\":\"$CATEGORY\",\"account\":\"$PLATFORM\"}" '0 NEAR' || log "platform already approved"
}

seed() {
  log "issuing licences"
  call "$ISSUER" "$REGISTRY" issue "{\"account\":\"$LEA\",\"category\":\"$CATEGORY\",\"identity\":\"fp-lea-demo\"}" "$BOND" || log "lea licence already issued"
  call "$ISSUER" "$REGISTRY" issue "{\"account\":\"$LEA2\",\"category\":\"$CATEGORY\",\"identity\":\"fp-lea2-demo\"}" "$BOND" || log "lea2 licence already issued"
  mission "clean"
  mission "light"
  mission "medium"
  log "delegating to $AGENT for 30 days"
  local until
  until=$(python3 -c 'import time;print(int((time.time()+30*86400)*1e9))')
  call "$LEA" "$REGISTRY" delegate \
    "{\"category\":\"$CATEGORY\",\"delegate\":\"$AGENT\",\"expires_at\":\"$until\"}" '0 NEAR' '50.0 Tgas' || log "delegation already done"
  mission "severe"
  log "contesting the severe report, then winning the appeal"
  call "$LEA" "$REGISTRY" contest "{\"category\":\"$CATEGORY\",\"mission_id\":\"m-$MISSION_N\"}" "$DEPOSIT" '100.0 Tgas'
  call "$ISSUER" "$REGISTRY" resolve_contest \
    "{\"category\":\"$CATEGORY\",\"mission_id\":\"m-$MISSION_N\",\"upheld\":false}" '0 NEAR' '100.0 Tgas'
}

# Where a mission stands on chain, so an interrupted run resumes instead of
# posting it twice: none | open | accepted | closed
mission_state() { # <mission id>
  if [ "$DRY" = 1 ]; then echo "none"; return 0; fi
  python3 - "$VIEW_PY" "$PLATFORM" "$1" "$RPC" <<'PY'
import sys
sys.path.insert(0, sys.argv[1].rsplit("/", 1)[0])
from view import call
try:
    missions = call(sys.argv[2], "missions", "{}", sys.argv[4])
except Exception:
    print("none")
    sys.exit(0)
found = next((m for m in missions if m.get("id") == int(sys.argv[3])), None)
if not found:
    print("none")
elif found.get("state") == "closed":
    print("closed")
elif found.get("worker"):
    print("accepted")
else:
    print("open")
PY
}

mission() { # <outcome> — post, accept, close through the platform contract
  local n="${MISSION_N:-0}" outcome="$1" state
  MISSION_N=$((n + 1))
  state=$(mission_state "$MISSION_N")
  log "mission $MISSION_N ($outcome): on chain = $state"
  if [ "$state" = "closed" ]; then log "mission $MISSION_N already closed"; return 0; fi
  if [ "$state" = "none" ]; then
    call "$CLIENT" "$PLATFORM" post '{"reward":"50000000000000000000000"}' "$REWARD"
  fi
  if [ "$state" != "accepted" ]; then
    # accept attaches 10 + 15 Tgas of cross-contract gas, keep some headroom.
    call "$LEA" "$PLATFORM" accept "{\"mission_id\":$MISSION_N}" '0 NEAR' '100.0 Tgas'
  fi
  call "$CLIENT" "$PLATFORM" close "{\"mission_id\":$MISSION_N,\"outcome\":\"$outcome\"}" '0 NEAR'
}

verify() {
  if [ "$DRY" = 1 ]; then log "DRY: read-only checks skipped"; echo "TESTNET OK (dry-run)"; return 0; fi
  local checks=0 ok=0
  log "reading back the registry"
  for spec in "status:{\"account\":\"$LEA\",\"category\":\"$CATEGORY\"}" \
              "categories:{}" \
              "fund:{}" \
              "clock:{}"; do
    local m="${spec%%:*}" a="${spec#*:}"
    checks=$((checks + 1))
    if view "$REGISTRY" "$m" "$a" >/dev/null 2>&1; then ok=$((ok + 1)); else
      echo "view $m failed" >&2; fi
  done
  checks=$((checks + 1))
  if view "$PLATFORM" missions '{}' >/dev/null 2>&1; then ok=$((ok + 1)); else
    echo "view missions failed" >&2; fi
  echo "registry status: $(view "$REGISTRY" status "{\"account\":\"$LEA\",\"category\":\"$CATEGORY\"}" 2>/dev/null | head -c 400)"
  echo "fund: $(view "$REGISTRY" fund '{}' 2>/dev/null | head -c 120)"
  if [ "$ok" = "$checks" ]; then echo "TESTNET OK ($ok/$checks)"; else
    echo "TESTNET KO ($ok/$checks)"; exit 1; fi
}

write_addresses() {
  if [ "$DRY" = 1 ]; then log "DRY: $OUT and web/config.js not written"; return 0; fi
  mkdir -p out
  cat > "$OUT" <<JSON
{
  "network": "$NETWORK",
  "rpc": "$RPC",
  "root": "$ROOT",
  "registry": "$REGISTRY",
  "missions": "$PLATFORM",
  "issuer": "$ISSUER",
  "lea": "$LEA",
  "lea2": "$LEA2",
  "client": "$CLIENT",
  "agent": "$AGENT",
  "category": "$CATEGORY"
}
JSON
  python3 - "$OUT" <<'PY'
import json, pathlib, sys
cfg = json.loads(pathlib.Path(sys.argv[1]).read_text())
p = pathlib.Path("web/config.js")
s = p.read_text()
for key, value in (("contract", cfg["registry"]), ("missions", cfg["missions"]),
                   ("rpc", cfg["rpc"]), ("category", cfg["category"])):
    import re
    s = re.sub(r"(\b%s:\s*)'[^']*'" % key, r"\1'%s'" % value, s)
p.write_text(s)
print("web/config.js updated")
PY
  log "addresses written to $OUT"
  cat "$OUT"
}

main "$@"
