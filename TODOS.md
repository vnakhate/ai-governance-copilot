# TODOS — AI Governance Copilot (Glean)

## Deferred

### Proactive interception framing (post-hackathon / strategy)
- **What:** Instead of the employee typing a policy question, the copilot proactively
  intercepts at the moment of use ("I see you're about to paste a transcript into Acme —
  here's the verdict"). Dramatizes "shadow AI leaks at the decision moment" far more than
  reactive Q&A.
- **Why:** The current chat-copilot build demonstrates a chatbot answering a question,
  which partially undercuts the strategic framing (decision-moment > back-office portal).
  Proactive interception IS the thesis, made visible.
- **Pros:** Strongest possible expression of the product's reason to exist; memorable demo.
- **Cons / blocked by:** Needs a trigger signal (DLP hook, browser extension, paste
  interception) that Glean does not natively provide. Out of reach for a hackathon window.
- **Context:** Surfaced by the outside-voice plan challenge in /plan-eng-review (2026-05-25).
  The chat-copilot framing was a deliberate choice in /office-hours. This is a future
  direction, not a demo blocker.
- **Depends on:** A real-time signal source for "user is about to use an AI tool."
- **Next step if revisited:** Run /plan-ceo-review to decide whether to pivot the product
  framing before investing in the interception infrastructure.

## Roadmap — North Star B: governance engine, many surfaces

From /plan-ceo-review (2026-05-25). Product = the `/assess`+`/capture` engine; chat is
client #1. Each item is another surface or capability calling the same engine. Full record:
`~/.gstack/projects/glean/ceo-plans/2026-05-25-governance-engine-platform.md`.

### Shadow-AI discovery (flagship)
- **What:** Find ungoverned AI tools already in use (SSO logins / network egress / expense
  reports), auto-run them through `/assess`, populate Vanta.
- **Why:** Biggest outcome lever — reaches the majority who never ask (where shadow AI lives).
- **Effort:** human ~1mo+ / CC ~1wk. **Depends on:** SSO/egress/expense connectors.

### Multi-tenant config
- **What:** Policy + tool registry + rubric as per-tenant configuration (not hardcoded) + admin surface.
- **Why:** The step from "our demo" to "a product other enterprises buy."
- **Effort:** human ~1-2wk / CC ~2-3d.

### Slack/Teams surface
- **What:** The copilot where employees already work; same engine + registry backend.
- **Why:** Meet people at the decision moment without a separate portal. **Effort:** human ~3-5d / CC ~1d.

### Procurement / ITSM intake surface
- **What:** Governance at the buying moment — intake form calls `/assess`, writes Vanta.
- **Why:** High-value enterprise surface; catches new tools at acquisition. **Effort:** human ~1wk / CC ~1-2d.

### Tamper-evident audit store
- **What:** Production version of the demo's append-only JSONL — immutable store, RBAC, retention.
- **Why:** The audit trail is the moat; production needs real integrity guarantees. **Effort:** human ~1wk / CC ~2d.
