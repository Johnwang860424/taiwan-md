#!/usr/bin/env python3
"""
analyze-crawler-404.py — AI crawler per-UA × path × status breakdown

把 CF httpRequestsAdaptiveGroups 用 (userAgent × clientRequestPath × edgeResponseStatus)
三維 group，找出每個 AI crawler 的 top 404 paths。這是「為 AI 讀者做 SEO」
(LONGINGS 2026-04-18) 戰略的第一個量化工具。

2026-04-18 ι session instantiate — based on ζ session finding:
- PerplexityBot 成功率 49% / OAI-SearchBot 36% / BingBot 53%
- 每修一個 crawler-specific 404 pattern → 每週 1K-3K more cite-able pages

用法：
    python3 scripts/tools/analyze-crawler-404.py              # 所有主要 crawler
    python3 scripts/tools/analyze-crawler-404.py --ua PerplexityBot
    python3 scripts/tools/analyze-crawler-404.py --days 3
"""

from pathlib import Path
import json
import sys
import argparse
import re
from datetime import datetime, timedelta, timezone

# Reuse fetch-cloudflare.py primitives
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

fc = import_module("fetch-cloudflare")

# Common AI crawler UAs we want to analyze (substring match, case-insensitive)
TARGET_CRAWLERS = [
    ("PerplexityBot", r"PerplexityBot"),
    ("OAI-SearchBot", r"OAI-SearchBot"),
    ("BingBot", r"bingbot"),
    ("ChatGPT-User", r"ChatGPT-User"),
    ("ClaudeBot", r"ClaudeBot"),
    ("GPTBot", r"GPTBot"),
    ("Applebot", r"Applebot"),
    ("Googlebot", r"Googlebot"),
    ("Amazonbot", r"Amazonbot"),
    ("FacebookBot", r"facebookexternalhit|Meta-ExternalAgent|FacebookBot"),
]


