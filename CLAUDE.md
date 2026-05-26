# AI Governance Copilot — project notes

A deterministic risk-verdict engine with a Glean chat copilot. `/assess` (verdict),
`/capture` (gated decision write), `/request` (new-tool intake) — all on one rubric in
`endpoint/index.mjs`, zero dependencies. Tests: `cd endpoint && node --test`.
Docs published via GitHub Pages from `/docs` → https://vnakhate.github.io/ai-governance-copilot/

## Visual docs layout (docs/*.html)

Self-contained HTML explainers (no build step, CDN for fonts + Mermaid). Conventions,
learned the hard way — follow these so diagrams render right the first time.

### Mermaid diagrams MUST fill the container width

The gotcha that cost several iterations: `.mermaid svg{width:100%}` alone does **nothing**,
because Mermaid renders the svg inside the `.mermaid` element, which is **content-sized**
when its parent `.mermaid-canvas` is `display:flex; justify-content:center`. So `width:100%`
resolves to 100% of the small content width → the diagram stays tiny and centered.

**The fix — both rules are required:**
```css
.mermaid{width:100%}                                   /* make the element full-width  */
.mermaid svg{width:100%!important;height:auto!important;max-width:none!important;display:block}
```
The svg has a `viewBox`, so `width:100%` scales the drawing uniformly to fill — it stays
crisp. Set the initial pan/zoom scale to **1.0** (fit width); reset returns to 1.0. Do NOT
use an initial scale > 1 to "make it bigger" — fix the width rule instead.

For a **standalone, fit-the-whole-diagram-in-view** page (e.g. a tall sequence): render at
natural size (`sequence:{useMaxWidth:false}`), `await mermaid.run()`, then measure the svg
and set `scale = min(boxW/svgW, boxH/svgH)` so the whole thing fits a fixed-height box
(`height:84vh`). Don't force `.mermaid svg{width:100%}` on those — it fights the measurement.

### Page width
`.wrap{max-width: …}` — use **1280–1340px** for diagram-heavy pages, ~1100px for prose/hub
pages. Default 880–1080 is too narrow for diagrams.

### Verifying a diagram actually fills (don't eyeball it)
`file://` is blocked in the headless browser, so serve `docs/` locally and measure:
```bash
python3 -m http.server 8910 --directory docs &
```
Then via Playwright MCP: navigate to `http://127.0.0.1:8910/<page>.html`, wait for
`.mermaid svg`, and assert `svg.getBoundingClientRect().width / .mermaid-wrap.clientWidth > 0.9`.
This catches the content-sized-svg bug that's invisible until measured.

### GitHub Pages caching
Pages serves from `main`→`/docs` and rebuilds on push (~1 min; check
`gh api repos/vnakhate/ai-governance-copilot/pages/builds/latest -q .status`). Fastly caches
hard — to verify a fresh change, append a cache-buster query (`?cb=<n>`) or hard-refresh,
or it'll look like "no change."

### Aesthetic variety (no AI slop)
Each page commits to a different constrained aesthetic so they don't blur together:
Blueprint (system-overview), Nord (architecture), Editorial (journey), Paper/ink
(intake-workflow), Teal/slate (attributes), Terminal (new-tool-*). Rules: never Inter/Roboto
as body font; no indigo/violet or cyan-magenta-pink; no emoji section headers; no gradient
text; no animated glowing shadows. Risk colors are semantic (red/amber/green = HIGH/MED/LOW).
Every page supports light + dark via `prefers-color-scheme`.

### Diagram cross-linking
A heavy diagram can live on its own full-page (`new-tool-sequence.html`) and be linked from
the prose page (`new-tool-workflow.html`). Keep relative hrefs so they resolve within `/docs`.

## Repo hygiene
- Playwright MCP writes a `.playwright-mcp/` scratch dir in the repo — `rm -rf` it; never commit it.
- Runtime `audit-log.jsonl` is gitignored.
- Feature work: branch → tests → PR → squash-merge. Docs-only changes go straight to `main`.
