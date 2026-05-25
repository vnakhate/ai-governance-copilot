// Unit tests for the deterministic risk rubric (decision 1A).
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, PROFILES } from "./index.mjs";

const acme = PROFILES["acme-notetaker"];
const noteflow = PROFILES["noteflow-eu"];
const claude = PROFILES["claude-bedrock-internal"];

test("HIGH: Regulated-PII + no DPA / non-EU residency", () => {
  const v = assess(acme, "call_audio", "EU");
  assert.equal(v.risk_level, "HIGH");
  assert.deepEqual(v.required_controls, ["Signed DPA required", "EU data residency", "Retention < 30 days"]);
});

test("MEDIUM: Regulated-PII + DPA + EU + no cert", () => {
  const v = assess(noteflow, "customer_pii", "EU");
  assert.equal(v.risk_level, "MEDIUM");
  assert.equal(v.needs_review, false);
});

test("LOW: Regulated-PII + DPA + EU + cert + approved", () => {
  const v = assess(claude, "customer_pii", "EU");
  assert.equal(v.risk_level, "LOW");
});

test("MEDIUM needs_review: unknown tool", () => {
  const v = assess(null, "customer_pii", "EU");
  assert.equal(v.risk_level, "MEDIUM");
  assert.equal(v.needs_review, true);
});

test("Public data is LOW regardless of tool gaps", () => {
  const v = assess(acme, "marketing_copy", "EU");
  assert.equal(v.data_class, "Public");
  assert.equal(v.risk_level, "LOW");
});

test("Jurisdiction matters: US-residency tool is fine for a US caller", () => {
  // acme is US-residency; for a US jurisdiction there's no cross-border gap,
  // but it still lacks a DPA -> remains HIGH on the DPA gap alone.
  const v = assess(acme, "customer_pii", "US");
  assert.equal(v.risk_level, "HIGH");
  assert.match(v.why, /no DPA/);
  assert.doesNotMatch(v.why, /GDPR gap/);
});
