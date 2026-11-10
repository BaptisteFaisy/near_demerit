SHELL := /bin/bash
WASM_DIR := target/wasm32-unknown-unknown/release
# near-sdk 5.30 binds the on-chain host functions behind the `near` cfg.
NEAR_RUSTFLAGS := --cfg near
CARGO ?= cargo
export NEAR_SANDBOX_BIN_PATH ?= $(HOME)/.local/near-sandbox/near-sandbox

.PHONY: setup build test demo attack sim web web-smoke lint fmt clean

## Toolchain, contracts, and a first build. No network beyond crates.io.
setup:
	rustup target add wasm32-unknown-unknown
	$(CARGO) fetch
	@$(MAKE) build

build:
	RUSTFLAGS="$(NEAR_RUSTFLAGS)" $(CARGO) build --target wasm32-unknown-unknown --release -p permis -p missions
	@test -f $(WASM_DIR)/permis.wasm && test -f $(WASM_DIR)/missions.wasm && echo "BUILD OK"

test:
	$(CARGO) test -p permis -p missions

## Nine steps from the spec on a local sandbox: prints a table, fails loudly.
demo: build
	$(CARGO) run -p demo --quiet

## Every attack in the spec must be refused with the expected code.
attack: build
	$(CARGO) run -p demo --bin attack --quiet

## Five robots, 24 simulated months, five expected outcomes.
sim:
	$(CARGO) run -p demo --bin sim --quiet

## Static public page: open web/index.html, or `make web` for a local server.
web:
	cd web && python3 -m http.server 8080

web-smoke:
	cd web && node scripts/smoke.mjs

lint:
	RUSTFLAGS="$(NEAR_RUSTFLAGS)" $(CARGO) clippy --workspace --all-targets -- -D warnings

fmt:
	$(CARGO) fmt --all

clean:
	$(CARGO) clean
