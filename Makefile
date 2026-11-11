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

.PHONY: setup build test demo attack sim testnet testnet-dry web web-smoke web-ui-smoke web-live-smoke lint fmt clean dev

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
## Drives the PUBLIC page (near-demerit.vercel.app) against the live testnet.
web-live-smoke:
	cd web && npm install --no-audit --no-fund >/dev/null 2>&1
	cd web && node scripts/live-check.mjs

web-ui-smoke:
	cd web && npm install --no-audit --no-fund >/dev/null 2>&1
	cd web && node scripts/ui-smoke.mjs

## Local sandbox node kept alive plus the page served on http://127.0.0.1:8080.
## Writes out/devnet.json with the contract, missions and RPC addresses.
## Override the web port with `make dev WEB_PORT=8090`.
WEB_PORT ?= 8080
dev: build
	$(CARGO) build -p demo --bin devnet
	@mkdir -p $(CURDIR)/out && rm -f $(CURDIR)/out/devnet.json $(CURDIR)/out/devnet.pid
	@./target/debug/devnet & echo $$! > $(CURDIR)/out/devnet.pid; \
	trap 'kill $$(cat $(CURDIR)/out/devnet.pid) 2>/dev/null; rm -f $(CURDIR)/out/devnet.pid' EXIT INT TERM; \
	until [ -s $(CURDIR)/out/devnet.json ]; do sleep 1; done; \
	echo "Devnet ready: $$(cat $(CURDIR)/out/devnet.json)"; \
	echo "Page: http://127.0.0.1:$(WEB_PORT)/?contract=$$(python3 -c "import json;print(json.load(open('$(CURDIR)/out/devnet.json'))['contract'])")"; \
	cd web && python3 -m http.server $(WEB_PORT)

lint:
	RUSTFLAGS="$(NEAR_RUSTFLAGS)" $(CARGO) clippy --workspace --all-targets -- -D warnings

fmt:
	$(CARGO) fmt --all

clean:
	$(CARGO) clean
