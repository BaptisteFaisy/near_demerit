#!/usr/bin/env bash
# Deploy both contracts to NEAR testnet and replay a short scenario.
#
#   ./scripts/deploy-testnet.sh              # tries the faucet for $ROOT
#   ROOT=demerit.boncard.testnet ./scripts/deploy-testnet.sh   # or reuse a root you own
#
# No secret leaves this machine: near-cli-rs keeps keys in ~/.near-credentials.
set -euo pipefail

ROOT="${ROOT:-demerit.testnet}"
NETWORK="testnet"
RPC="https://rpc.testnet.near.org"
WASM_DIR="target/wasm32-unknown-unknown/release"
OUT="out/testnet.json"

log() { printf '\033[1;34m->\033[0m %s\n' "$*"; }

[ -f "$WASM_DIR/demerit.wasm" ] || { echo "run 'make build' first"; exit 1; }

if ! near view account-summary "$ROOT" network-config "$NETWORK" now >/dev/null 2>&1; then
  log "creating $ROOT via the faucet service"
  near account create-account sponsor-by-faucet-service "$ROOT" \
    autogenerate-new-keypair save-to-keychain network-config "$NETWORK" create
fi

for name in demerit missions issuer lea lea2 client; do
  acct="$name.$ROOT"
  if near view account-summary "$acct" network-config "$NETWORK" now >/dev/null 2>&1; then
    log "$acct already exists"
  else
    log "creating $acct"
    near account create-account fund-myself "$acct" \
      sponsor-by-faucet-service autogenerate-new-keypair save-to-keychain \
      network-config "$NETWORK" create || \
    near account create-account fund-myself "$acct" \
      autogenerate-new-keypair save-to-keychain \
      network-config "$NETWORK" create \
      sign-as "$ROOT" send
  fi
done

log "deploying the registry on demerit.$ROOT"
near contract deploy demerit.$ROOT use-file "$WASM_DIR/demerit.wasm" \
  without-init-call network-config "$NETWORK" sign-as "$ROOT" send

log "deploying the platform on missions.$ROOT"
near contract deploy missions.$ROOT use-file "$WASM_DIR/missions.wasm" \
  without-init-call network-config "$NETWORK" sign-as "$ROOT" send

log "initialising both contracts (issuer.$ROOT is the issuer)"
near contract call-function as-transaction issuer.$ROOT demerit.$ROOT \
  json-args '{}' new network-config "$NETWORK" sign-as "issuer.$ROOT" send
near contract call-function as-transaction issuer.$ROOT missions.$ROOT \
  json-args {"registry":"demerit.$ROOT",\"category\":\"coursier\",\"min_points\":null}" \
  new network-config "$NETWORK" sign-as "issuer.$ROOT" send

mkdir -p out
cat > "$OUT" <<JSON
{
  "network": "$NETWORK",
  "rpc": "$RPC",
  "root": "$ROOT",
  "registry": "demerit.$ROOT",
  "missions": "missions.$ROOT",
  "issuer": "issuer.$ROOT",
  "lea": "lea.$ROOT",
  "lea2": "lea2.$ROOT",
  "client": "client.$ROOT"
}
JSON
log "addresses written to $OUT"
cat "$OUT"
