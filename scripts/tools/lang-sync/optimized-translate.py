#!/usr/bin/env python3
"""
optimized-translate.py — 4-part divide-and-conquer 翻譯 pipeline

把一篇 zh 文章切 4 部分，AI 只處理 prose；frontmatter / footnotes / 延伸閱讀
都用 deterministic rule 處理。

  Part A: frontmatter
    - title / description / imageAlt: 需翻譯（很短，附加在 prose call）
    - tags: 翻譯（短）
    - 其他 fields: passthrough（date / author / category / featured / readingTime
       / lastVerified / lastHumanReview / subcategory / image / imageCredit /
       三 SHA fields）

  Part B: body prose
    - Markdown 主體（頭 # 以下、footnote 定義以上、延伸閱讀 list 以上）
    - 唯一送 Sonnet 的部分

  Part C: footnotes
    - `[^n]: [Title](URL) — desc` 結構
    - URL + bracket title (如果是 URL 自己) 保留；只翻 description

  Part D: 延伸閱讀 cross-links
    - 從 `## 延伸閱讀` / `**延伸閱讀**` 後的 list
    - `- [文章名](/category/slug) — 說明` 用 _translations.json 反查 zh→en slug
    - 沒有對應 en 時保留 zh 連結 + 加 zh 原文 inline

用法：
  optimized-translate.py extract <zh_path>
    → 寫 .lang-sync-tasks/optimized/{slug}/parts.json
       (a-frontmatter.yml + b-body.md + c-footnotes.json + d-crosslinks.json)
  optimized-translate.py prompt <zh_path>
    → 印 minimal agent prompt (B + a-trans-fields)
  optimized-translate.py assemble <zh_path> --en-path <out>
    → 從 parts.json + translated-body.md + translated-fields.yml 組裝完整 en 檔
"""
import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
KN = REPO / "knowledge"
TASKS = REPO / ".lang-sync-tasks" / "optimized"
TRANSLATIONS_JSON = KN / "_translations.json"

# Frontmatter fields that ARE TRANSLATED
TRANSLATABLE_FIELDS = {"title", "description", "imageAlt"}
# Tags get translated separately (often Chinese in zh)
TRANSLATABLE_LIST_FIELDS = {"tags"}
# Everything else passes through unchanged
PASSTHROUGH_FIELDS = {
    "date", "author", "category", "featured", "readingTime",
    "lastVerified", "lastHumanReview", "subcategory", "image",
    "imageCredit", "translatedFrom", "sourceCommitSha",
    "sourceContentHash", "translatedAt", "translatedFromInferred",
    "researchReport", "difficulty", "created",
}


# ---------- Section split ----------

def split_zh_file(content: str) -> dict:
    """Returns {frontmatter_text, body_main, body_extension, body_footnotes, body_image_block}"""
    if not content.startswith("---"):
        return {"frontmatter_text": "", "body_main": content,
                "body_extension": "", "body_footnotes": ""}
    end = content.find("---", 3)
    fm_text = content[3:end].strip("\n")
    body = content[end + 3:].lstrip("\n")

    # Find footnote definitions block: `[^n]: ...`
    footnote_re = re.compile(r"^\[\^[\w-]+\]:\s.*(?:\n  .*)*", re.M)
    footnote_matches = list(footnote_re.finditer(body))
    if footnote_matches:
        # Take from first footnote onwards
        footnotes_start = footnote_matches[0].start()
        # Walk back to find the separator (--- or _references_ marker)
        body_before_fns = body[:footnotes_start].rstrip()
        body_footnotes = body[footnotes_start:].rstrip()
    else:
        body_before_fns = body.rstrip()
        body_footnotes = ""

    # Find 延伸閱讀 / Extended Reading section
    ext_re = re.compile(
        r"^(?:##\s+延伸閱讀|##\s+相關文章|##\s+Related|\*\*延伸閱讀\*\*)\s*$",
        re.M | re.I,
    )
    ext_match = ext_re.search(body_before_fns)
    if ext_match:
        body_main = body_before_fns[:ext_match.start()].rstrip()
        body_extension = body_before_fns[ext_match.start():].strip()
    else:
        body_main = body_before_fns
        body_extension = ""

    return {
        "frontmatter_text": fm_text,
        "body_main": body_main,
        "body_extension": body_extension,
        "body_footnotes": body_footnotes,
    }


# ---------- Frontmatter ----------

