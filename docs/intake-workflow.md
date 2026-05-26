# Workflow: Request a new AI tool

Captures how an employee or department lead requests onboarding of a **new** AI tool
(vendor or internal) through the Glean agent. This is the intake path for tools that are
NOT yet in the registry — it turns the "MEDIUM — needs review" dead-end into a tracked
governance request.

Status: DESIGN (not yet built). Extends the existing engine (`/assess`, `/capture`);
see `docs/design.md` for the base architecture.

## Why this exists

The current app answers "can I use *known* tool X for data Y?" When the tool is unknown,
`assess()` returns `MEDIUM — needs review` and stops. But the original goal is **onboarding
new tools** — so the unknown-tool case needs a productive next step: capture a structured
request and route it to the governance team.

## Entry points

1. **Reactive** — an `/assess` returns `needs_review` (unknown tool) and the user says
   "request it" / "get it reviewed."
2. **Proactive** — the user opens with onboarding intent: "I want to use [tool]" /
   "can we get [tool] approved for my team?"

## Conversation flow

```
1. Agent recognizes "request new tool" intent.
2. Agent collects intake fields (asks only for what's missing):
     - tool name + vendor          (or "internal" + owning team)
     - vendor URL / docs link       -> feeds future auto-assessment
     - intended use / justification
     - data types it would touch    -> maps to the classification scheme
     - department + requester
     - jurisdiction
3. Agent runs a best-effort provisional assess() on what's known and
   lists the unknowns a reviewer must resolve (open_questions).
4. Agent confirms the summary: "Submit this request? [Yes / Edit]".
5. On Yes -> POST /request writes a PENDING record + audit('requested')
   + (optional) a governance ticket.
6. Agent returns the tracking ID and next step:
     "Logged as VND-2026-0148 (PENDING). Routed to governance@.
      You'll be notified when it's reviewed."
```

## State machine

```
requested ──(governance triages)──▶ under_review
under_review ──▶ approved        -> becomes an approved tool profile (joins the registry)
             ──▶ rejected         -> requester notified with reason
             ──▶ info_requested   -> back to requester for more detail
```

The **agent owns only the `requested` transition.** Everything after is the governance
team acting in Vanta. The agent captures and routes; it does not adjudicate.

## Intake record (`ai_vendor_request`)

A distinct object from the `ai_vendor_risk` record `/capture` writes — there is no
confident verdict yet, only a pending item with open questions.

```json
{
  "record_id": "VND-2026-0148",
  "object": "ai_vendor_request",
  "status": "pending_review",
  "tool": "Otter.ai",
  "vendor": "Otter",
  "source": "vendor",
  "requested_by": "alice@co",
  "department": "Sales",
  "intended_use": "summarize customer discovery calls",
  "data_types": ["call_audio", "customer_pii"],
  "jurisdiction": "EU",
  "provisional_verdict": "HIGH (provisional — vendor unverified)",
  "open_questions": ["DPA on file?", "data residency?", "SOC2/ISO?"],
  "requested_at": "<iso>"
}
```

## How it plugs into the engine

**Decision: a dedicated `requestNewTool` action → `POST /request` (Option A).**

- `/assess` = known tools → verdict. `/capture` = write a verdict decision.
  `/request` = new/unknown tools → write a pending request.
- The request reuses `assess()` for the *provisional* read but writes an
  `ai_vendor_request` (pending) record, not an `ai_vendor_risk` one. `open_questions`
  are first-class.
- Audit trail gains a third `proceeded`/event value: `requested`. The "complete record of
  every AI-use decision" now includes intents that don't yet have an answer.

Option B (overload `/capture` with `pending: true`) was considered and rejected: it blurs
"captured decision" vs "open request" and muddies the audit semantics. A request has its
own object and lifecycle, so it gets its own action.

## Reuse / new work

| Reused (already built) | New (to build) |
|---|---|
| `assess()` rubric (provisional read) | `POST /request` endpoint |
| audit trail mechanism | `ai_vendor_request` record + `requested` audit event |
| Glean agent + custom-action pattern | `requestNewTool` action + intake conversation in agent instructions |
| `data_type` classification | request state field (`pending_review` …) |

## Open questions for the build

- Routing target on submit: Vanta pending record only, or also open a ticket (Jira/ServiceNow)?
- Does an `approved` request auto-create a tool profile, or does a human author it?
- Notification channel back to the requester (Glean message, email)?
