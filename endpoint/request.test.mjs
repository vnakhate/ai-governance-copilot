// Tests for the new-tool request intake (buildRequest).
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "./index.mjs";

test("request: bare PII request -> tier 3, HIGH provisional, open questions include DPA + bias", () => {
  const r = buildRequest({
    tool: "Otter.ai", vendor: "Otter",
    data_types: ["call_audio", "customer_pii"], requested_by: "alice", jurisdiction: "EU",
  });
  assert.equal(r.object, "ai_vendor_request");
  assert.equal(r.status, "pending_review");
  assert.equal(r.tier, 3);
  assert.match(r.provisional_verdict, /HIGH/);
  assert.ok(r.open_questions.length > 0);
  assert.ok(r.open_questions.includes("Is a signed DPA on file?"));      // tier-1 gap
  assert.ok(r.open_questions.includes("Has bias been assessed and is it monitored?")); // tier-3 gap
});

test("request: providing an attribute removes its open question (the loop closes)", () => {
  const without = buildRequest({ tool: "X", data_types: ["customer_pii"] });
  const withDpa = buildRequest({ tool: "X", data_types: ["customer_pii"], dpa_on_file: true });
  assert.ok(without.open_questions.includes("Is a signed DPA on file?"));
  assert.ok(!withDpa.open_questions.includes("Is a signed DPA on file?"));
});

test("request: low-sensitivity data -> tier 1, no model/bias questions", () => {
  const r = buildRequest({ tool: "Canva AI", data_types: ["marketing_copy"] });
  assert.equal(r.data_class, "Public");
  assert.equal(r.tier, 1);
  assert.ok(!r.open_questions.includes("Has bias been assessed and is it monitored?"));
});

test("request: high_risk_use bumps Internal data to tier 3", () => {
  const r = buildRequest({ tool: "HireScreen", data_types: ["internal"], high_risk_use: true });
  assert.equal(r.tier, 3);
});

test("request: sane defaults for a minimal body", () => {
  const r = buildRequest({});
  assert.equal(r.requested_by, "anonymous");
  assert.equal(r.jurisdiction, "EU");
  assert.equal(r.source, "vendor");
  assert.deepEqual(r.data_types, []);
  assert.equal(r.status, "pending_review");
});