def parse_frontmatter_lines(fm_text: str) -> tuple[dict, list[str]]:
    """Returns (translatable_fields, raw_lines)"""
    out = {}
    raw_lines = fm_text.splitlines()
    in_tags_inline = False
    for line in raw_lines:
        m = re.match(r"^(\w+):\s*(.+)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        if key in TRANSLATABLE_FIELDS:
            # Strip surrounding quotes
            v = val.strip()
            if (v.startswith("'") and v.endswith("'")) or \
               (v.startswith('"') and v.endswith('"')):
                v = v[1:-1]
            out[key] = v
        elif key == "tags":
            # Inline list: tags: [a, b, c]
            if val.strip().startswith("["):
                tags = re.findall(r"['\"]?([^,'\"\[\]]+?)['\"]?(?=,|\])", val)
                tags = [t.strip() for t in tags if t.strip()]
                out["tags"] = tags
    return out, raw_lines


def extract_translatable_block(parts: dict) -> dict:
    """Returns the minimal block that needs AI translation."""
    fm_translatable, _ = parse_frontmatter_lines(parts["frontmatter_text"])
    return {
        "fields": fm_translatable,
        "body_main": parts["body_main"],
    }


# ---------- 延伸閱讀 (Cross-links) ----------

def load_translations_json() -> dict:
    if not TRANSLATIONS_JSON.exists():
        return {}
    return json.loads(TRANSLATIONS_JSON.read_text(encoding="utf-8"))


def resolve_zh_to_en(zh_slug_path: str, translations: dict) -> str | None:
    """Given /category/zh-slug or category/zh.md, return en path if exists."""
    # Normalize: strip leading /, .md, lowercase category
    norm = zh_slug_path.strip().lstrip("/")
    if norm.endswith("/"):
        norm = norm[:-1]
    # Reverse search _translations.json values
    # values are like "Category/原檔名.md"
    # Build reverse map: zh-slug → en path
    for en_path, zh_target in translations.items():
        if not en_path.startswith("en/"):
            continue
        # zh_target is "Category/檔.md", convert to /category/slug
        zh_norm = zh_target.replace(".md", "").replace("knowledge/", "")
        # Lower-case category for URL match
        parts_z = zh_norm.split("/", 1)
        if len(parts_z) == 2:
            zh_url = f"{parts_z[0].lower()}/{parts_z[1]}"
            if norm == zh_url or norm == zh_norm.lower():
                # Convert en path to URL
                en_norm = en_path[3:].replace(".md", "")  # strip "en/"
                en_parts = en_norm.split("/", 1)
                if len(en_parts) == 2:
                    return f"/en/{en_parts[0].lower()}/{en_parts[1]}/"
                return f"/en/{en_norm}/"
    return None


def rewrite_cross_links(text: str, translations: dict) -> tuple[str, list]:
    """Rewrite zh wikilinks/markdown links to en equivalents. Returns (text, log)."""
    log = []
    # Pattern: `[Title](/category/slug)` or `[Title](/category/slug/)`
    pattern = re.compile(r"\[([^\]]+)\]\((/[^)]+)\)")

    def replace(m):
        title = m.group(1)
        url = m.group(2)
        # Skip external URLs
        if url.startswith("http"):
            return m.group(0)
        # Skip anchors
        if url.startswith("#"):
            return m.group(0)
        en_url = resolve_zh_to_en(url, translations)
        if en_url:
            log.append(("resolved", url, en_url))
            return f"[{title}]({en_url})"
        else:
            log.append(("unresolved", url, None))
            return m.group(0)  # leave as-is

    new = pattern.sub(replace, text)
    return new, log


# ---------- Footnotes ----------

def parse_footnotes(text: str) -> list[dict]:
    """Parse `[^n]: [Title](URL) — desc` and similar variants."""
    if not text:
        return []
    # Strip leading separator
    text = re.sub(r"^---+\s*\n+_參考資料：?_\s*\n+", "", text)
    text = re.sub(r"^---+\s*\n+", "", text)

    out = []
    # Match each footnote
    fn_re = re.compile(
        r"^\[\^([\w-]+)\]:\s*(.+?)(?=^\[\^|\Z)",
        re.M | re.S,
    )
    for m in fn_re.finditer(text):
        ref = m.group(1)
        body = m.group(2).strip()
        out.append({"ref": ref, "body": body})
    return out


def translate_footnote_desc(body: str) -> dict:
    """Split footnote into [Title](URL) — desc parts."""
    # Pattern: [Title](URL) — desc OR [Title](URL) - desc
    m = re.match(
        r"^\[([^\]]+)\]\(([^)]+)\)\s*[—–-]\s*(.+)$",
        body.strip(),
        re.S,
    )
    if m:
        return {
            "title": m.group(1),
            "url": m.group(2),
            "desc": m.group(3).strip(),
        }
    return {"raw": body}


# ---------- Main commands ----------

def cmd_extract(zh_path: str):
    zh_full = KN / zh_path.lstrip("knowledge/").lstrip("/")
    if not zh_full.exists():
        print(f"❌ {zh_full} not found")
        sys.exit(1)
    content = zh_full.read_text(encoding="utf-8")
    parts = split_zh_file(content)
    fm_translatable, fm_raw_lines = parse_frontmatter_lines(parts["frontmatter_text"])
    fns = parse_footnotes(parts["body_footnotes"])
    fns_parsed = [{"ref": f["ref"], **translate_footnote_desc(f["body"])} for f in fns]
    translations = load_translations_json()

    # Rewrite cross-links in main body + extension
    body_main_xlinked, body_main_log = rewrite_cross_links(parts["body_main"], translations)
    body_ext_xlinked, body_ext_log = rewrite_cross_links(parts["body_extension"], translations)

    slug = Path(zh_path).stem
    out_dir = TASKS / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Output parts
    (out_dir / "a-frontmatter-raw.txt").write_text(parts["frontmatter_text"] + "\n", encoding="utf-8")
    (out_dir / "a-frontmatter-translatable.json").write_text(
        json.dumps(fm_translatable, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "b-body.md").write_text(body_main_xlinked + "\n", encoding="utf-8")
    (out_dir / "d-extension.md").write_text(body_ext_xlinked + "\n", encoding="utf-8")
    (out_dir / "c-footnotes.json").write_text(
        json.dumps(fns_parsed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "crosslinks-log.json").write_text(
        json.dumps({"body": body_main_log, "extension": body_ext_log},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Stats
    print(f"✅ Extracted {zh_path} → {out_dir}")
    print(f"   Frontmatter: {len(fm_translatable)} translatable fields ({list(fm_translatable.keys())})")
    print(f"   Body main: {len(parts['body_main'])} chars")
    print(f"   Extension: {len(parts['body_extension'])} chars")
    print(f"   Footnotes: {len(fns_parsed)}")
    print(f"   Cross-links: body resolved={sum(1 for x in body_main_log if x[0]=='resolved')}/"
          f"unresolved={sum(1 for x in body_main_log if x[0]=='unresolved')}")


def cmd_prompt(zh_path: str):
    """Print minimal agent prompt — only translatable parts."""
    slug = Path(zh_path).stem
    out_dir = TASKS / slug
    if not (out_dir / "b-body.md").exists():
        cmd_extract(zh_path)

    fm = json.loads((out_dir / "a-frontmatter-translatable.json").read_text())
    body = (out_dir / "b-body.md").read_text()
    extension = (out_dir / "d-extension.md").read_text()
    fns = json.loads((out_dir / "c-footnotes.json").read_text())

    # Footnotes — translate both bracket title (if zh) and desc (if zh)
    fn_to_translate = []
    for f in fns:
        title = f.get("title", "")
        desc = f.get("desc", "")
        title_has_zh = any("一" <= ch <= "鿿" for ch in title)
        desc_has_zh = any("一" <= ch <= "鿿" for ch in desc)
        if title_has_zh or desc_has_zh:
            fn_to_translate.append({
                "ref": f["ref"],
                "title_zh": title if title_has_zh else None,
                "title_en_existing": title if not title_has_zh else None,
                "desc_zh": desc if desc_has_zh else None,
                "url": f.get("url"),
            })

    # Extension list items text-only translation (rare, mostly auto-mapped)
    ext_lines = []
    if extension:
        for line in extension.splitlines():
            if line.startswith("- ["):
                # The bracket content might be zh title, capture it
                m = re.match(r"^-\s+\[([^\]]+)\]\([^)]+\)(?:\s*[—–-]\s*(.+))?", line)
                if m:
                    ext_lines.append({
                        "bracket_title_zh": m.group(1),
                        "trail_desc_zh": m.group(2) or "",
                    })

    print("=" * 60)
    print("LANG-SYNC OPTIMIZED TRANSLATION TASK")
    print("=" * 60)
    print(f"\nSlug: {slug}")
    print(f"\n## Translatable frontmatter fields\n")
    print(json.dumps(fm, ensure_ascii=False, indent=2))
    print(f"\n## Body markdown (translate to en, preserve all structure)\n")
    print(body)
    if fn_to_translate:
        print(f"\n## Footnotes to translate ({len(fn_to_translate)} items)")
        print("# For each, output {ref, title_en, desc_en} — translate title (Chinese source name) AND desc")
        print(json.dumps(fn_to_translate, ensure_ascii=False, indent=2))
    if ext_lines:
        print(f"\n## Extension reading list bracket titles ({len(ext_lines)} items)")
        print(json.dumps(ext_lines, ensure_ascii=False, indent=2))


def cmd_assemble(zh_path: str, en_path: str):
    """Stitch translated parts → final en .md"""
    slug = Path(zh_path).stem
    out_dir = TASKS / slug
    if not (out_dir / "b-body.md").exists():
        print(f"❌ no parts at {out_dir}, run extract first"); sys.exit(1)

    # Read translated outputs
    trans_fields_path = out_dir / "translated-fields.json"
    trans_body_path = out_dir / "translated-body.md"
    trans_fns_path = out_dir / "translated-footnotes.json"
    trans_ext_path = out_dir / "translated-extension.md"

    if not trans_fields_path.exists() or not trans_body_path.exists():
        print(f"❌ missing translated files. Need:")
        print(f"   - {trans_fields_path}")
        print(f"   - {trans_body_path}")
        print(f"   - {trans_fns_path} (optional)")
        print(f"   - {trans_ext_path} (optional)")
        sys.exit(1)

    trans_fields = json.loads(trans_fields_path.read_text())
    trans_body = trans_body_path.read_text().rstrip()
    trans_fns = json.loads(trans_fns_path.read_text()) if trans_fns_path.exists() else []
    trans_ext = trans_ext_path.read_text().rstrip() if trans_ext_path.exists() else ""

    # Read raw zh frontmatter to get passthrough fields
    fm_raw = (out_dir / "a-frontmatter-raw.txt").read_text()

    # Build new frontmatter: passthrough + translated
    new_fm_lines = []
    for line in fm_raw.splitlines():
        m = re.match(r"^(\w+):\s*(.+)$", line)
        if not m:
            new_fm_lines.append(line)
            continue
        key, val = m.group(1), m.group(2)
        if key in TRANSLATABLE_FIELDS and key in trans_fields:
            # Replace value
            quote = "'" if "'" not in trans_fields[key] else '"'
            new_fm_lines.append(f"{key}: {quote}{trans_fields[key]}{quote}")
        elif key == "tags" and "tags" in trans_fields:
            tags_list = trans_fields["tags"]
            tags_str = ", ".join(f"'{t}'" for t in tags_list)
            new_fm_lines.append(f"tags: [{tags_str}]")
        else:
            new_fm_lines.append(line)

    # Original footnotes (URLs preserved; both title + desc translated by agent if zh)
    fns_orig = json.loads((out_dir / "c-footnotes.json").read_text())
    trans_fn_map = {f["ref"]: f for f in trans_fns} if trans_fns else {}

    fn_lines = []
    if fns_orig:
        fn_lines.append("---")
        fn_lines.append("")
        fn_lines.append("_References:_")
        fn_lines.append("")
        for fn in fns_orig:
            ref = fn["ref"]
            t = trans_fn_map.get(ref, {})
            # Title: prefer translated en title, then existing en, then zh
            title = t.get("title_en") or t.get("title_en_existing") or fn.get("title", "")
            url = fn.get("url", "")
            # Desc: prefer translated, fallback to original
            desc = t.get("desc_en") or fn.get("desc", "")
            if title and url:
                fn_lines.append(f"[^{ref}]: [{title}]({url}) — {desc}")
            else:
                fn_lines.append(f"[^{ref}]: {fn.get('raw', '')}")
            fn_lines.append("")

    # Strip body trailing `---\n_References:_` block if agent left one (assembler adds canonical)
    body_clean = re.sub(
        r"\n---\s*\n+_(?:References|參考資料)[:：]?_\s*\n*$",
        "\n",
        trans_body,
        flags=re.M,
    )

    # Assemble
    out_lines = ["---"] + new_fm_lines + ["---", ""]
    out_lines.append(body_clean.rstrip())
    if trans_ext:
        out_lines.append("")
        out_lines.append(trans_ext)
    if fn_lines:
        out_lines.append("")
        out_lines.extend(fn_lines)

    en_full = REPO / en_path
    en_full.parent.mkdir(parents=True, exist_ok=True)
    en_full.write_text("\n".join(out_lines).rstrip() + "\n", encoding="utf-8")
    print(f"✅ Assembled → {en_path}")
    print(f"   Final size: {en_full.stat().st_size} bytes")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract"); e.add_argument("zh_path")
    pr = sub.add_parser("prompt"); pr.add_argument("zh_path")
    a = sub.add_parser("assemble"); a.add_argument("zh_path"); a.add_argument("--en-path", required=True)
    args = p.parse_args()
    if args.cmd == "extract": cmd_extract(args.zh_path)
    elif args.cmd == "prompt": cmd_prompt(args.zh_path)
    elif args.cmd == "assemble": cmd_assemble(args.zh_path, args.en_path)


if __name__ == "__main__":
    main()
