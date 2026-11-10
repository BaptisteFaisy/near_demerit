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
CATEGORY="coursier"
# One simulated month on testnet: 10 minutes, so regeneration (6 months) and
# suspension (6 months) are observable within an hour instead of half a year.
MONTH_NS=600000000000
BOND="0.1 NEAR"
REWARD="0.05 NEAR"
DEPOSIT="0.02 NEAR"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1


REGISTRY="registry.$ROOT"
PLATFORM="missions.$ROOT"
ISSUER="issuer.$ROOT"
LEA="lea.$ROOT"
LEA2="lea2.$ROOT"
CLIENT="client.$ROOT"
AGENT="agent1.lea.$ROOT"

log() { printf '\033[1;34m->\033[0m %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then printf 'DRY %s\n' "$*"; else "$@"; fi; }

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

create_sub() { # <name> <balance> [parent]
  local id="$1.$ROOT" parent="${3:-$ROOT}"
  if exists "$id"; then log "$id already exists"; return 0; fi
  log "creating $id with $2 (signed by $parent)"
  run near account create-account fund-myself "$id" "$2" \
    autogenerate-new-keypair save-to-keychain sign-as "$parent" \
    network-config "$NETWORK" send
}

deploy() { # <account> <wasm>
  log "deploying $2 on $1"
  run near contract deploy "$1" use-file "$WASM_DIR/$2" without-init-call \
    network-config "$NETWORK" sign-as "$ROOT" send
}

call() { # <signer> <contract> <method> <json> <deposit>
  run near contract call-function as-transaction "$2" "$3" json-args "$4" \
    prepaid-gas '290.0 Tgas' attached-deposit "$5" \
    network-config "$NETWORK" sign-as "$1" send
}

view() { # <contract> <method> <json>
  near contract call-function as-read-only "$1" "$2" json-args "$3" network-config "$NETWORK"
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
    "severe_compensation": "20000000000000000000",
    "fund_share_pct": 20,
    "contest_window_seconds": 604800,
    "contest_deposit": "20000000000000000000",
    "platform_strike_limit": 3,
}))
PY
}

main() {
  [ -f "$WASM_DIR/demerit.wasm" ] || { echo "run 'make build' first" >&2; exit 1; }
  create_root
  if [ "$DRY" != 1 ]; then
    local root_balance
    root_balance=$(balance_near "$ROOT")
    log "root balance: $root_balance NEAR (the run needs about 8.5)"
    # Storage is the hard floor: 3.3 NEAR for the registry wasm, 2.0 for the
    # platform, plus the scenario. Below that the run cannot succeed.
    if ! python3 -c "import sys; sys.exit(0 if float('$root_balance') >= 6.5 else 1)"; then
      echo "FATAL: $ROOT holds $root_balance NEAR; at least 6.5 are needed" >&2
      echo "       (registry wasm 321 kB = 3.3 NEAR, platform 181 kB = 2.0 NEAR)" >&2
      exit 1
    fi
  fi
  # Storage is 1 NEAR per 100 kB: the registry wasm costs ~3.3, the platform ~1.9.
  create_sub registry "3.6 NEAR"
  create_sub missions "2.3 NEAR"
  create_sub issuer "0.5 NEAR"
  create_sub lea "0.6 NEAR"
  create_sub lea2 "0.4 NEAR"
  create_sub client "0.6 NEAR"
  create_sub agent1.lea "0.3 NEAR" "lea.$ROOT"
  deploy "$REGISTRY" demerit.wasm
  deploy "$PLATFORM" missions.wasm
  init_contracts
  seed
  verify
  write_addresses
}

init_contracts() {
  log "initialising the registry (issuer = $ISSUER)"
  call "$ISSUER" "$REGISTRY" new '{}' '0 NEAR'
  log "initialising the platform"
  call "$ISSUER" "$PLATFORM" new \
    "{\"registry\":\"$REGISTRY\",\"category\":\"$CATEGORY\",\"min_points\":null}" '0 NEAR'
  log "creating the category $CATEGORY (1 month = $((MONTH_NS / 1000000000)) s)"
  call "$ISSUER" "$REGISTRY" create_category \
    "{\"id\":\"$CATEGORY\",\"rules\":$(rules_json),\"base_bond\":\"100000000000000000000\"}" '0 NEAR'
  log "approving the platform"
  call "$ISSUER" "$REGISTRY" approve_platform \
    "{\"category\":\"$CATEGORY\",\"account\":\"$PLATFORM\"}" '0 NEAR'
}

seed() {
  log "issuing licences"
  call "$ISSUER" "$REGISTRY" issue "{\"account\":\"$LEA\",\"category\":\"$CATEGORY\",\"identity\":\"fp-lea-demo\"}" "$BOND"
  call "$ISSUER" "$REGISTRY" issue "{\"account\":\"$LEA2\",\"category\":\"$CATEGORY\",\"identity\":\"fp-lea2-demo\"}" "$BOND"
  mission "clean"
  mission "light"
  mission "medium"
  log "delegating to $AGENT for 30 days"
  local until
  until=$(python3 -c 'import time;print(int((time.time()+30*86400)*1e9))')
  call "$LEA" "$REGISTRY" delegate \
    "{\"category\":\"$CATEGORY\",\"delegate\":\"$AGENT\",\"expires_at\":\"$until\"}" '0 NEAR'
  mission "severe"
  log "contesting the severe report, then winning the appeal"
  call "$LEA" "$REGISTRY" contest "{\"category\":\"$CATEGORY\",\"mission_id\":\"m-$MISSION_N\"}" "$DEPOSIT"
  call "$ISSUER" "$REGISTRY" resolve_contest \
    "{\"category\":\"$CATEGORY\",\"mission_id\":\"m-$MISSION_N\",\"upheld\":false}" '0 NEAR'
}

mission() { # <outcome> — post, accept, close through the platform contract
  local n="${MISSION_N:-0}" outcome="$1"
  MISSION_N=$((n + 1))
  log "mission $MISSION_N: post -> accept -> close ($outcome)"
  call "$CLIENT" "$PLATFORM" post "{\"reward\":\"50000000000000000000\"}" "$REWARD"
  call "$LEA" "$PLATFORM" accept "{\"mission_id\":$MISSION_N}" '0 NEAR'
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
