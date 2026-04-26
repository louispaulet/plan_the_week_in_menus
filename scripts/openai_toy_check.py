#!/usr/bin/env python3
"""Tiny OpenAI Responses API sanity check for local debugging.

Reads OPENAI_API_KEY from the current environment or .env, sends a small
JSON-mode request to gpt-5-nano, and validates the returned toy JSON shape.
No secrets are printed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def load_dotenv(path: Path = Path(".env")) -> None:
    if os.environ.get("OPENAI_API_KEY") or not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def call_openai(model: str, timeout: int) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing. Add it to .env or export it in your shell.")

    payload = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": (
                    "Return strict JSON only. The root object must have keys: "
                    "ok, recipe_name, ingredients. ingredients must be an array."
                ),
            },
            {
                "role": "user",
                "content": "Create one toy low-carb dinner idea with four ingredients.",
            },
        ],
        "text": {"format": {"type": "json_object"}},
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )

    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"OpenAI HTTP {error.code}: {detail[:500]}") from error
    except urllib.error.URLError as error:
        raise SystemExit(f"OpenAI request failed: {error}") from error

    output_text = body.get("output_text")
    if not output_text:
        for item in body.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    output_text = content.get("text")
                    break

    if not output_text:
        raise SystemExit(f"OpenAI response had no output_text. Top-level keys: {list(body.keys())}")

    parsed = json.loads(output_text)
    duration_ms = int((time.monotonic() - started) * 1000)
    return {"duration_ms": duration_ms, "parsed": parsed}


def main() -> int:
    parser = argparse.ArgumentParser(description="Check OpenAI key and Responses API JSON syntax.")
    parser.add_argument("--model", default="gpt-5-nano")
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    load_dotenv()
    result = call_openai(args.model, args.timeout)
    parsed = result["parsed"]

    if not isinstance(parsed, dict):
        raise SystemExit("Expected a JSON object from OpenAI.")
    if not isinstance(parsed.get("ingredients"), list):
        raise SystemExit(f"Expected ingredients array, got: {parsed}")

    print("OpenAI toy check passed")
    print(f"duration_ms={result['duration_ms']}")
    print(f"recipe_name={parsed.get('recipe_name')}")
    print(f"ingredients={', '.join(map(str, parsed['ingredients']))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
