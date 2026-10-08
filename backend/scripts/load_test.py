"""Concurrent-user load test against a running HPMS API (RFP FUNC A.8, TECH C.1).

Signs in once, then has N simulated users repeatedly call the read endpoints the web app uses,
and reports the response-time distribution and error count per endpoint.

Run from the repository root, against a server that is already up:
    python -m backend.scripts.load_test --base-url http://localhost:8001 --users 25 --seconds 30

The password is read from the HPMS_LOAD_PASSWORD environment variable (never from the command
line); for the local demo accounts it defaults to "<username>123".

Results describe the machine and database they were run on. Numbers from a laptop with a
development server say nothing about production capacity.
"""

import argparse
import asyncio
import os
import statistics
import sys
import time
from collections import defaultdict
from typing import Dict, List, Tuple

import httpx

ENDPOINTS = [
    ("project list", "/api/v1/projects?page_size=20"),
    ("project list, filtered", "/api/v1/projects?stage=operation&page_size=20"),
    ("loan accounts", "/api/v1/loan-accounts?page_size=20"),
    ("portfolio analytics", "/api/v1/analytics/portfolio"),
    ("plant performance", "/api/v1/analytics/performance"),
    ("covenant results", "/api/v1/compliance/covenants"),
    ("maintenance", "/api/v1/maintenance"),
    ("approval queue", "/api/v1/mutations/approval-queue"),
]
PROJECT_ENDPOINTS = [
    ("project detail", "/api/v1/projects/{id}"),
    ("project loans", "/api/v1/projects/{id}/loan-accounts"),
    ("generation tab", "/api/v1/projects/{id}/generation-ppa"),
    ("covenant history", "/api/v1/compliance/covenants/{id}/history"),
]


def percentile(values: List[float], pct: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(pct / 100 * (len(ordered) - 1))))]


async def run(base_url: str, username: str, password: str, users: int, seconds: float) -> Tuple[Dict, Dict, float]:
    timings: Dict[str, List[float]] = defaultdict(list)
    failures: Dict[str, int] = defaultdict(int)
    limits = httpx.Limits(max_connections=users, max_keepalive_connections=users)
    async with httpx.AsyncClient(base_url=base_url, timeout=30, limits=limits) as client:
        login = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
        login.raise_for_status()
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        projects = (await client.get("/api/v1/projects?stage=operation&page_size=10")).json()["data"]
        targets = list(ENDPOINTS)
        for project in projects[:3]:
            targets += [(name, path.format(id=project["id"])) for name, path in PROJECT_ENDPOINTS]
        if not projects:
            print("No operating projects found: per-project endpoints are not exercised")

        deadline = time.perf_counter() + seconds

        async def user(offset: int) -> None:
            index = offset
            while time.perf_counter() < deadline:
                name, path = targets[index % len(targets)]
                index += 1
                started = time.perf_counter()
                try:
                    response = await client.get(path)
                    ok = response.status_code == 200
                except httpx.HTTPError:
                    ok = False
                if ok:
                    timings[name].append((time.perf_counter() - started) * 1000)
                else:
                    failures[name] += 1

        started = time.perf_counter()
        await asyncio.gather(*(user(i) for i in range(users)))
        return timings, failures, time.perf_counter() - started


def report(timings: Dict[str, List[float]], failures: Dict[str, int], users: int, elapsed: float) -> List[str]:
    total = sum(len(v) for v in timings.values())
    failed = sum(failures.values())
    lines = [f"{users} concurrent users for {elapsed:.0f}s: {total} requests succeeded, {failed} failed, "
             f"{total / elapsed:.0f} requests/second", "",
             f"{'endpoint':<26}{'requests':>9}{'median ms':>11}{'p95 ms':>9}{'max ms':>9}{'failed':>8}"]
    for name in sorted(set(timings) | set(failures)):
        values = timings.get(name, [])
        if values:
            lines.append(f"{name:<26}{len(values):>9}{statistics.median(values):>11.0f}"
                         f"{percentile(values, 95):>9.0f}{max(values):>9.0f}{failures.get(name, 0):>8}")
        else:
            lines.append(f"{name:<26}{0:>9}{'-':>11}{'-':>9}{'-':>9}{failures.get(name, 0):>8}")
    everything = [v for values in timings.values() for v in values]
    if everything:
        lines += ["", f"all endpoints: median {statistics.median(everything):.0f} ms, "
                      f"p95 {percentile(everything, 95):.0f} ms"]
    return lines


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Concurrent-user load test for the HPMS API.")
    parser.add_argument("--base-url", default="http://localhost:8001")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--users", type=int, default=25)
    parser.add_argument("--seconds", type=float, default=30)
    args = parser.parse_args(argv)
    password = os.getenv("HPMS_LOAD_PASSWORD") or f"{args.username}123"

    try:
        timings, failures, elapsed = asyncio.run(run(args.base_url, args.username, password, args.users, args.seconds))
    except httpx.HTTPError as exc:
        print(f"Could not start: {type(exc).__name__}: {exc}")
        return 1
    print("\n".join(report(timings, failures, args.users, elapsed)))
    return 1 if sum(failures.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
