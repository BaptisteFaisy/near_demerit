SHELL := /bin/bash
WASM_DIR := target/wasm32-unknown-unknown/release
# near-sdk 5.30 binds the on-chain host functions behind the `near` cfg.
NEAR_RUSTFLAGS := --cfg near
CARGO ?= cargo
# near-workspaces 0.24 downloads neard on first use. When that download is
# blocked, point this at a local binary (`npm i -g near-sandbox@0.3.5`).
SANDBOX_LOCAL := $(HOME)/.local/near-sandbox/near-sandbox
ifneq (,$(wildcard $(SANDBOX_LOCAL)))
export NEAR_SANDBOX_BIN_PATH ?= $(SANDBOX_LOCAL)
endif

.PHONY: setup build test demo attack sim testnet testnet-dry web web-smoke lint fmt clean dev web-ui-smoke

## Toolchain, contracts, and a first build. No network beyond crates.io.
setup:
	rustup target add wasm32-unknown-unknown
	$(CARGO) fetch
	@$(MAKE) build

build:
	RUSTFLAGS="$(NEAR_RUSTFLAGS)" $(CARGO) build --target wasm32-unknown-unknown --release -p demerit -p missions
	@test -f $(WASM_DIR)/demerit.wasm && test -f $(WASM_DIR)/missions.wasm && echo "BUILD OK"

test:
	$(CARGO) test -p demerit -p missions

## Nine steps from the spec on a local sandbox: prints a table, fails loudly.
demo: build
	$(CARGO) run -p demo --quiet

## Every attack in the spec must be refused with the expected code.
attack: build
	$(CARGO) run -p demo --bin attack --quiet

## Five robots, 24 simulated months, five expected outcomes.
sim:
	$(CARGO) run -p demo --bin sim --quiet

## Testnet: create the accounts, deploy both contracts, seed a readable
## scenario, write out/testnet.json and point web/config.js at it.
testnet: build
	bash scripts/testnet.sh

testnet-dry:
	bash scripts/testnet.sh --dry-run

## Static public page: open web/index.html, or `make web` for a local server.
web:
	cd web && python3 -m http.server 8080

web-smoke:
	cd web && node scripts/smoke.mjs

## Headless UI check against the live sandbox node: needs `make dev` running.
web-ui-smoke:
	cd web && npm install --no-audit --no-fund >/dev/null 2>&1
	cd web && node scripts/ui-smoke.mjs

## Local sandbox node kept alive plus the page served on http://127.0.0.1:8080.
## Writes out/devnet.json with the contract, missions and RPC addresses.
dev: build
	$(CARGO) build -p demo --bin devnet
	@rm -f out/devnet.json
	@./target/debug/devnet & echo $$! > out/devnet.pid; \
	trap 'kill $$(cat out/devnet.pid) 2>/dev/null; rm -f out/devnet.pid' EXIT INT TERM; \
	until [ -s out/devnet.json ]; do sleep 1; done; \
	echo "Devnet ready: $$(cat out/devnet.json)"; \
	cd web && python3 -m http.server 8080

lint:
	RUSTFLAGS="$(NEAR_RUSTFLAGS)" $(CARGO) clippy --workspace --all-targets -- -D warnings

fmt:
	$(CARGO) fmt --all

clean:
	$(CARGO) clean
