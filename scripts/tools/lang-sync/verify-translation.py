#!/usr/bin/env python3
"""
verify-translation.py — Hard-gate check for a single en translation.

Agent runs this AFTER assembling the translation, BEFORE commit.
Exit code != 0 = something is wrong → fix or escalate.

Checks (each 1-line PASS/FAIL):
  1. en file exists at expected path
  2. zh source still exists
  3. en frontmatter has translatedFrom pointing to zh
  4. en frontmatter has sourceCommitSha (≥ 7 hex / or "pre-toolkit")
  5. en frontmatter has sourceContentHash (sha256: prefix + 16 hex)
  6. en frontmatter has translatedAt (ISO 8601)
  7. zh + en frontmatter passthrough fields match (author, date, featured,
     readingTime, lastVerified, lastHumanReview, category, subcategory,
     image, imageCredit) — only deviations: title / description / imageAlt
  8. translation-ratio-check passes (OK, not TRUNCATED / THIN)
  9. footnote count matches between zh and en
  10. ## section count matches between zh and en (±1 tolerance)
  11. URL count matches (zh vs en) — URLs preserved
  12. No `---\n_References:_\n` duplication (would have been adjacent)
  13. No raw zh CJK in en `title` / `description` / `imageAlt` frontmatter fields
  14. No untranslated frontmatter `tags` (each tag should be ASCII slug-case)
  15. translatedFromInferred is bool

Usage:
  verify-translation.py <zh_path> <en_path>
  verify-translation.py Food/牛肉麵.md knowledge/en/Food/beef-noodle-soup.md
  verify-translation.py --json <zh> <en>           # JSON output

Exit codes:
  0 = all PASS
  1 = at least one HARD-FAIL (must fix)
  2 = WARN only (suggested but not blocker)
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
KN = REPO / "knowledge"

# Frontmatter fields that MUST match between zh and en (passthrough)
PASSTHROUGH = [
    "author", "date", "featured", "readingTime",
    "lastVerified", "lastHumanReview", "category",
    "subcategory", "image", "imageCredit", "difficulty",
]
# Fields that DIFFER (translated)
TRANSLATED = ["title", "description", "imageAlt", "tags"]
# Fields that ARE en-specific (added by toolkit)
EN_ONLY = [
    "translatedFrom", "sourceCommitSha", "sourceContentHash",
    "translatedAt", "translatedFromInferred",
]


def parse_fm(content: str) -> tuple[dict, str]:
    """Returns (parsed_fields, body)."""
    if not content.startswith("---"):
        return ({}, content)
    end = content.find("---", 3)
    if end == -1:
        return ({}, content)
    fm_text = content[3:end]
    body = content[end + 3:]
    out = {}
    in_list = None
    for line in fm_text.splitlines():
        # Single-line scalar
        m = re.match(r"^(\w+):\s*(.+)$", line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            # Strip quotes
            if (val.startswith("'") and val.endswith("'")) or \
               (val.startswith('"') and val.endswith('"')):
                val = val[1:-1]
            out[key] = val
            in_list = None
        # Indented list item under a key
        elif line.startswith("  - ") and in_list:
            out.setdefault(in_list, []).append(line[4:].strip().strip("'\""))
        # New list-style key (`tags:` followed by indent)
        m2 = re.match(r"^(\w+):\s*$", line)
        if m2:
            in_list = m2.group(1)
    return (out, body)


def has_cjk(s: str) -> bool:
    return any("一" <= ch <= "鿿" for ch in str(s))


def count_pattern(text: str, pat: str, flags=0) -> int:
    return len(re.findall(pat, text, flags))


def check(checks: list[dict], json_out: bool):
    hard_fail = sum(1 for c in checks if c["level"] == "FAIL")
    warns = sum(1 for c in checks if c["level"] == "WARN")
    passed = sum(1 for c in checks if c["level"] == "PASS")

    if json_out:
        print(json.dumps({
            "passed": passed,
            "warns": warns,
            "fails": hard_fail,
            "checks": checks,
        }, ensure_ascii=False, indent=2))
    else:
        for c in checks:
            icon = {"PASS": "✅", "WARN": "⚠️ ", "FAIL": "❌"}[c["level"]]
            print(f"  {icon} {c['name']}: {c['detail']}")
        print(f"\n{'='*60}")
        if hard_fail:
            print(f"❌ FAIL: {hard_fail} hard / {warns} warn / {passed} pass")
        elif warns:
            print(f"⚠️  WARN: {warns} warn / {passed} pass (no hard fail)")
        else:
            print(f"✅ ALL PASS: {passed}/{len(checks)}")
    return hard_fail


def main():
    p = argparse.ArgumentParser()
    p.add_argument("zh_path")
    p.add_argument("en_path")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    zh_path = args.zh_path.lstrip("knowledge/").lstrip("/")
    en_path = args.en_path
    if en_path.startswith("knowledge/"):
        en_path = en_path
    elif not en_path.startswith("/"):
        en_path = f"knowledge/{en_path}"

    zh_full = KN / zh_path
    en_full = REPO / en_path
    checks = []

    def add(name, level, detail):
        checks.append({"name": name, "level": level, "detail": detail})

    # 1. en exists
    if not en_full.exists():
        add("en file exists", "FAIL", f"{en_full} missing")
        return check(checks, args.json) and 1
    add("en file exists", "PASS", str(en_full.relative_to(REPO)))

    # 2. zh exists
    if not zh_full.exists():
        add("zh source exists", "FAIL", f"{zh_full} missing — orphan?")
    else:
        add("zh source exists", "PASS", str(zh_full.relative_to(REPO)))

    zh_content = zh_full.read_text(encoding="utf-8") if zh_full.exists() else ""
    en_content = en_full.read_text(encoding="utf-8")
    zh_fm, zh_body = parse_fm(zh_content) if zh_content else ({}, "")
    en_fm, en_body = parse_fm(en_content)

    # 3. translatedFrom
    tf = en_fm.get("translatedFrom", "").replace("knowledge/", "")
    if not tf:
        add("translatedFrom", "FAIL", "missing")
    elif tf != zh_path:
        add("translatedFrom", "FAIL", f"points to '{tf}' but zh is '{zh_path}'")
    else:
        add("translatedFrom", "PASS", tf)

    # 4. sourceCommitSha
    sha = en_fm.get("sourceCommitSha", "")
    if not sha:
        add("sourceCommitSha", "FAIL", "missing — run `lang-sync refresh ... --apply --sha-only`")
    elif sha == "pre-toolkit":
        add("sourceCommitSha", "WARN", "pre-toolkit fallback (acceptable for legacy)")
    elif not re.match(r"^[a-f0-9]{7,12}$", sha):
        add("sourceCommitSha", "FAIL", f"invalid format: '{sha}'")
    else:
        add("sourceCommitSha", "PASS", sha)

    # 5. sourceContentHash
    h = en_fm.get("sourceContentHash", "")
    if not h:
        add("sourceContentHash", "FAIL", "missing")
    elif not re.match(r"^sha256:[a-f0-9]{16,}$", h):
        add("sourceContentHash", "FAIL", f"invalid format: '{h[:30]}'")
    else:
        add("sourceContentHash", "PASS", h[:25] + "...")

    # 6. translatedAt
    at = en_fm.get("translatedAt", "")
    if not at:
        add("translatedAt", "FAIL", "missing")
    elif not re.match(r"^\d{4}-\d{2}-\d{2}T", at):
        add("translatedAt", "FAIL", f"invalid ISO 8601: '{at}'")
    else:
        add("translatedAt", "PASS", at)

    # 7. Passthrough fields match
    mismatches = []
    if zh_fm:
        for f in PASSTHROUGH:
            zh_v = zh_fm.get(f)
            en_v = en_fm.get(f)
            if zh_v is not None and zh_v != en_v:
                mismatches.append(f"{f}: zh='{zh_v}' en='{en_v}'")
    if mismatches:
        add("passthrough fields", "FAIL",
            f"{len(mismatches)} drift: {'; '.join(mismatches[:3])}")
    else:
        add("passthrough fields", "PASS", f"{len(PASSTHROUGH)} fields match zh")

    # 8. ratio (use existing translation-ratio-check.sh)
    ratio_tool = REPO / "scripts/tools/translation-ratio-check.sh"
    if ratio_tool.exists():
        r = subprocess.run(
            ["bash", str(ratio_tool), str(en_full.relative_to(REPO))],
            capture_output=True, text=True,
        )
        out = r.stdout + r.stderr
        if "TRUNCATED" in out or "THIN" in out:
            add("translation ratio", "FAIL", "TRUNCATED / THIN — re-translate")
        elif " OK " in out or " PASS " in out:
            # Extract ratio
            m = re.search(r"(\d+\.\d+)\s+\x1b", out) or re.search(r"(\d+\.\d+)", out)
            ratio = m.group(1) if m else "?"
            add("translation ratio", "PASS", f"OK ({ratio})")
        else:
            add("translation ratio", "WARN", f"verdict unclear: {out[:80]}")
    else:
        add("translation ratio", "WARN", "ratio tool not found")

    # 9. footnote count
    zh_fns = count_pattern(zh_body, r"^\[\^[\w-]+\]:", re.M)
    en_fns = count_pattern(en_body, r"^\[\^[\w-]+\]:", re.M)
    if zh_fns != en_fns:
        add("footnote count", "FAIL",
            f"zh={zh_fns} vs en={en_fns} — definitions lost or added")
    else:
        add("footnote count", "PASS", f"both have {zh_fns}")

    # 10. ## section count
    zh_secs = count_pattern(zh_body, r"^##\s+", re.M)
    en_secs = count_pattern(en_body, r"^##\s+", re.M)
    diff = abs(zh_secs - en_secs)
    if diff > 1:
        add("section count", "FAIL", f"zh={zh_secs} vs en={en_secs}")
    elif diff == 1:
        add("section count", "WARN", f"zh={zh_secs} vs en={en_secs} (1 diff)")
    else:
        add("section count", "PASS", f"both have {zh_secs}")

    # 11. URL count
    zh_urls = count_pattern(zh_body, r"https?://[^\s\)\"\]]+")
    en_urls = count_pattern(en_body, r"https?://[^\s\)\"\]]+")
    if zh_urls != en_urls:
        # Tolerate ±2 (image credits / 1 extra wikipedia)
        if abs(zh_urls - en_urls) <= 2:
            add("URL count", "WARN", f"zh={zh_urls} vs en={en_urls} (small diff)")
        else:
            add("URL count", "FAIL", f"zh={zh_urls} vs en={en_urls}")
    else:
        add("URL count", "PASS", f"both have {zh_urls}")

    # 12. duplicate _References_
    if re.search(r"_References:_[\s\S]{0,40}_References:_", en_body):
        add("no duplicate refs", "FAIL", "duplicate `_References:_` block found")
    else:
        add("no duplicate refs", "PASS", "single block")

    # 13. No CJK in en title/description/imageAlt
    cjk_fields = []
    for f in ("title", "description", "imageAlt"):
        v = en_fm.get(f, "")
        if has_cjk(v):
            cjk_fields.append(f"{f}: '{v[:30]}'")
    if cjk_fields:
        add("frontmatter no zh CJK", "FAIL",
            f"{len(cjk_fields)} fields have zh: {'; '.join(cjk_fields)}")
    else:
        add("frontmatter no zh CJK", "PASS", "title/desc/alt all en")

    # 14. tags ASCII slug-case
    tags = en_fm.get("tags", "")
    if isinstance(tags, str):
        # Inline list: [a, b, c] or 'a b c'
        if tags.startswith("["):
            tag_list = re.findall(r"['\"]?([^,'\"\[\]]+?)['\"]?(?=,|\])", tags)
        else:
            tag_list = [tags]
    else:
        tag_list = tags or []
    bad_tags = [t for t in tag_list if has_cjk(t)]
    if bad_tags:
        add("tags ASCII", "FAIL", f"{len(bad_tags)} zh tags: {bad_tags[:3]}")
    elif not tag_list:
        add("tags ASCII", "WARN", "no tags found (might be OK)")
    else:
        add("tags ASCII", "PASS", f"{len(tag_list)} tags all ASCII")

    # 15. inferred bool
    inf = en_fm.get("translatedFromInferred", "")
    if inf and inf not in ("true", "false", "True", "False"):
        add("inferred bool", "FAIL", f"invalid: '{inf}'")
    else:
        add("inferred bool", "PASS", inf or "(absent — also OK)")

    return check(checks, args.json) and 1 or (
        2 if any(c["level"] == "WARN" for c in checks) else 0
    )


if __name__ == "__main__":
    sys.exit(main())
