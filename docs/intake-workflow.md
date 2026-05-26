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

## Canonical onboarding attribute catalog

What an onboarding request *could* capture. Two things decide which are actually required:
the **risk tier** (driven by data class + use) and **vendor vs internal**. The demo
`profiles.json` captures a small subset (`[now]`); the rest are `[gap]` to add as the
program matures. Grounded in vendor-risk + AI-TRiSM practice (SOC 2 / DPA), the EU AI Act
risk tiers, ISO/IEC 42001, and NIST AI RMF.

### Tier model (what's required, when)

| Tier | Triggered when | Adds (cumulative) |
|---|---|---|
| **Tier 1 — baseline** | every request | identity, intended use, data classification, residency, training-exclusion, DPA, primary certs, approval status |
| **Tier 2 — sensitive** | data class ≥ Confidential, or EU AI Act risk ≥ limited | sub-processors, encryption, access controls, retention, DPIA, incident response |
| **Tier 3 — high-risk** | Regulated-PII, or a high-risk use (employment / credit / biometric / legal-medical) | model provenance, training-data source, bias assessment, explainability, human oversight, autonomy level, output guardrails, conformity assessment |

The rubric demands attributes by tier: a Tier-3 assessment with Tier-3 fields missing
returns them as `missing_attributes` / `open_questions`, not a false "looks fine."

### Attributes by category

Legend: `[now]` in demo schema · `[gap]` to add · (V) vendor-only · (I) internal-only

**1. Identity & ownership** — `tool name` `[now]`, `vendor` `[now]`, `source` (vendor/internal/OSS) `[gap]`, `version` `[gap]`, `requester` / `department` / `business owner` `[gap]`, `owning team` (I) `[gap]`

**2. Use & purpose** — `intended_use` `[gap]`, `user population & scope` `[gap]`, `criticality` `[gap]`, `EU AI Act risk tier` `[gap]`, `high-risk use flags` (employment/credit/biometric/legal-medical) `[gap]`

**3. Data** — `data_types` → classification `[now]`, `data flow (in/out)` `[gap]`, `data_residency` `[now]`, `cross-border transfer` `[gap]`, `retention_days` `[now]`, `data minimization` `[gap]`, **`training exclusion`** `[gap]`, `sub-processors` `[gap]`, `PII/PHI/PCI flags` `[gap]`, `deletion / portability` `[gap]`

**4. Security & certifications** — `certs` (SOC 2 II, ISO 27001, ISO 42001) `[now]`, `dpa_on_file` `[now]`, `DPIA / PIA` `[gap]`, `encryption (transit/rest)` `[gap]`, `access controls (SSO/SCIM/RBAC)` `[gap]`, `incident response & breach notice` `[gap]`, `pen-test / audit results` `[gap]`

**5. Model / AI-specific** — `model provider & type` `[gap]`, `training data provenance + licensing` `[gap]`, `bias assessment + monitoring` `[gap]`, `explainability` `[gap]`, `accuracy / hallucination risk` `[gap]`, **`autonomy level`** (suggests vs acts) `[gap]`, `human-in-the-loop` `[gap]`, `output guardrails` `[gap]`

**6. Legal & contractual** (V) — `IP ownership of outputs` `[gap]`, `indemnification / liability` `[gap]`, `ToS + renewal dates` `[gap]`, `pricing / cost` `[gap]`, `SLA` `[gap]`, `exit & data portability` `[gap]`

**7. Vendor viability** (V) — `company size / financial stability` `[gap]`, `references` `[gap]`, `support model` `[gap]`, `lock-in risk` `[gap]`

**8. Governance & lifecycle** — `approval_status` `[now]`, `approver` `[gap]`, `review / re-review date` `[gap]`, `required controls` → `control_templates` `[now]`, `risk verdict` `[now]`, `audit logging of usage` `[now]`

**9. Operational** — `integration method` (SSO/API/MCP/extension) `[gap]`, `capabilities` `[now]`, `deployment env` (I) `[gap]`, `usage telemetry` `[gap]`

> The engine wires a representative subset of these per tier (see `endpoint/index.mjs`
> → `requiredAttributes()`); the full catalog above is the program's reference, and the
> visual matrix is `docs/onboarding-attributes.html`.

## Open questions for the build

- Routing target on submit: Vanta pending record only, or also open a ticket (Jira/ServiceNow)?
- Does an `approved` request auto-create a tool profile, or does a human author it?
- Notification channel back to the requester (Glean message, email)?
