#!/usr/bin/env python3
"""
sense-diff.py — 比較兩天的三源感知快照，列出關鍵指標 delta

Usage:
  python3 scripts/tools/sense-diff.py                 # latest vs 昨天
  python3 scripts/tools/sense-diff.py 2026-04-11      # latest vs 指定日期
  python3 scripts/tools/sense-diff.py 2026-04-11 2026-04-04  # 指定兩個日期
  python3 scripts/tools/sense-diff.py --json          # JSON 輸出

2026-04-11 session α 建造 — 為未來的心跳自動 diff 昨天 / 本週基準
Stdlib only (no venv needed).
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import List, Tuple

CACHE = Path.home() / ".config" / "taiwan-md" / "cache"


def load(name: str) -> "dict":
    p = CACHE / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception as e:
        print(f"⚠️  cannot parse {p}: {e}", file=sys.stderr)
        return None


def pct(a, b):
    """% delta from a → b. Returns '—' if undefined."""
    if a is None or b is None or a == 0:
        return "—"
    return f"{((b - a) / a) * 100:+.1f}%"


def delta(a, b):
    if a is None or b is None:
        return "—"
    d = b - a
    if isinstance(d, float):
        return f"{d:+.2f}"
    return f"{d:+d}"


def fmt(v):
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:,.2f}"
    return f"{v:,}"


def cf_metrics(d: "dict") -> dict:
    if not d:
        return {}
    s = d.get("summary", {}) or {}
    sb = d.get("status_breakdown", {}) or {}
    total = sum(sb.values()) if sb else 0
    not_found = sb.get("404", 0)
    rate_404 = (not_found / total * 100) if total else 0
    return {
        "requests": s.get("requests"),
        "pageViews": s.get("pageViews"),
        "uniques": s.get("uniques"),
        "cachedRequests": s.get("cachedRequests"),
        "threats": s.get("threats"),
        "bytes": s.get("bytes"),
        "404_rate_pct": round(rate_404, 2),
        "404_count": not_found,
    }


def ga4_metrics(d: "dict") -> dict:
    if not d:
        return {}
    o = d.get("overall", {}) or {}
    return {
        "activeUsers": int(o.get("activeUsers", 0)),
        "newUsers": int(o.get("newUsers", 0)),
        "screenPageViews": int(o.get("screenPageViews", 0)),
        "eventCount": int(o.get("eventCount", 0)),
        "engagementRate": round(o.get("engagementRate", 0), 4),
        "bounceRate": round(o.get("bounceRate", 0), 4),
    }


def sc_metrics(d: "dict") -> dict:
    if not d:
        return {}
    o = d.get("totals") or d.get("overall") or d.get("summary") or {}
    return {
        "clicks": o.get("clicks"),
        "impressions": o.get("impressions"),
        "ctr": round(o.get("ctr", 0), 4) if o.get("ctr") is not None else None,
        "position": round(o.get("position", 0), 2) if o.get("position") is not None else None,
    }


def diff_dict(a: dict, b: dict) -> List[Tuple]:
    """Return list of (key, a_val, b_val, delta, pct)."""
    rows = []
    for k in a.keys() | b.keys():
        av, bv = a.get(k), b.get(k)
        rows.append((k, av, bv, delta(av, bv), pct(av, bv)))
    return rows


def print_table(title: str, rows: List[Tuple]):
    if not rows:
        return
    print(f"\n## {title}")
    print(f"{'metric':<20} {'before':>14} {'after':>14} {'Δ':>14} {'Δ%':>10}")
    print("-" * 76)
    for k, a, b, d, p in sorted(rows):
        print(f"{k:<20} {fmt(a):>14} {fmt(b):>14} {d:>14} {p:>10}")


def resolve_snapshot(target):
    """Return (cf, ga4, sc, label) for a target — 'latest' or YYYY-MM-DD."""
    if target is None or target == "latest":
        return (
            load("cloudflare-latest.json") or {},
            load("ga4-latest.json") or {},
            load("search-console-latest.json") or {},
            "latest",
        )
    return (
        load(f"cloudflare-{target}.json") or {},
        load(f"ga4-{target}.json") or {},
        load(f"search-console-{target}.json") or {},
        target,
    )


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    json_out = "--json" in sys.argv

    # default: latest vs 昨天
    if len(args) == 0:
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        a_target, b_target = yesterday, "latest"
    elif len(args) == 1:
        a_target, b_target = args[0], "latest"
    else:
        a_target, b_target = args[0], args[1]

    a_cf, a_ga, a_sc, a_label = resolve_snapshot(a_target)
    b_cf, b_ga, b_sc, b_label = resolve_snapshot(b_target)

    a_cf_m, b_cf_m = cf_metrics(a_cf), cf_metrics(b_cf)
    a_ga_m, b_ga_m = ga4_metrics(a_ga), ga4_metrics(b_ga)
    a_sc_m, b_sc_m = sc_metrics(a_sc), sc_metrics(b_sc)

    if json_out:
        print(json.dumps({
            "before": a_label,
            "after": b_label,
            "cloudflare": diff_dict(a_cf_m, b_cf_m),
            "ga4": diff_dict(a_ga_m, b_ga_m),
            "search_console": diff_dict(a_sc_m, b_sc_m),
        }, indent=2, default=str))
        return

    print(f"# 三源感知 diff: {a_label} → {b_label}")

    if a_cf_m or b_cf_m:
        print_table("Cloudflare", diff_dict(a_cf_m, b_cf_m))
    else:
        print("\n## Cloudflare — 無快照")

    if a_ga_m or b_ga_m:
        print_table("GA4", diff_dict(a_ga_m, b_ga_m))
    else:
        print("\n## GA4 — 無快照")

    if a_sc_m or b_sc_m:
        print_table("Search Console", diff_dict(a_sc_m, b_sc_m))
    else:
        print("\n## Search Console — 無快照")

    # 🧪 EXP-2026-04-11-A 快速驗證
    a_404 = a_cf_m.get("404_rate_pct")
    b_404 = b_cf_m.get("404_rate_pct")
    if a_404 is not None and b_404 is not None:
        print("\n## 🧪 EXP-2026-04-11-A: 404 rate drop (預測 16.5% → 6.0% ±2pp)")
        print(f"  before: {a_404}%  →  after: {b_404}%  (Δ {b_404 - a_404:+.1f}pp)")
        if 4.0 <= b_404 <= 8.0:
            print("  ✅ 命中預測區間")
        elif b_404 < 4.0:
            print("  ⚠️  低於預測 — 筆記：下次不要低估修復影響")
        elif b_404 > 12.0:
            print("  ❌ 仍高 — 還有第四個 404 黑洞沒找到")
        else:
            print("  ⏳ 部分命中 — 繼續觀察")


if __name__ == "__main__":
    main()
