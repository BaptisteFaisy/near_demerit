#!/usr/bin/env python3
"""Read-only view call straight against a NEAR RPC node.

    python3 scripts/view.py <contract> <method> [json-args] [rpc-url]

Prints the decoded JSON result (or the raw string when it is not JSON). Raises
RuntimeError on an RPC error, so shell callers can retry or ignore it. Kept
separate from near-cli-rs: no keychain, no banner, one line of JSON out.
"""
import base64
import json
import sys
import urllib.request

DEFAULT_RPC = "https://rpc.testnet.near.org"


def call(contract, method, args="{}", rpc=DEFAULT_RPC):
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "query",
        "params": {
            "request_type": "call_function",
            "finality": "final",
            "account_id": contract,
            "method_name": method,
            "args_base64": base64.b64encode(args.encode()).decode(),
        },
    }
    request = urllib.request.Request(
        rpc, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        answer = json.load(response)
    if "error" in answer:
        raise RuntimeError(json.dumps(answer["error"])[:400])
    raw = bytes(answer["result"]["result"])
    try:
        return json.loads(raw.decode())
    except json.JSONDecodeError:
        return raw.decode()


if __name__ == "__main__":
    try:
        view = call(sys.argv[1], sys.argv[2],
                    sys.argv[3] if len(sys.argv) > 3 else "{}",
                    sys.argv[4] if len(sys.argv) > 4 else DEFAULT_RPC)
    except Exception as error:  # noqa: BLE001 - the caller only needs the code
        print("view failed: %s" % error, file=sys.stderr)
        sys.exit(1)
    print(json.dumps(view, indent=2) if isinstance(view, (dict, list)) else view)
