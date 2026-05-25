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