def query_per_path(token, zone_tag, days=3):
    """Query httpRequestsAdaptiveGroups grouped by (userAgent, edgeResponseStatus, clientRequestPath).

    Free tier supports 1-day window per query; loop daily.
    """
    now = datetime.now(timezone.utc)
    query = """
    query CrawlerPathsDay($zoneTag: String!, $start: Time!, $end: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_leq: $end }
            limit: 10000
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              userAgent
              edgeResponseStatus
              clientRequestPath
            }
          }
        }
      }
    }
    """
    rows = []
    for offset in range(days):
        day_end = now - timedelta(days=offset)
        day_start = day_end - timedelta(days=1)
        variables = {
            "zoneTag": zone_tag,
            "start": day_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "end": day_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        data, err = fc._cf_graphql_soft(token, query, variables)
        if err:
            print(
                f"⚠️  day {day_start.date()}: {err[:200]}", file=sys.stderr
            )
            continue
        zones = data.get("viewer", {}).get("zones", []) or []
        if zones:
            day_rows = zones[0].get("httpRequestsAdaptiveGroups", []) or []
            rows.extend(day_rows)
    return rows


def analyze_crawler(rows, ua_name, ua_pattern):
    """Aggregate per-UA × path × status for a single crawler."""
    # path → {200: count, 404: count, total: count}
    paths = {}
    total = {"200": 0, "404": 0, "other": 0, "all": 0}

    for row in rows:
        dims = row.get("dimensions", {}) or {}
        ua = dims.get("userAgent", "") or ""
        if not re.search(ua_pattern, ua, re.IGNORECASE):
            continue
        path = dims.get("clientRequestPath", "") or ""
        status = int(dims.get("edgeResponseStatus", 0) or 0)
        count = int(row.get("count", 0) or 0)

        if path not in paths:
            paths[path] = {"200": 0, "404": 0, "3xx": 0, "other": 0, "all": 0}
        paths[path]["all"] += count
        total["all"] += count
        if status == 200:
            paths[path]["200"] += count
            total["200"] += count
        elif status == 404:
            paths[path]["404"] += count
            total["404"] += count
        elif 300 <= status < 400:
            paths[path]["3xx"] += count
        else:
            paths[path]["other"] += count
            total["other"] += count

    return paths, total


def format_report(ua_name, paths, total, top_n=10):
    """Format per-UA report."""
    lines = []
    lines.append(f"\n{'=' * 70}")
    lines.append(f"🤖 {ua_name}")
    lines.append(f"{'=' * 70}")

    if total["all"] == 0:
        lines.append("  (no requests)")
        return "\n".join(lines)

    rate_200 = total["200"] / total["all"] * 100
    rate_404 = total["404"] / total["all"] * 100
    lines.append(
        f"  {total['all']:,} requests | {total['200']:,} (200) {rate_200:.1f}% | {total['404']:,} (404) {rate_404:.1f}% | {total['other']:,} other"
    )

    if total["404"] == 0:
        lines.append("  ✅ No 404s")
        return "\n".join(lines)

    # Top 404 paths by count
    sorted_paths = sorted(paths.items(), key=lambda x: x[1]["404"], reverse=True)
    top_404 = [(p, d) for p, d in sorted_paths if d["404"] > 0][:top_n]

    lines.append(f"\n  📍 Top {len(top_404)} 404 paths:")
    for path, d in top_404:
        # Truncate long paths for display
        disp_path = path if len(path) <= 55 else path[:52] + "..."
        share = d["404"] / total["404"] * 100
        lines.append(
            f"    {d['404']:>5} × {disp_path:<55} ({share:.1f}% of crawler's 404s)"
        )

    return "\n".join(lines)


def classify_404_patterns(all_paths):
    """Cross-crawler 404 pattern classification — find common 404 sources."""
    # Aggregate all 404s by path across all crawlers
    path_total_404 = {}
    for ua_paths in all_paths.values():
        for p, d in ua_paths.items():
            if d["404"] > 0:
                path_total_404[p] = path_total_404.get(p, 0) + d["404"]

    # Classify into patterns
    patterns = {
        "semiont (nav bug)": 0,
        "language-switch nav": 0,
        "old URLs (renamed)": 0,
        "EN category routes": 0,
        "trailing slash": 0,
        "other": 0,
    }
    for path, count in path_total_404.items():
        if "/semiont" in path and path != "/semiont" and path != "/semiont/":
            patterns["semiont (nav bug)"] += count
        elif "/en/" in path and any(
            x in path for x in ["/culture/", "/food/", "/history/", "/people/"]
        ):
            if "/democratic-transition" in path or path.endswith("-band"):
                patterns["old URLs (renamed)"] += count
            else:
                patterns["EN category routes"] += count
        elif re.search(r"/(ja|ko|fr|es)/", path):
            patterns["language-switch nav"] += count
        elif path.endswith("/") and not path.startswith("//"):
            patterns["trailing slash"] += count
        else:
            patterns["other"] += count

    return patterns, sorted(path_total_404.items(), key=lambda x: x[1], reverse=True)[:20]


def main():
    parser = argparse.ArgumentParser(description="AI crawler per-UA 404 analysis")
    parser.add_argument("--days", type=int, default=3, help="days back (default 3)")
    parser.add_argument("--ua", help="single UA name to analyze")
    parser.add_argument("--top", type=int, default=10, help="top N paths per UA")
    args = parser.parse_args()

    env = fc.load_env()
    token = env.get("CF_API_TOKEN", "").strip()
    zone_tag = env.get("CF_ZONE_ID", "").strip()
    if not token or not zone_tag:
        fc.fail("CF_API_TOKEN or CF_ZONE_ID missing")

    print(
        f"📊 Fetching per-UA × path × status for {args.days} days..."
        , file=sys.stderr
    )
    rows = query_per_path(token, zone_tag, days=args.days)
    print(f"✅ Got {len(rows):,} (UA, status, path) rows", file=sys.stderr)

    targets = (
        [(n, p) for n, p in TARGET_CRAWLERS if n == args.ua]
        if args.ua
        else TARGET_CRAWLERS
    )
    if not targets:
        fc.fail(f"Unknown crawler: {args.ua}")

    all_paths = {}
    summary_rows = []
    for ua_name, ua_pattern in targets:
        paths, total = analyze_crawler(rows, ua_name, ua_pattern)
        all_paths[ua_name] = paths
        if total["all"] == 0:
            continue
        rate_200 = total["200"] / total["all"] * 100 if total["all"] else 0
        rate_404 = total["404"] / total["all"] * 100 if total["all"] else 0
        summary_rows.append(
            (ua_name, total["all"], total["200"], total["404"], rate_200, rate_404)
        )
        print(format_report(ua_name, paths, total, top_n=args.top))

    # Global summary table
    print(f"\n\n{'=' * 70}")
    print("📊 CROSS-CRAWLER SUMMARY")
    print(f"{'=' * 70}")
    print(f"  {'Crawler':<20} {'Total':>8} {'200':>8} {'404':>6} {'200%':>6} {'404%':>6}")
    print("  " + "-" * 62)
    for r in sorted(summary_rows, key=lambda x: x[1], reverse=True):
        print(
            f"  {r[0]:<20} {r[1]:>8,} {r[2]:>8,} {r[3]:>6,} {r[4]:>5.1f}% {r[5]:>5.1f}%"
        )

    # Pattern classification
    patterns, top20 = classify_404_patterns(all_paths)
    print(f"\n\n{'=' * 70}")
    print("🔍 404 PATTERN CLASSIFICATION (across all crawlers)")
    print(f"{'=' * 70}")
    total_patterns = sum(patterns.values()) or 1
    for pattern, count in sorted(patterns.items(), key=lambda x: x[1], reverse=True):
        share = count / total_patterns * 100
        print(f"  {pattern:<25} {count:>6,}  ({share:.1f}%)")

    print(f"\n\n{'=' * 70}")
    print("📍 TOP 20 404 PATHS (cross-crawler)")
    print(f"{'=' * 70}")
    for path, count in top20:
        disp = path if len(path) <= 60 else path[:57] + "..."
        print(f"  {count:>5}  {disp}")


if __name__ == "__main__":
    main()
