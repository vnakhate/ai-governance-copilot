# AI Governance Copilot

A governance copilot built as a **Glean agent**. An employee asks in plain language —
"Can we use Acme AI Notetaker on customer calls?" — and the copilot returns a structured
**risk verdict + required controls** (reads like a risk analyst, not a search box),
grounded in the company's indexed AI Acceptable Use Policy, and on confirmation captures
the decision into **Vanta** as an AI-vendor risk record.

> Status: design + plans complete, build not started. Hackathon/demo target.

## Why

Shadow AI leaks at the employee's per-use-case decision moment, not at procurement. The
2026 numbers: ~223 shadow-AI incidents/month per org, ~665 distinct GenAI tools per
enterprise, only ~37% have any AI governance policy, shadow-AI breaches average $4.63M.
Most governance tooling is a back-office GRC portal employees avoid. This lives *inside
the assistant employees already use* and answers at the moment of need.

## The demo loop

```
employee question
  -> agent extracts (tool, data_type, jurisdiction)
  -> POST /assess  (read-only)  -> risk verdict + required controls   [cites indexed policy]
  -> "Onboard into Vanta with this risk captured? [Yes/No]"
  --(Yes)--> POST /capture (gated write) -> Vanta AI-vendor record (risk + controls)
  --(No)---> stop, no write
```

## Architecture (locked in eng review)

- **Verdict in code, not the prompt.** A pure `assess(profile, data_type, jurisdiction)`
  function encodes the risk rubric in the hosted endpoint — deterministic, unit-testable,
  bulletproof under live prodding. (Glean requires a hosted endpoint anyway; the verdict
  rides along.)
- **Profiles in code, policy indexed.** Tool profiles drive the verdict; the AUP +
  data-classification docs are indexed into Glean so the agent retrieves and cites real
  policy. That's the honest answer to "what is Glean doing here?"
- **Two execution actions.** `/assess` (read-only) and `/capture` (writes Vanta, fires
  only after a "Yes"). Both call the same `assess()` so the captured record matches the
  verdict shown.
- **Vanta capture is mocked for the demo;** live Vanta API write is a stretch.

## Build order

1. **Smoke test first** (`docs/design.md` → The Assignment): prove Glean can call the
   ngrok action, retrieval cites the right clause, the verdict renders, and `/capture` is
   turn-gated — before building anything else.
2. Build the endpoint: `assess()` + `/assess` + `/capture` with unit tests per rubric row.
3. Author 3 tool profiles (HIGH hero / approved-LOW / MEDIUM) + the policy corpus.
4. Configure the Glean agent + the ~10-15 case behavior eval (extraction, presentation,
   turn-gating).

## Docs

- [`docs/design.md`](docs/design.md) — full design doc (problem, schemas, rubric, eng decisions, failure modes)
- [`docs/test-plan.md`](docs/test-plan.md) — coverage map, unit/eval/manual split
- [`TODOS.md`](TODOS.md) — deferred work (e.g. proactive interception)

## Stack (planned)

- Glean Agent Builder (agent + custom actions + enterprise retrieval)
- A hosted endpoint (TypeScript) exposing `/assess` + `/capture`, behind ngrok for the demo
- Vanta API (vendor-risk object) as the capture target — mocked initially
