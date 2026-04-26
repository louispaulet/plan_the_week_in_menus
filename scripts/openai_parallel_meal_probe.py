#!/usr/bin/env python3
"""Probe parallel meal generation latency with gpt-5-nano.

The app currently asks for a full structured planning response in one request,
which can be slow. This script tests a thinner strategy:

1. Fire six parallel requests, each asking for exactly one meal name.
2. Stop waiting for names once the first three valid names arrive.
3. Fire three parallel requests asking for descriptions for those names.

It reads OPENAI_API_KEY from .env or the shell. It never prints secrets.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


OPENAI_URL = "https://api.openai.com/v1/responses"


@dataclass
class ProbeResult:
    index: int
    duration_ms: int
    payload: dict


def load_dotenv(path: Path = Path(".env")) -> None:
    if os.environ.get("OPENAI_API_KEY") or not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def extract_output_text(body: dict) -> str:
    if body.get("output_text"):
        return body["output_text"]

    for item in body.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return content.get("text", "")

    return ""


def call_json(api_key: str, model: str, system: str, user: str, timeout: int) -> tuple[int, dict]:
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "text": {"format": {"type": "json_object"}},
    }

    request = urllib.request.Request(
        OPENAI_URL,
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
        raise RuntimeError(f"OpenAI HTTP {error.code}: {detail[:400]}") from error

    output_text = extract_output_text(body)
    if not output_text:
        raise RuntimeError(f"No output_text. Top-level keys: {list(body.keys())}")

    parsed = json.loads(output_text)
    duration_ms = int((time.monotonic() - started) * 1000)
    return duration_ms, parsed


def ask_for_name(index: int, api_key: str, model: str, timeout: int) -> ProbeResult:
    system = (
        "Return strict JSON only. Return exactly this shape: "
        '{"meal_name":"string","tags":["string"]}. '
        "Do not include descriptions, ingredients, markdown, or extra keys."
    )
    user = (
        f"Suggest one distinct practical dinner name for option {index}. "
        "Context: weekday meal planning, healthy, quick, not a dessert."
    )
    duration_ms, payload = call_json(api_key, model, system, user, timeout)
    if not payload.get("meal_name"):
        raise RuntimeError(f"Missing meal_name in response: {payload}")
    return ProbeResult(index=index, duration_ms=duration_ms, payload=payload)


def ask_for_description(index: int, meal_name: str, api_key: str, model: str, timeout: int) -> ProbeResult:
    system = (
        "Return strict JSON only. Return exactly this shape: "
        '{"meal_name":"string","description":"string","ingredients":["string"],"prep_time_minutes":25}. '
        "Keep description under 24 words."
    )
    user = f"Write a concise card description for this meal: {meal_name}"
    duration_ms, payload = call_json(api_key, model, system, user, timeout)
    if not payload.get("description") or not isinstance(payload.get("ingredients"), list):
        raise RuntimeError(f"Invalid description payload: {payload}")
    return ProbeResult(index=index, duration_ms=duration_ms, payload=payload)


def first_n_completed(futures: dict, count: int) -> tuple[list[ProbeResult], list[str], int]:
    started = time.monotonic()
    results: list[ProbeResult] = []
    errors: list[str] = []
    elapsed_ms = 0

    for future in concurrent.futures.as_completed(futures):
        try:
            results.append(future.result())
            if len(results) >= count:
                elapsed_ms = int((time.monotonic() - started) * 1000)
                break
        except Exception as error:  # noqa: BLE001 - probe should keep collecting.
            errors.append(str(error))

    return results, errors, elapsed_ms


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure parallel one-name meal generation latency.")
    parser.add_argument("--model", default="gpt-5-nano")
    parser.add_argument("--parallel", type=int, default=6)
    parser.add_argument("--needed", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    load_dotenv()
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing. Add it to .env or export it.")

    overall_started = time.monotonic()
    name_started = time.monotonic()

    name_executor = concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel)
    name_futures = {
        name_executor.submit(ask_for_name, index, api_key, args.model, args.timeout): index
        for index in range(1, args.parallel + 1)
    }
    name_results, name_errors, first_three_ms = first_n_completed(name_futures, args.needed)
    for future in name_futures:
        future.cancel()
    name_executor.shutdown(wait=False, cancel_futures=True)

    if len(name_results) < args.needed:
        raise SystemExit(f"Only got {len(name_results)} meal names. Errors: {name_errors}")

    name_results.sort(key=lambda result: result.duration_ms)
    chosen_names = [result.payload["meal_name"] for result in name_results[: args.needed]]

    description_started = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.needed) as executor:
        description_futures = {
            executor.submit(ask_for_description, index, meal_name, api_key, args.model, args.timeout): meal_name
            for index, meal_name in enumerate(chosen_names, start=1)
        }
        description_results = []
        description_errors = []
        for future in concurrent.futures.as_completed(description_futures):
            try:
                description_results.append(future.result())
            except Exception as error:  # noqa: BLE001
                description_errors.append(str(error))

    description_ms = int((time.monotonic() - description_started) * 1000)
    total_ms = int((time.monotonic() - overall_started) * 1000)

    if len(description_results) < args.needed:
        raise SystemExit(f"Only got {len(description_results)} descriptions. Errors: {description_errors}")

    description_results.sort(key=lambda result: result.index)

    print("Parallel meal probe passed")
    print(f"model={args.model}")
    print(f"parallel_name_requests={args.parallel}")
    print(f"needed_names={args.needed}")
    print(f"first_{args.needed}_names_ms={first_three_ms}")
    print(f"descriptions_ms={description_ms}")
    print(f"total_names_plus_descriptions_ms={total_ms}")
    print("names:")
    for result in name_results[: args.needed]:
        print(f"- {result.payload['meal_name']} ({result.duration_ms} ms)")
    print("descriptions:")
    for result in description_results:
        payload = result.payload
        print(f"- {payload['meal_name']}: {payload['description']} ({result.duration_ms} ms)")

    if name_errors:
        print("non_blocking_name_errors:")
        for error in name_errors:
            print(f"- {error}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
