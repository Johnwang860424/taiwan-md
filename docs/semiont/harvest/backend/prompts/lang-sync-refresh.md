## Task type: lang-sync-refresh (4-part divide-and-conquer)

You translate ONE zh→en article via the lang-sync optimized 4-part pipeline. Cross-links and footnote URLs are handled deterministically by the surrounding tools — you only do prose + frontmatter strings + footnote text.

### Inputs (from task.yml)

- **zh path**: `{{task.inputs.zh_path}}` (e.g. `Food/牛肉麵.md`)
- **lang**: `{{task.inputs.lang}}` (always `en` for v1)
- **mode**: `{{task.inputs.mode}}` (`stale` or `missing`)

### Procedure (5 steps)

#### Step 1 — Read context (must-read for boot profile already loaded)

Read these in addition:

- `docs/prompts/TRANSLATE_PROMPT.md` (translation rules)
- `scripts/tools/lang-sync/optimized-translate.py` (understand the 4-part split)

#### Step 2 — Extract zh into 4 parts

```bash
python3 scripts/tools/lang-sync/optimized-translate.py extract {{task.inputs.zh_path}}
```

This writes to `.lang-sync-tasks/optimized/{slug}/`:

- `a-frontmatter-translatable.json` — title / description / imageAlt / tags
- `b-body.md` — body markdown (cross-links pre-resolved to en URLs)
- `c-footnotes.json` — `[^N]: [Title](URL) — desc` parsed
- `d-extension.md` — 延伸閱讀 list (cross-links auto-mapped)
- `crosslinks-log.json` — which zh→en URL resolutions worked

#### Step 3 — Generate the agent input

```bash
python3 scripts/tools/lang-sync/optimized-translate.py prompt {{task.inputs.zh_path}} > /tmp/lang-sync-prompt.txt
```

Read `/tmp/lang-sync-prompt.txt` — it contains:

- Translatable frontmatter fields JSON
- Body markdown (cross-links already en URLs)
- Footnotes that need title + desc translation (Chinese only)

#### Step 4 — Write 3 output files (this is your AI work)

Use the Write tool to create these in `.lang-sync-tasks/optimized/{slug}/` (absolute paths from current working dir):

1. **`translated-fields.json`** — JSON with translated `title`, `description`, `imageAlt` (if present), `tags` (en slug-case array). Example:

```json
{
  "title": "Beef Noodle Soup",
  "description": "From mainlander nostalgia to Taiwan's national dish: cultural fusion and global aroma",
  "imageAlt": "Taiwanese beef noodle soup",
  "tags": ["food", "beef-noodle-soup", "mainlander-cuisine"]
}
```

2. **`translated-body.md`** — full English body. Preserve **everything**:
   - All `##` / `###` headings
   - Image markdown `![alt](path)` + surrounding `_圖片來源..._` line (translate to `_Source: ..._`)
   - Blockquotes (`>`)
   - Lists (`-` / `1.`)
   - Tables (markdown table syntax)
   - **Bold** / _italic_
   - Footnote refs `[^1]`, `[^N]` (preserve as-is — definitions handled by assembler)
   - Markdown links `[text](url)` — translate text, keep URL
   - Wikilinks `[[X]]` → plain English text
   - **DO NOT** include trailing `---\n_References:_\n` separator — assembler adds canonical

3. **`translated-footnotes.json`** — array of `{ref, title_en, desc_en}` for any footnote that had Chinese in title or desc. Example:

```json
[
  {
    "ref": "1",
    "title_en": "Wikipedia: History of Taiwan beef noodle soup",
    "desc_en": "Includes verification by historian Lu Yao-tung"
  },
  { "ref": "3", "title_en": "The News Lens: ...", "desc_en": "..." }
]
```

#### Step 5 — Assemble + apply SHA + commit

```bash
# Resolve target en path from existing translation or generate slug for missing
EN_PATH=$(python3 -c "
import json, sys
m = json.load(open('knowledge/_translations.json'))
zh = '{{task.inputs.zh_path}}'
for k, v in m.items():
    if v == zh and k.startswith('{{task.inputs.lang}}/'):
        print('knowledge/' + k); sys.exit(0)
# Missing — generate slug from zh basename
print('knowledge/{{task.inputs.lang}}/{slug}.md')  # adjust manually for missing
")

# Assemble
python3 scripts/tools/lang-sync/optimized-translate.py assemble {{task.inputs.zh_path}} --en-path "$EN_PATH"

# For new translations, manually add translatedFrom + 4 SHA fields if missing
# (assembler keeps existing frontmatter; for missing case, add via Python before commit)

# Apply SHA bump
bash scripts/tools/lang-sync/refresh.sh {{task.inputs.zh_path}} {{task.inputs.lang}} --apply --sha-only

# Verify ratio
bash scripts/tools/translation-ratio-check.sh "$EN_PATH"
# Verdict must be OK (not TRUNCATED / THIN)

# Commit
git add "$EN_PATH" knowledge/_translations.json
git commit -m "🧬 [semiont] heal: lang-sync 4-part refresh {{task.inputs.zh_path}} → {{task.inputs.lang}}

Mode: {{task.inputs.mode}}
sid: [{{session_short}}]
"
```

#### Step 6 — Report to status.log

Append one line:

```
[<ISO>] success — translated {zh_path} chars: zh={N}, en={M}, ratio={R}
```

### Hard rules

- **DO NOT** rewrite or improve zh content — translation only
- **DO NOT** skip Step 5 SHA apply — without it status stays stale
- **DO NOT** include `---\n_References:_\n` at end of `translated-body.md` (assembler handles)
- **DO NOT** bypass pre-commit hook with `--no-verify`
- **DO NOT** translate `lang-sync-tasks/` brief files
- **DO NOT** modify zh source

### Failure modes (escalate to human)

- zh source missing or renamed
- Pre-commit hook fails on something other than 3-field check
- Ratio TRUNCATED after assembly (re-translate with explicit length instruction)
- Nested frontmatter fields detected (`lifeTree`, `perspectives`, `comment`) — bail and report; v2 toolkit will handle
- Cross-link unresolved count > 5 — leave them as zh links + flag in `outputs/observations.md`

### Why 4-part split

- Token savings: avg ~30K vs ~50K monolithic (41% reduction)
- Time savings: avg 90-150s vs 180s (25% reduction)
- Determinism: cross-links + footnote URLs no AI variance
- Reusability: same prompt template works for all 597 articles

Source design: `reports/lang-sync-toolkit-plan-2026-04-29.md` + `lang-sync-experiments-2026-04-29.md`
