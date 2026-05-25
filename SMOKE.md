# Smoke Test Runbook

Goal: prove the risky unknowns BEFORE building the full demo. Order matters — test the
black boxes first (Glean can call the action + retrieval cites cleanly), turn-gating last.

## ✅ Done already (endpoint half — verified)

The endpoint is built, runs, and is unit-tested. Reproduce locally:

```bash
cd endpoint
npm start            # -> governance endpoint on :8787
# in another shell:
curl -s localhost:8787/health
curl -s -X POST localhost:8787/assess -H 'content-type: application/json' \
  -d '{"tool_id":"acme-notetaker","data_type":"call_audio","jurisdiction":"EU"}'   # -> HIGH
npm test             # 6/6 rubric unit tests pass
```

Verified verdicts: acme-notetaker→HIGH, noteflow-eu→MEDIUM, claude-bedrock-internal→LOW,
unknown→MEDIUM needs-review. `/capture` returns a Vanta-styled record matching the verdict.

## ⏳ You must do (Glean half — needs your instance + login)

### 1. Expose the endpoint (test: can Glean reach it at all?)
```bash
cd endpoint && npm start            # leave running
ngrok http 8787 --domain=<your-reserved-domain>.ngrok-free.app   # reserved domain = stable URL
```
Put the ngrok URL into `endpoint/glean-action.yaml` (`servers.url`).

### 2. Register the custom actions in Glean
Glean Agent Builder → Actions → Custom action → upload `endpoint/glean-action.yaml`.
Configure auth as needed. **Smoke check 1:** in a scratch agent, trigger `assessAITool`
and confirm Glean calls your ngrok endpoint and shows the returned verdict. If this
fails, nothing else matters — fix reachability/spec/auth first.

### 3. Index one policy doc (test: does retrieval cite cleanly?)
Index a short AI Acceptable Use Policy (with a §3.2 about PII + DPA) into Glean.
**Smoke check 2:** ask the agent a policy question and confirm it retrieves and cites
the CORRECT clause — not a vaguely-related paragraph. This is the hero's real risk.

### 4. Render check
**Smoke check 3:** confirm the verdict renders legibly in Glean chat using the format in
`docs/design.md` → "Chat UX Spec" (emoji+word badge, controls checklist, blockquote citation).

### 5. Turn-gating (the signature beat)
Wire the agent: on a question → call `assessAITool`; on a user "Yes" → call `captureToVanta`.
**Smoke check 4:** confirm `captureToVanta` fires ONLY after an explicit "Yes" (say "No"
once and verify NO Vanta write). Also verify the Yes/No mechanism — interactive buttons
vs. reply-text (open question in the design doc).

## If a check fails
- Check 1 fails (Glean can't reach ngrok / spec rejected) → fall back to the recorded
  backup clip as plan A for the demo; debug spec/auth/HTTPS separately.
- Check 2 fails (bad citations) → the "grounded in real policy" wow is at risk; tighten
  the policy doc structure or add a retrieval eval before relying on it live.
